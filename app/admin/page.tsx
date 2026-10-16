"use client";

import { DragEvent, FormEvent, useEffect, useMemo, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import HomeAdmin from "@/components/HomeAdmin";
import TeamAdmin from "@/components/TeamAdmin";
import MemorialGalleryAdmin from "@/components/MemorialGalleryAdmin";
import VisitorAnalyticsAdmin from "@/components/VisitorAnalyticsAdmin";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

const ADMINS = ["schofieldtierra@gmail.com", "zanibethel@gmail.com"];
type AdminSection = "home" | "memorial" | "resources" | "staff" | "analytics";

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
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
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

  function authorizedEmail() {
    const normalized = email.trim().toLowerCase();
    if (!ADMINS.includes(normalized)) {
      setStatus("Only authorized Camp Rise Again administrators can use this login.");
      return null;
    }
    return normalized;
  }

  async function signInWithPassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase || authBusy) return;
    const normalized = authorizedEmail();
    if (!normalized) return;

    setAuthBusy(true);
    setStatus("");
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalized,
        password,
      });
      if (error) {
        setStatus("Email or password not recognized. If you have not created a password yet, use Forgot password to set one, or sign in using an email link.");
        return;
      }
      const signedInEmail = data.user?.email?.toLowerCase() || "";
      if (!ADMINS.includes(signedInEmail)) {
        await supabase.auth.signOut();
        setStatus("This account is not authorized to administer Camp Rise Again.");
        return;
      }
      setPassword("");
      setUserEmail(signedInEmail);
      setStatus("");
    } catch {
      setStatus("Could not sign in right now. Try again or use an email sign-in link.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function sendLogin() {
    if (!supabase || authBusy) return;
    const normalized = authorizedEmail();
    if (!normalized) return;

    setAuthBusy(true);
    setStatus("Sending secure sign-in link…");
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: normalized,
        options: {
          emailRedirectTo: `${window.location.origin}/admin`,
          shouldCreateUser: false,
        },
      });
      setStatus(error ? "Unable to send the sign-in email. Please try again shortly." : "Check your email for a secure sign-in link. Open it in this browser if possible. Older links cannot be reused.");
    } catch {
      setStatus("Could not request a sign-in link. Please try again.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function requestPasswordReset(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase || authBusy) return;
    const normalized = authorizedEmail();
    if (!normalized) return;

    setAuthBusy(true);
    setStatus("");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(normalized, {
        redirectTo: `${window.location.origin}/admin/reset-password`,
      });
      if (error) {
        setStatus("The recovery email could not be sent right now. Please try again shortly.");
        return;
      }
      setStatus("If this admin account is registered, an email with a password-creation link is on its way. Open that link to create your password; it will open a separate secure form.");
    } catch {
      setStatus("The recovery email could not be sent right now. Please try again shortly.");
    } finally {
      setAuthBusy(false);
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
    return (
      <>
        <SiteHeader />
        <main className="form-wrap">
          <div className="eyebrow">Administration</div>
          <h1>Camp Rise Again Admin</h1>
          <p className="section-copy">Authorized administrators can sign in with a password or request a secure email link.</p>

          {forgotPasswordMode ? (
            <form className="form-card admin-login-card" onSubmit={requestPasswordReset}>
              <h2>Create or Reset Your Password</h2>
              <p className="section-copy">Enter your admin email. We will send a recovery link that opens a secure form where you can create a new password.</p>
              <div className="field">
                <label htmlFor="recovery-email">Admin email</label>
                <input id="recovery-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" required disabled={authBusy} />
              </div>
              <div className="admin-login-actions">
                <button className="btn btn-primary" type="submit" disabled={authBusy}>{authBusy ? "Sending…" : "Send Password Reset Link"}</button>
                <button className="btn btn-secondary" type="button" disabled={authBusy} onClick={() => { setForgotPasswordMode(false); setStatus(""); }}>Back to Sign In</button>
              </div>
              {status && <p className="status" role="status" aria-live="polite">{status}</p>}
              <p className="section-copy admin-login-hint">For security, the email is only sent to the registered admin account. If the link opens in a different browser, you may need to sign in there after setting your password.</p>
            </form>
          ) : (
            <form className="form-card admin-login-card" onSubmit={signInWithPassword}>
              <h2>Admin Sign In</h2>
              <div className="field">
                <label htmlFor="admin-email">Admin email</label>
                <input id="admin-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" inputMode="email" required disabled={authBusy} />
              </div>
              <div className="field">
                <label htmlFor="admin-password">Password</label>
                <div className="admin-password-field">
                  <input id="admin-password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required disabled={authBusy} />
                  <button className="admin-show-password" type="button" disabled={authBusy} onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? "Hide" : "Show"}</button>
                </div>
              </div>
              <div className="admin-login-forgot">
                <button type="button" onClick={() => { setForgotPasswordMode(true); setStatus(""); setPassword(""); }} disabled={authBusy}>Forgot password? / Create one</button>
              </div>
              <div className="admin-login-actions">
                <button className="btn btn-primary" type="submit" disabled={authBusy}>{authBusy ? "Signing in…" : "Sign In with Password"}</button>
                <span className="admin-login-or">or</span>
                <button className="btn btn-secondary" type="button" onClick={() => void sendLogin()} disabled={authBusy}>{authBusy ? "Please wait…" : "Email Me a Sign-In Link"}</button>
              </div>
              {status && <p className="status" role="status" aria-live="polite">{status}</p>}
              <div className="admin-login-footer">
                <button className="btn btn-secondary" type="button" onClick={resetSignIn} disabled={authBusy}>Reset Sign-In Session</button>
                <p className="section-copy admin-login-hint">New to password sign-in? Choose <strong>Forgot password? / Create one</strong> to set your first password. Email links will continue to work.</p>
              </div>
            </form>
          )}
        </main>
      </>
    );
  }

  const tabs: { id: AdminSection; label: string; description: string }[] = [
    { id: "analytics", label: "Visitor Analytics", description: "Visitors, page views, trends, and top pages" },
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
      {activeSection === "analytics" && <VisitorAnalyticsAdmin />}
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
