"use client";

import { DragEvent, FormEvent, useEffect, useMemo, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import TeamAdmin from "@/components/TeamAdmin";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

const ADMINS = ["schofieldtierra@gmail.com", "zanibethel@gmail.com"];

type AdminSection = "home" | "resources" | "staff";

type Settings = {
  id: number;
  announcement: string;
  hero_lead: string;
  about_heading: string;
  fall_details: string;
  spring_details: string;
  contact_heading: string;
  contact_copy: string;
};

type ScheduleItem = {
  id: number;
  day_label: string;
  time_label: string;
  title: string;
  details: string;
  sort_order: number;
};

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

const defaults: Settings = {
  id: 1,
  announcement: "",
  hero_lead: "Camp Rise Again is an adult camp created for individuals who are currently struggling with depression and may be feeling isolated, overwhelmed, hopeless, or disconnected from life.",
  about_heading: "A safe, supportive place to reconnect with life and with others.",
  fall_details: "Fall camp details, dates, location, and capacity will be added here.",
  spring_details: "Spring camp details, dates, location, and capacity will be added here.",
  contact_heading: "Questions before you apply?",
  contact_copy: "Send us a message and your email app will open with your answers already included so you can review and send it directly.",
};

export default function AdminPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [email, setEmail] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [activeSection, setActiveSection] = useState<AdminSection>("home");
  const [settings, setSettings] = useState<Settings>(defaults);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [editingResourceId, setEditingResourceId] = useState<number | null>(null);
  const [draggingResourceId, setDraggingResourceId] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadContent() {
    if (!supabase) return;
    const [{ data: settingsData }, { data: scheduleData }, { data: resourceData }] = await Promise.all([
      supabase.from("site_settings").select("*").eq("id", 1).maybeSingle(),
      supabase.from("schedule_items").select("*").order("sort_order").order("id"),
      supabase.from("resources").select("*").order("sort_order").order("id"),
    ]);
    if (settingsData) setSettings(settingsData as Settings);
    if (scheduleData) setSchedule(scheduleData as ScheduleItem[]);
    if (resourceData) setResources(resourceData as ResourceItem[]);
  }

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getUser().then(async ({ data }) => {
      const current = data.user?.email?.toLowerCase() || "";
      if (current && ADMINS.includes(current)) {
        setUserEmail(current);
        await loadContent();
      } else if (data.user) {
        await supabase.auth.signOut();
      }
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const current = session?.user?.email?.toLowerCase() || "";
      if (current && ADMINS.includes(current)) {
        setUserEmail(current);
        await loadContent();
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
    const { error } = await supabase.auth.signInWithOtp({
      email: normalized,
      options: { emailRedirectTo: `${window.location.origin}/admin`, shouldCreateUser: true },
    });
    setStatus(error ? error.message : "Check your email for the secure Camp Rise Again sign-in link.");
  }

  async function saveSettings(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setStatus("Saving homepage updates…");
    const { error } = await supabase.from("site_settings").upsert(settings, { onConflict: "id" });
    setStatus(error ? error.message : "Homepage information saved.");
  }

  async function addScheduleItem() {
    if (!supabase) return;
    const nextOrder = schedule.length ? Math.max(...schedule.map((x) => x.sort_order)) + 10 : 10;
    const { data, error } = await supabase
      .from("schedule_items")
      .insert({ day_label: "Day 1", time_label: "9:00 AM", title: "New activity", details: "", sort_order: nextOrder })
      .select("*")
      .single();
    if (error) setStatus(error.message);
    else setSchedule([...schedule, data as ScheduleItem]);
  }

  async function saveScheduleItem(item: ScheduleItem) {
    if (!supabase) return;
    const { error } = await supabase.from("schedule_items").update({
      day_label: item.day_label,
      time_label: item.time_label,
      title: item.title,
      details: item.details,
      sort_order: item.sort_order,
    }).eq("id", item.id);
    setStatus(error ? error.message : `Saved: ${item.title}`);
  }

  async function deleteScheduleItem(id: number) {
    if (!supabase) return;
    const { error } = await supabase.from("schedule_items").delete().eq("id", id);
    if (error) setStatus(error.message);
    else setSchedule(schedule.filter((x) => x.id !== id));
  }

  async function addResource() {
    if (!supabase) return;
    const nextOrder = resources.length ? Math.max(...resources.map((x) => x.sort_order)) + 10 : 10;
    const { data, error } = await supabase
      .from("resources")
      .insert({
        title: "New resource",
        description: "",
        href: "https://",
        action_label: "Learn More",
        category: "Support resource",
        is_active: false,
        sort_order: nextOrder,
      })
      .select("*")
      .single();

    if (error) {
      setStatus(error.message);
      return;
    }

    const item = data as ResourceItem;
    setResources([...resources, item]);
    setEditingResourceId(item.id);
    setStatus("New resource added. Finish the details below, then save it when ready.");
  }

  async function saveResource(item: ResourceItem) {
    if (!supabase) return;
    const href = item.href.trim();
    if (!/^https?:\/\//i.test(href)) {
      setStatus(`Please enter a full http:// or https:// URL for ${item.title}.`);
      return;
    }

    const { error } = await supabase.from("resources").update({
      title: item.title.trim(),
      description: item.description.trim(),
      href,
      action_label: item.action_label.trim() || "Learn More",
      category: item.category.trim() || "Support resource",
      is_active: item.is_active,
      sort_order: item.sort_order,
    }).eq("id", item.id);

    if (error) {
      setStatus(error.message);
    } else {
      setEditingResourceId(null);
      setStatus(`Saved resource: ${item.title}`);
    }
  }

  async function deleteResource(id: number) {
    if (!supabase) return;
    const item = resources.find((x) => x.id === id);
    if (!window.confirm(`Delete ${item?.title || "this resource"}?`)) return;
    const { error } = await supabase.from("resources").delete().eq("id", id);
    if (error) setStatus(error.message);
    else {
      setResources(resources.filter((x) => x.id !== id));
      if (editingResourceId === id) setEditingResourceId(null);
      setStatus("Resource deleted.");
    }
  }

  async function persistResourceOrder(nextResources: ResourceItem[]) {
    if (!supabase) return;
    setStatus("Saving resource order…");
    const reordered = nextResources.map((item, index) => ({ ...item, sort_order: (index + 1) * 10 }));
    setResources(reordered);

    const results = await Promise.all(
      reordered.map((item) => supabase.from("resources").update({ sort_order: item.sort_order }).eq("id", item.id))
    );
    const failed = results.find((result) => result.error);
    setStatus(failed?.error ? failed.error.message : "Resource order saved.");
  }

  function handleResourceDrop(targetId: number) {
    if (draggingResourceId === null || draggingResourceId === targetId) {
      setDraggingResourceId(null);
      return;
    }

    const next = [...resources];
    const fromIndex = next.findIndex((item) => item.id === draggingResourceId);
    const toIndex = next.findIndex((item) => item.id === targetId);
    if (fromIndex < 0 || toIndex < 0) return;

    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    setDraggingResourceId(null);
    void persistResourceOrder(next);
  }

  function allowDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUserEmail("");
    setStatus("");
  }

  if (!supabase) {
    return <><SiteHeader /><main className="form-wrap"><h1>Admin setup pending</h1><p className="section-copy">The secure admin page is installed, but its Supabase connection still needs to be configured.</p></main></>;
  }

  if (loading) return <><SiteHeader /><main className="form-wrap"><p>Loading admin…</p></main></>;

  if (!userEmail) {
    return <><SiteHeader /><main className="form-wrap"><div className="eyebrow">Administration</div><h1>Camp Rise Again Admin</h1><p className="section-copy">Authorized administrators can sign in with a secure link sent to their email address.</p><form className="form-card" onSubmit={sendLogin}><div className="field"><label htmlFor="email">Admin email</label><input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div><button className="btn btn-primary">Email Me a Sign-In Link</button>{status && <div className="status" aria-live="polite">{status}</div>}</form></main></>;
  }

  const adminTabs: { id: AdminSection; label: string; description: string }[] = [
    { id: "home", label: "Home Page", description: "Homepage copy and camp schedule" },
    { id: "resources", label: "Resources Page", description: "Support links and display order" },
    { id: "staff", label: "Meet the Staff", description: "Staff profiles, photos, and visibility" },
  ];

  return (
    <>
      <SiteHeader />
      <main className="form-wrap" style={{ maxWidth: 980 }}>
        <div className="eyebrow">Administration</div>
        <h1>Camp Rise Again Admin</h1>
        <p className="section-copy">Signed in as {userEmail}. Choose the page you want to update below.</p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, margin: "24px 0" }}>
          {adminTabs.map((tab) => {
            const active = activeSection === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => { setActiveSection(tab.id); setStatus(""); }}
                className="card"
                style={{
                  textAlign: "left",
                  cursor: "pointer",
                  border: active ? "2px solid currentColor" : undefined,
                  opacity: active ? 1 : 0.86,
                }}
              >
                <strong style={{ display: "block", fontSize: 18, marginBottom: 6 }}>{tab.label}</strong>
                <span style={{ fontSize: 14, opacity: .8 }}>{tab.description}</span>
              </button>
            );
          })}
        </div>

        <div className="actions" style={{ marginBottom: 24 }}>
          <button className="btn btn-secondary" type="button" onClick={signOut}>Sign Out</button>
        </div>

        {activeSection === "home" && (
          <>
            <form className="form-card" onSubmit={saveSettings}>
              <h2>Home Page</h2>
              <p className="section-copy">Edit the main public homepage information.</p>
              <div className="field"><label>Announcement (optional)</label><input value={settings.announcement} onChange={(e) => setSettings({ ...settings, announcement: e.target.value })} placeholder="Example: Fall applications are now open!" /></div>
              <div className="field"><label>Homepage introduction</label><textarea value={settings.hero_lead} onChange={(e) => setSettings({ ...settings, hero_lead: e.target.value })} /></div>
              <div className="field"><label>About heading</label><input value={settings.about_heading} onChange={(e) => setSettings({ ...settings, about_heading: e.target.value })} /></div>
              <div className="field"><label>Fall season details</label><textarea value={settings.fall_details} onChange={(e) => setSettings({ ...settings, fall_details: e.target.value })} /></div>
              <div className="field"><label>Spring season details</label><textarea value={settings.spring_details} onChange={(e) => setSettings({ ...settings, spring_details: e.target.value })} /></div>
              <div className="field"><label>Contact heading</label><input value={settings.contact_heading} onChange={(e) => setSettings({ ...settings, contact_heading: e.target.value })} /></div>
              <div className="field"><label>Contact description</label><textarea value={settings.contact_copy} onChange={(e) => setSettings({ ...settings, contact_copy: e.target.value })} /></div>
              <button className="btn btn-primary">Save Home Page</button>
            </form>

            <section className="form-card" style={{ marginTop: 24 }}>
              <h2>Camp Schedule</h2>
              <p className="section-copy">Each activity is its own editable card.</p>
              {schedule.map((item, index) => (
                <div key={item.id} className="card" style={{ marginBottom: 16 }}>
                  <div className="field-grid">
                    <div className="field"><label>Day</label><input value={item.day_label} onChange={(e) => setSchedule(schedule.map((x, i) => i === index ? { ...x, day_label: e.target.value } : x))} /></div>
                    <div className="field"><label>Time</label><input value={item.time_label} onChange={(e) => setSchedule(schedule.map((x, i) => i === index ? { ...x, time_label: e.target.value } : x))} /></div>
                  </div>
                  <div className="field"><label>Activity</label><input value={item.title} onChange={(e) => setSchedule(schedule.map((x, i) => i === index ? { ...x, title: e.target.value } : x))} /></div>
                  <div className="field"><label>Details</label><textarea value={item.details || ""} onChange={(e) => setSchedule(schedule.map((x, i) => i === index ? { ...x, details: e.target.value } : x))} /></div>
                  <div className="field"><label>Display order</label><input type="number" value={item.sort_order} onChange={(e) => setSchedule(schedule.map((x, i) => i === index ? { ...x, sort_order: Number(e.target.value) } : x))} /></div>
                  <div className="actions"><button className="btn btn-primary" type="button" onClick={() => saveScheduleItem(item)}>Save Activity</button><button className="btn btn-secondary" type="button" onClick={() => deleteScheduleItem(item.id)}>Delete</button></div>
                </div>
              ))}
              <button className="btn btn-secondary" type="button" onClick={addScheduleItem}>+ Add Schedule Activity</button>
            </section>
          </>
        )}

        {activeSection === "resources" && (
          <section className="form-card">
            <h2>Resources Page</h2>
            <p className="section-copy">Drag the cards into the order you want them displayed. Select Edit to change a resource. Ordering saves automatically.</p>

            <div style={{ marginTop: 22 }}>
              {resources.map((item, index) => {
                const editing = editingResourceId === item.id;
                return (
                  <div
                    key={item.id}
                    className="card"
                    draggable={!editing}
                    onDragStart={() => setDraggingResourceId(item.id)}
                    onDragOver={allowDrop}
                    onDrop={() => handleResourceDrop(item.id)}
                    onDragEnd={() => setDraggingResourceId(null)}
                    style={{
                      marginBottom: 14,
                      opacity: draggingResourceId === item.id ? .55 : 1,
                      cursor: editing ? "default" : "grab",
                    }}
                  >
                    {!editing ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 14, justifyContent: "space-between", flexWrap: "wrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0, flex: "1 1 320px" }}>
                          <span aria-hidden="true" style={{ fontSize: 24, opacity: .7, letterSpacing: -4 }}>☰</span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13, opacity: .72, marginBottom: 3 }}>#{index + 1} · {item.category || "Support resource"}</div>
                            <strong style={{ display: "block", fontSize: 18 }}>{item.title}</strong>
                            <div style={{ fontSize: 13, opacity: .72, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 4 }}>{item.href}</div>
                          </div>
                        </div>
                        <div className="actions" style={{ margin: 0, alignItems: "center" }}>
                          <span style={{ fontSize: 13, fontWeight: 800, opacity: .8 }}>{item.is_active ? "Public" : "Hidden"}</span>
                          <button className="btn btn-secondary" type="button" onClick={() => setEditingResourceId(item.id)}>Edit</button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 18 }}>
                          <h3 style={{ margin: 0 }}>Edit Resource</h3>
                          <button className="btn btn-secondary" type="button" onClick={() => setEditingResourceId(null)}>Cancel</button>
                        </div>
                        <div className="field-grid">
                          <div className="field"><label>Resource name</label><input value={item.title} onChange={(e) => setResources(resources.map((x) => x.id === item.id ? { ...x, title: e.target.value } : x))} /></div>
                          <div className="field"><label>Category</label><input value={item.category} onChange={(e) => setResources(resources.map((x) => x.id === item.id ? { ...x, category: e.target.value } : x))} placeholder="Community support" /></div>
                        </div>
                        <div className="field"><label>Description</label><textarea value={item.description} onChange={(e) => setResources(resources.map((x) => x.id === item.id ? { ...x, description: e.target.value } : x))} /></div>
                        <div className="field"><label>Website URL</label><input type="url" value={item.href} onChange={(e) => setResources(resources.map((x) => x.id === item.id ? { ...x, href: e.target.value } : x))} placeholder="https://example.org" /></div>
                        <div className="field"><label>Button text</label><input value={item.action_label} onChange={(e) => setResources(resources.map((x) => x.id === item.id ? { ...x, action_label: e.target.value } : x))} placeholder="Learn More" /></div>
                        <label style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 800, margin: "8px 0 18px", color: "var(--forest)" }}><input style={{ width: "auto" }} type="checkbox" checked={item.is_active} onChange={(e) => setResources(resources.map((x) => x.id === item.id ? { ...x, is_active: e.target.checked } : x))} /> Show publicly</label>
                        <div className="actions"><button className="btn btn-primary" type="button" onClick={() => saveResource(item)}>Save Resource</button><button className="btn btn-secondary" type="button" onClick={() => deleteResource(item.id)}>Delete</button></div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <button className="btn btn-secondary" type="button" onClick={addResource} style={{ width: "100%", marginTop: 8 }}>+ Add New Resource</button>
          </section>
        )}

        {activeSection === "staff" && <TeamAdmin />}

        {status && <div className="status" aria-live="polite" style={{ marginTop: 20 }}>{status}</div>}
      </main>
    </>
  );
}
