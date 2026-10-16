"use client";

import { DragEvent, FormEvent, useEffect, useMemo, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import HomeAdmin from "@/components/HomeAdmin";
import TeamAdmin from "@/components/TeamAdmin";
import MemorialGalleryAdmin from "@/components/MemorialGalleryAdmin";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

const ADMINS = ["schofieldtierra@gmail.com", "zanibethel@gmail.com"];
type AdminSection = "home" | "memorial" | "resources" | "staff";

type ResourceItem = {
  id: number;
  title: string;
  description: string;
  href: string;
  action_label: string;
  category: string;
  is_active: boolean;
  sort_order: number;
};

export default function AdminPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [email, setEmail] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [activeSection, setActiveSection] = useState<AdminSection>("home");
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [editingResourceId, setEditingResourceId] = useState<number | null>(null);
  const [draggingResourceId, setDraggingResourceId] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  // Recover a session (including the result of an email-link redirect)
  // before subscribing to auth changes. Subscribing while the SDK is still
  // initializing caused indefinite hangs on mobile in older auth-js builds.
  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    const timeout = window.setTimeout(() => {
      if (!active) return;
      setLoading(false);
      setStatus("We could not finish checking your sign-in. Use Reset Sign-In below, then request a new link.");
    }, 12000);

    async function initializeAuth() {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (!active) return;
        const current = data.user?.email?.toLowerCase() || "";
        setUserEmail(ADMINS.includes(current) ? current : "");
        if (error && error.name !== "AuthSessionMissingError") {
          setStatus("Your sign-in could not be restored. Try a fresh email sign-in link.");
        } else {
          setStatus("");
        }
      } catch {
        if (active) setStatus("Your sign-in could not be restored. Try resetting the sign-in session.");
      } finally {
        if (!active) return;
        window.clearTimeout(timeout);
        setLoading(false);

        // Do not perform async requests inside this callback.
        const { data } = supabase.auth.onAuthStateChange((_event, session) => {
          if (!active) return;
          const current = session?.user?.email?.toLowerCase() || "";
          setUserEmail(ADMINS.includes(current) ? current : "");
        });
        unsubscribe = () => data.subscription.unsubscribe();
      }
    }

    void initializeAuth();
    return () => {
      active = false;
      window.clearTimeout(timeout);
      unsubscribe?.();
    };
  }, [supabase]);

  function resetSignIn() {
    // Clear only this site's own browser session; never touch the shared
    // Supabase project's users, tokens on other devices, or team records.
    try {
      window.localStorage.removeItem("sb-yufptpfiwdbzzrvhkvux-auth-token");
    } catch {
      // A blocked localStorage is not a reason to trap the admin on this page.
    }
    window.location.assign("/admin");
  }

  // Run database queries in a separate effect, after the synchronous auth
  // callback has returned. RLS still verifies every operation server-side.
  useEffect(() => {
    if (!supabase || !userEmail) {
      setResources([]);
      return;
    }

    let active = true;
    async function loadResources() {
      try {
        const { data, error } = await supabase
          .from("resources")
          .select("*")
          .order("sort_order")
          .order("id");
        if (!active) return;
        if (error) throw error;
        setResources((data || []) as ResourceItem[]);
      } catch (error) {
        if (!active) return;
        const message = error instanceof Error ? error.message : "Unknown error";
        setStatus(`Resources could not load: ${message}`);
      }
    }

    void loadResources();
    return () => { active = false; };
  }, [supabase, userEmail]);

  async function sendLogin(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    const normalized = email.trim().toLowerCase();
    if (!ADMINS.includes(normalized)) {
      setStatus("That email is not authorized for Camp Rise Again administration.");
      return;
    }
    setStatus("Sending secure sign-in link…");
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: normalized,
        options: {
          emailRedirectTo: `${window.location.origin}/admin`,
          shouldCreateUser: false,
        },
      });
      setStatus(error ? error.message : "Check your email for the newest sign-in link. It works once, and must open in the same browser where you'll use Admin.");
    } catch {
      setStatus("Could not request a sign-in link. Reset Sign-In and try again.");
    }
  }

  async function addResource() {
    if (!supabase) return;
    const nextOrder = resources.length ? Math.max(...resources.map((x) => x.sort_order)) + 10 : 10;
    const { data, error } = await supabase.from("resources").insert({ title: "New resource", description: "", href: "https://", action_label: "Learn More", category: "Support resource", is_active: false, sort_order: nextOrder }).select("*").single();
    if (error) { setStatus(error.message); return; }
    const item = data as ResourceItem;
    setResources([...resources, item]);
    setEditingResourceId(item.id);
    setStatus("New resource added. Finish the details below, then save it when ready.");
  }

  async function saveResource(item: ResourceItem) {
    if (!supabase) return;
    const href = item.href.trim();
    if (!/^https?:\/\//i.test(href)) { setStatus(`Please enter a full http:// or https:// URL for ${item.title}.`); return; }
    const { error } = await supabase.from("resources").update({ title: item.title.trim(), description: item.description.trim(), href, action_label: item.action_label.trim() || "Learn More", category: item.category.trim() || "Support resource", is_active: item.is_active, sort_order: item.sort_order }).eq("id", item.id);
    if (error) setStatus(error.message); else { setEditingResourceId(null); setStatus(`Saved resource: ${item.title}`); }
  }

  async function deleteResource(id: number) {
    if (!supabase) return;
    const item = resources.find((x) => x.id === id);
    if (!window.confirm(`Delete ${item?.title || "this resource"}?`)) return;
    const { error } = await supabase.from("resources").delete().eq("id", id);
    if (error) setStatus(error.message); else { setResources(resources.filter((x) => x.id !== id)); setEditingResourceId(null); setStatus("Resource deleted."); }
  }

  async function persistResourceOrder(nextResources: ResourceItem[]) {
    if (!supabase) return;
    const reordered = nextResources.map((item, index) => ({ ...item, sort_order: (index + 1) * 10 }));
    setResources(reordered);
    setStatus("Saving resource order…");
    const results = await Promise.all(reordered.map((item) => supabase.from("resources").update({ sort_order: item.sort_order }).eq("id", item.id)));
    const failed = results.find((result) => result.error);
    setStatus(failed?.error ? failed.error.message : "Resource order saved.");
  }

  function handleResourceDrop(targetId: number) {
    if (draggingResourceId === null || draggingResourceId === targetId) { setDraggingResourceId(null); return; }
    const next = [...resources];
    const fromIndex = next.findIndex((item) => item.id === draggingResourceId);
    const toIndex = next.findIndex((item) => item.id === targetId);
    if (fromIndex < 0 || toIndex < 0) return;
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    setDraggingResourceId(null);
    void persistResourceOrder(next);
  }

  function allowDrop(e: DragEvent<HTMLDivElement>) { e.preventDefault(); }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUserEmail("");
    setStatus("");
  }

  if (!supabase) return <><SiteHeader /><main className="form-wrap"><h1>Admin setup pending</h1><p className="section-copy">The secure admin page is installed, but its Supabase connection still needs to be configured.</p></main></>;
  if (loading) return <><SiteHeader /><main className="form-wrap"><p>Loading admin…</p></main></>;

  if (!userEmail) {
    return <><SiteHeader /><main className="form-wrap"><div className="eyebrow">Administration</div><h1>Camp Rise Again Admin</h1><p className="section-copy">Authorized administrators can sign in with a secure link sent to their email address.</p><form className="form-card" onSubmit={sendLogin}><div className="field"><label htmlFor="email">Admin email</label><input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div><button className="btn btn-primary">Email Me a Sign-In Link</button>{status && <div className="status" role="status" aria-live="polite">{status}</div>}<div className="actions" style={{ marginTop: 12 }}><button className="btn btn-secondary" type="button" onClick={resetSignIn}>Reset Sign-In</button></div><p className="section-copy" style={{ fontSize: 14, marginBottom: 0 }}>If the email opens inside Gmail or another app, open the link in your regular browser. Old links cannot be reused.</p></form></main></>;
  }

  const tabs: { id: AdminSection; label: string; description: string }[] = [
    { id: "home", label: "Home Page", description: "Sections, logo, copy, and display order" },
    { id: "memorial", label: "Michael’s Photos", description: "Upload, arrange, and caption his story photos" },
    { id: "resources", label: "Resources Page", description: "Support links and display order" },
    { id: "staff", label: "Meet the Staff", description: "Staff profiles, photos, and visibility" },
  ];

  return (
    <><SiteHeader /><main className="form-wrap" style={{ maxWidth: 980 }}>
      <div className="eyebrow">Administration</div><h1>Camp Rise Again Admin</h1><p className="section-copy">Signed in as {userEmail}. Choose the page you want to update below.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, margin: "24px 0" }}>
        {tabs.map((tab) => { const active = activeSection === tab.id; return <button key={tab.id} type="button" onClick={() => { setActiveSection(tab.id); setStatus(""); window.requestAnimationFrame(() => document.getElementById("admin-section-content")?.scrollIntoView({ behavior: "smooth", block: "start" })); }} className="card" style={{ textAlign: "left", cursor: "pointer", border: active ? "2px solid currentColor" : undefined, opacity: active ? 1 : .86 }}><strong style={{ display: "block", fontSize: 18, marginBottom: 6 }}>{tab.label}</strong><span style={{ fontSize: 14, opacity: .8 }}>{tab.description}</span></button>; })}
      </div>
      <div className="actions" style={{ marginBottom: 24 }}><a className="btn btn-primary" href="/" target="_blank" rel="noreferrer">Preview Site ↗</a><button className="btn btn-secondary" type="button" onClick={signOut}>Sign Out</button></div>

      <div id="admin-section-content" style={{ scrollMarginTop: 20 }}>
      {activeSection === "home" && <HomeAdmin />}

      {activeSection === "memorial" && <section className="form-card" aria-label="Michael’s photos editor"><h2>Michael’s Photos</h2><p className="section-copy">Upload multiple photos and place them throughout Michael’s story. Add captions, change positions, and rearrange or hide individual photos. Changes save directly to the website without changing his main portrait.</p><div className="actions" style={{ marginBottom: 20 }}><a className="btn btn-secondary" href="/michael-garza" target="_blank" rel="noreferrer">View Our Story ↗</a></div><MemorialGalleryAdmin /></section>}

      {activeSection === "resources" && <section className="form-card"><h2>Resources Page</h2><p className="section-copy">Drag the cards into the order you want them displayed. Select Edit to change a resource. Ordering saves automatically.</p><div style={{ marginTop: 22 }}>
        {resources.map((item, index) => { const editing = editingResourceId === item.id; return <div key={item.id} className="card" draggable={!editing} onDragStart={() => setDraggingResourceId(item.id)} onDragOver={allowDrop} onDrop={() => handleResourceDrop(item.id)} onDragEnd={() => setDraggingResourceId(null)} style={{ marginBottom: 14, opacity: draggingResourceId === item.id ? .55 : 1, cursor: editing ? "default" : "grab" }}>
          {!editing ? <div style={{ display: "flex", alignItems: "center", gap: 14, justifyContent: "space-between", flexWrap: "wrap" }}><div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0, flex: "1 1 320px" }}><span aria-hidden="true" style={{ fontSize: 24, opacity: .7, letterSpacing: -4 }}>☰</span><div style={{ minWidth: 0 }}><div style={{ fontSize: 13, opacity: .72, marginBottom: 3 }}>#{index + 1} · {item.category || "Support resource"}</div><strong style={{ display: "block", fontSize: 18 }}>{item.title}</strong><div style={{ fontSize: 13, opacity: .72, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 4 }}>{item.href}</div></div></div><div className="actions" style={{ margin: 0, alignItems: "center" }}><span style={{ fontSize: 13, fontWeight: 800, opacity: .8 }}>{item.is_active ? "Public" : "Hidden"}</span><button className="btn btn-secondary" type="button" onClick={() => setEditingResourceId(item.id)}>Edit</button></div></div>
          : <div><div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 18 }}><h3 style={{ margin: 0 }}>Edit Resource</h3><button className="btn btn-secondary" type="button" onClick={() => setEditingResourceId(null)}>Cancel</button></div><div className="field-grid"><div className="field"><label>Resource name</label><input value={item.title} onChange={(e) => setResources(resources.map((x) => x.id === item.id ? { ...x, title: e.target.value } : x))} /></div><div className="field"><label>Category</label><input value={item.category} onChange={(e) => setResources(resources.map((x) => x.id === item.id ? { ...x, category: e.target.value } : x))} /></div></div><div className="field"><label>Description</label><textarea value={item.description} onChange={(e) => setResources(resources.map((x) => x.id === item.id ? { ...x, description: e.target.value } : x))} /></div><div className="field"><label>Website URL</label><input type="url" value={item.href} onChange={(e) => setResources(resources.map((x) => x.id === item.id ? { ...x, href: e.target.value } : x))} /></div><div className="field"><label>Button text</label><input value={item.action_label} onChange={(e) => setResources(resources.map((x) => x.id === item.id ? { ...x, action_label: e.target.value } : x))} /></div><label style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 800, margin: "8px 0 18px", color: "var(--forest)" }}><input style={{ width: "auto" }} type="checkbox" checked={item.is_active} onChange={(e) => setResources(resources.map((x) => x.id === item.id ? { ...x, is_active: e.target.checked } : x))} /> Show publicly</label><div className="actions"><button className="btn btn-primary" type="button" onClick={() => saveResource(item)}>Save Resource</button><button className="btn btn-secondary" type="button" onClick={() => deleteResource(item.id)}>Delete</button></div></div>}
        </div>; })}</div><button className="btn btn-secondary" type="button" onClick={addResource} style={{ width: "100%", marginTop: 8 }}>+ Add New Resource</button></section>}

      {activeSection === "staff" && <TeamAdmin />}
      </div>
      {status && <div className="status" aria-live="polite" style={{ marginTop: 20 }}>{status}</div>}
    </main></>
  );
}
