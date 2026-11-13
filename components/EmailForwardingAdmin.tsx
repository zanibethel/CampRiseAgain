"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type Forwarder = {
  id: string; email: string; display_name: string; title: string;
  inboxes: string[]; enabled: boolean; verified_at: string | null;
};
const inboxes = [
  { id: "info", label: "General inquiries" },
  { id: "volunteer", label: "Volunteers" },
  { id: "forms", label: "Website forms" },
];
const initial = { email: "", display_name: "", title: "", inboxes: ["info", "volunteer", "forms"] };

export default function EmailForwardingAdmin() {
  const [forwarders, setForwarders] = useState<Forwarder[]>([]);
  const [newForwarder, setNewForwarder] = useState(initial);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const call = useCallback(async (method: string, data?: unknown) => {
    const client = getSupabaseBrowserClient();
    const { data: auth, error: authError } = await client.auth.getSession();
    if (authError || !auth.session?.access_token) throw new Error("Please sign in again.");
    const response = await fetch("/api/admin/email-forwarders", {
      method,
      headers: {
        Authorization: "Bearer " + auth.session.access_token,
        ...(data ? { "Content-Type": "application/json" } : {}),
      },
      body: data ? JSON.stringify(data) : undefined,
      cache: "no-store",
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Mail settings could not be saved.");
    return result;
  }, []);

  const refresh = useCallback(async () => {
    try {
      const result = await call("GET");
      setForwarders(result.forwarders || []);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to load forwarding addresses.");
    } finally {
      setLoading(false);
    }
  }, [call]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setStatus("");
    try {
      const result = await call("POST", newForwarder);
      setNewForwarder(initial);
      setStatus(result.message || "Verification email sent.");
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to add forwarding address.");
    } finally { setBusy(false); }
  }

  async function resendVerification(item: Forwarder) {
    if (busy || item.verified_at) return;
    setBusy(true); setStatus("");
    try {
      const result = await call("POST", {
        email: item.email, display_name: item.display_name,
        title: item.title, inboxes: item.inboxes,
      });
      setStatus(result.message || "Verification email sent to " + item.email + ".");
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to resend verification.");
    } finally { setBusy(false); }
  }

  async function save(item: Forwarder) {
    setBusy(true); setStatus("");
    try {
      await call("PATCH", {
        id: item.id, display_name: item.display_name,
        title: item.title, inboxes: item.inboxes, enabled: item.enabled,
      });
      setStatus("Saved forwarding settings for " + item.email + ".");
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to save changes.");
    } finally { setBusy(false); }
  }

  async function remove(item: Forwarder) {
    if (!window.confirm("Remove " + item.email + "? Future forwards and replies from this address will stop.")) return;
    setBusy(true); setStatus("");
    try {
      await call("DELETE", { id: item.id });
      setStatus("Removed forwarding for " + item.email + ".");
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to remove forwarding address.");
    } finally { setBusy(false); }
  }

  function toggleNew(inbox: string) {
    setNewForwarder(current => ({
      ...current,
      inboxes: current.inboxes.includes(inbox)
        ? current.inboxes.filter(x => x !== inbox)
        : [...current.inboxes, inbox],
    }));
  }

  function edit(id: string, changes: Partial<Forwarder>) {
    setForwarders(current => current.map(item => item.id === id ? { ...item, ...changes } : item));
  }

  return (
    <section className="form-card" aria-label="Email forwarding settings">
      <h2>Email Forwarding</h2>
      <p className="section-copy">
        Forward organization messages to approved email addresses. Reply from your own Gmail
        and Camp Rise Again will send the response from the original organization inbox,
        followed by the name and title shown below.
      </p>
      <p className="section-copy">
        Every added email address must confirm a verification link before receiving messages.
        You can disable or remove forwarding at any time.
      </p>

      {loading ? <p>Loading forwarding settings…</p> : forwarders.map(item => (
        <div className="card" key={item.id} style={{ marginBottom: 16 }}>
          <strong style={{ display: "block", overflowWrap: "anywhere" }}>{item.email}</strong>
          <p style={{ margin: "6px 0 16px", fontSize: 14 }}>
            {item.verified_at ? (item.enabled ? "Verified · Forwarding on" : "Verified · Paused") : "Awaiting email verification"}
          </p>
          <div className="field-grid">
            <div className="field">
              <label htmlFor={"forward-name-" + item.id}>Reply signature name</label>
              <input id={"forward-name-" + item.id} value={item.display_name}
                maxLength={100} onChange={e => edit(item.id, { display_name: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor={"forward-title-" + item.id}>Title</label>
              <input id={"forward-title-" + item.id} value={item.title}
                maxLength={120} onChange={e => edit(item.id, { title: e.target.value })} />
            </div>
          </div>
          <fieldset style={{ marginBottom: 14 }}>
            <legend>Forward these inboxes</legend>
            <div className="checks">
              {inboxes.map(box => (
                <label key={box.id}>
                  <input type="checkbox" checked={item.inboxes.includes(box.id)}
                    onChange={() => edit(item.id, {
                      inboxes: item.inboxes.includes(box.id)
                        ? item.inboxes.filter(x => x !== box.id)
                        : [...item.inboxes, box.id],
                    })} />
                  {box.label}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="checks" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <input type="checkbox" disabled={!item.verified_at}
              checked={item.enabled}
              onChange={e => edit(item.id, { enabled: e.target.checked })} />
            Forwarding enabled
          </label>
          <div className="actions">
            <button className="btn btn-primary" type="button" disabled={busy}
              onClick={() => void save(item)}>Save</button>
            {!item.verified_at && (
              <button className="btn btn-secondary" type="button" disabled={busy}
                onClick={() => void resendVerification(item)}>Send Verification</button>
            )}
            <button className="btn btn-secondary" type="button" disabled={busy}
              onClick={() => void remove(item)}>Remove</button>
          </div>
        </div>
      ))}

      <form onSubmit={add} style={{ borderTop: "1px solid rgba(0,0,0,.12)", paddingTop: 18, marginTop: 24 }}>
        <h3>Add Forwarding Email</h3>
        <div className="field">
          <label htmlFor="new-forward-email">Email address</label>
          <input id="new-forward-email" type="email" required value={newForwarder.email}
            onChange={e => setNewForwarder({ ...newForwarder, email: e.target.value })} />
        </div>
        <div className="field-grid">
          <div className="field">
            <label htmlFor="new-forward-name">Full name</label>
            <input id="new-forward-name" required maxLength={100} value={newForwarder.display_name}
              onChange={e => setNewForwarder({ ...newForwarder, display_name: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="new-forward-title">Signature title</label>
            <input id="new-forward-title" maxLength={120} value={newForwarder.title}
              onChange={e => setNewForwarder({ ...newForwarder, title: e.target.value })} />
          </div>
        </div>
        <fieldset>
          <legend>Choose inboxes</legend>
          <div className="checks">{inboxes.map(box => (
            <label key={box.id}><input type="checkbox" checked={newForwarder.inboxes.includes(box.id)}
              onChange={() => toggleNew(box.id)} />{box.label}</label>
          ))}</div>
        </fieldset>
        <button className="btn btn-primary" type="submit"
          disabled={busy || newForwarder.inboxes.length === 0}>
          {busy ? "Saving…" : "Add & Send Verification"}
        </button>
      </form>
      {status && <p className="status" role="status" aria-live="polite">{status}</p>}
    </section>
  );
}
