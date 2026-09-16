"use client";

import { DragEvent, FormEvent, useEffect, useMemo, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import HomeAdmin from "@/components/HomeAdmin";
import TeamAdmin from "@/components/TeamAdmin";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

const ADMINS = ["schofieldtierra@gmail.com", "zanibethel@gmail.com"];
type AdminSection = "home" | "resources" | "staff";

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

  async function loadResources() {
    if (!supabase) return;
    const { data } = await supabase.from("resources").select("*").order("sort_order").order("id");
    if (data) setResources(data as ResourceItem[]);
  }

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    supabase.auth.getUser().then(async ({ data }) => {
      const current = data.user?.email?.toLowerCase() || "";
      if (current && ADMINS.includes(current)) {
        setUserEmail(current);
        await loadResources();
      } else if (data.user) {
        await supabase.auth.signOut();
      }
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const current = session?.user?.email?.toLowerCase() || "";
      if (current && ADMINS.includes(current)) {
        setUserEmail(current);
        await loadResources();
      } else {
        setUserEmail("");
      }
    });
    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  async function sendLogin(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    const normalized = email.trim().toLowerCase();
    if (!ADMINS.includes(normalized)) {
      setStatus("That email is not authorized for Camp Rise Again administration.");
      return;
    }
    setStatus("Sending secure sign-in link…");
    const { error } = await supabase.auth.signInWithOtp({ email: normalized, options: { emailRedirectTo: `${window.location.origin}/admin`, shouldCreateUser: true } });
    setStatus(error ? error.message : "Check your email for the secure Camp Rise Again sign-in link.");
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
    return <><SiteHeader /><main className="form-wrap"><div className="eyebrow">Administration</div><h1>Camp Rise Again Admin</h1><p className="section-copy">Authorized administrators can sign in with a secure link sent to their email address.</p><form className="form-card" onSubmit={sendLogin}><div className="field"><label htmlFor="email">Admin email</label><input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div><button className="btn btn-primary">Email Me a Sign-In Link</button>{status && <div className="status" aria-live="polite">{status}</div>}</form></main></>;
  }

  const tabs: { id: AdminSection; label: string; description: string }[] = [
    { id: "home", label: "Home Page", description: "Sections, logo, copy, and display order" },
    { id: "resources", label: "Resources Page", description: "Support links and display order" },
    { id: "staff", label: "Meet the Staff", description: "Staff profiles, photos, and visibility" },
  ];

  return (
    <><SiteHeader /><main className="form-wrap" style={{ maxWidth: 980 }}>
      <div className="eyebrow">Administration</div><h1>Camp Rise Again Admin</h1><p className="section-copy">Signed in as {userEmail}. Choose the page you want to update below.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, margin: "24px 0" }}>
        {tabs.map((tab) => { const active = activeSection === tab.id; return <button key={tab.id} type="button" onClick={() => { setActiveSection(tab.id); setStatus(""); }} className="card" style={{ textAlign: "left", cursor: "pointer", border: active ? "2px solid currentColor" : undefined, opacity: active ? 1 : .86 }}><strong style={{ display: "block", fontSize: 18, marginBottom: 6 }}>{tab.label}</strong><span style={{ fontSize: 14, opacity: .8 }}>{tab.description}</span></button>; })}
      </div>
      <div className="actions" style={{ marginBottom: 24 }}><button className="btn btn-secondary" type="button" onClick={signOut}>Sign Out</button></div>

      {activeSection === "home" && <HomeAdmin />}

      {activeSection === "resources" && <section className="form-card"><h2>Resources Page</h2><p className="section-copy">Drag the cards into the order you want them displayed. Select Edit to change a resource. Ordering saves automatically.</p><div style={{ marginTop: 22 }}>
        {resources.map((item, index) => { const editing = editingResourceId === item.id; return <div key={item.id} className="card" draggable={!editing} onDragStart={() => setDraggingResourceId(item.id)} onDragOver={allowDrop} onDrop={() => handleResourceDrop(item.id)} onDragEnd={() => setDraggingResourceId(null)} style={{ marginBottom: 14, opacity: draggingResourceId === item.id ? .55 : 1, cursor: editing ? "default" : "grab" }}>
          {!editing ? <div style={{ display: "flex", alignItems: "center", gap: 14, justifyContent: "space-between", flexWrap: "wrap" }}><div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0, flex: "1 1 320px" }}><span aria-hidden="true" style={{ fontSize: 24, opacity: .7, letterSpacing: -4 }}>☰</span><div style={{ minWidth: 0 }}><div style={{ fontSize: 13, opacity: .72, marginBottom: 3 }}>#{index + 1} · {item.category || "Support resource"}</div><strong style={{ display: "block", fontSize: 18 }}>{item.title}</strong><div style={{ fontSize: 13, opacity: .72, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 4 }}>{item.href}</div></div></div><div className="actions" style={{ margin: 0, alignItems: "center" }}><span style={{ fontSize: 13, fontWeight: 800, opacity: .8 }}>{item.is_active ? "Public" : "Hidden"}</span><button className="btn btn-secondary" type="button" onClick={() => setEditingResourceId(item.id)}>Edit</button></div></div>
          : <div><div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 18 }}><h3 style={{ margin: 0 }}>Edit Resource</h3><button className="btn btn-secondary" type="button" onClick={() => setEditingResourceId(null)}>Cancel</button></div><div className="field-grid"><div className="field"><label>Resource name</label><input value={item.title} onChange={(e) => setResources(resources.map((x) => x.id === item.id ? { ...x, title: e.target.value } : x))} /></div><div className="field"><label>Category</label><input value={item.category} onChange={(e) => setResources(resources.map((x) => x.id === item.id ? { ...x, category: e.target.value } : x))} /></div></div><div className="field"><label>Description</label><textarea value={item.description} onChange={(e) => setResources(resources.map((x) => x.id === item.id ? { ...x, description: e.target.value } : x))} /></div><div className="field"><label>Website URL</label><input type="url" value={item.href} onChange={(e) => setResources(resources.map((x) => x.id === item.id ? { ...x, href: e.target.value } : x))} /></div><div className="field"><label>Button text</label><input value={item.action_label} onChange={(e) => setResources(resources.map((x) => x.id === item.id ? { ...x, action_label: e.target.value } : x))} /></div><label style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 800, margin: "8px 0 18px", color: "var(--forest)" }}><input style={{ width: "auto" }} type="checkbox" checked={item.is_active} onChange={(e) => setResources(resources.map((x) => x.id === item.id ? { ...x, is_active: e.target.checked } : x))} /> Show publicly</label><div className="actions"><button className="btn btn-primary" type="button" onClick={() => saveResource(item)}>Save Resource</button><button className="btn btn-secondary" type="button" onClick={() => deleteResource(item.id)}>Delete</button></div></div>}
        </div>; })}</div><button className="btn btn-secondary" type="button" onClick={addResource} style={{ width: "100%", marginTop: 8 }}>+ Add New Resource</button></section>}

      {activeSection === "staff" && <TeamAdmin />}
      {status && <div className="status" aria-live="polite" style={{ marginTop: 20 }}>{status}</div>}
    </main></>
  );
}
