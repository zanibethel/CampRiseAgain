"use client";

import { ChangeEvent, DragEvent, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type Settings = {
  id: number;
  announcement: string;
  hero_heading: string;
  hero_lead: string;
  about_heading: string;
  about_copy: string;
  fall_details: string;
  spring_details: string;
  keep_going_heading: string;
  keep_going_copy: string;
  donate_heading: string;
  donate_copy: string;
  gofundme_url: string;
  contact_heading: string;
  contact_copy: string;
  logo_path: string;
  home_section_order: string[];
};

type ScheduleItem = {
  id: number;
  day_label: string;
  time_label: string;
  title: string;
  details: string;
  sort_order: number;
};

type SectionId = "announcement" | "hero" | "about" | "schedule" | "team" | "keep-going" | "donate" | "contact";

const defaultOrder: SectionId[] = ["announcement", "hero", "about", "schedule", "team", "keep-going", "donate", "contact"];

const defaults: Settings = {
  id: 1,
  announcement: "",
  hero_heading: "You don’t have to walk through the darkness alone.",
  hero_lead: "Camp Rise Again is an adult camp created for individuals who are currently struggling with depression and may be feeling isolated, overwhelmed, hopeless, or disconnected from life.",
  about_heading: "A safe, supportive place to reconnect with life and with others.",
  about_copy: "Our goal is to provide a safe, supportive environment where participants can step away from the weight of everyday life, connect with people who understand, and experience moments of joy, laughter, connection, and hope.\n\nThrough outdoor activities, recreation, group conversations, wellness experiences, and supportive community, Camp Rise Again creates space for people to breathe, be seen, and remember that their lives have value.\n\nThis isn’t about pretending everything is okay. It’s about creating a space where you don’t have to pretend.\n\nCamp Rise Again is a community of people choosing to take another step forward—together.",
  fall_details: "Fall camp details, dates, location, and capacity will be added here.",
  spring_details: "Spring camp details, dates, location, and capacity will be added here.",
  keep_going_heading: "Your story isn’t over.",
  keep_going_copy: "There is still hope.\nYou can rise again.",
  donate_heading: "Help make Camp Rise Again possible.",
  donate_copy: "Every contribution helps us continue building a welcoming, supportive camp experience for adults who are struggling with depression. Visit our GoFundMe to donate and see the latest fundraising progress.",
  gofundme_url: "https://gofund.me/4e650f52a",
  contact_heading: "Questions before you apply?",
  contact_copy: "Send us a message and your email app will open with your answers already included so you can review and send it directly.",
  logo_path: "",
  home_section_order: defaultOrder,
};

const labels: Record<SectionId, { title: string; subtitle: string }> = {
  announcement: { title: "Announcement", subtitle: "Optional notice shown near the top of the homepage" },
  hero: { title: "Hero & Logo", subtitle: "Main headline, introduction, and Camp Rise Again logo" },
  about: { title: "About the Camp", subtitle: "About copy and fall/spring season details" },
  schedule: { title: "Camp Schedule", subtitle: "Activities shown in the public schedule section" },
  team: { title: "Meet the Staff", subtitle: "Controls where the staff section appears on the homepage" },
  "keep-going": { title: "Keep Going", subtitle: "Hope-focused closing message" },
  donate: { title: "Donations", subtitle: "Donation copy and GoFundMe link" },
  contact: { title: "Contact", subtitle: "Homepage contact heading and description" },
};

export default function HomeAdmin() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [settings, setSettings] = useState<Settings>(defaults);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [editing, setEditing] = useState<SectionId | null>(null);
  const [dragging, setDragging] = useState<SectionId | null>(null);
  const [status, setStatus] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);

  async function load() {
    if (!supabase) return;
    const [{ data: settingsData }, { data: scheduleData }] = await Promise.all([
      supabase.from("site_settings").select("*").eq("id", 1).maybeSingle(),
      supabase.from("schedule_items").select("*").order("sort_order").order("id"),
    ]);
    if (settingsData) {
      const raw = settingsData as Partial<Settings>;
      const order = Array.isArray(raw.home_section_order) ? raw.home_section_order.filter((x): x is SectionId => defaultOrder.includes(x as SectionId)) : [];
      setSettings({ ...defaults, ...raw, home_section_order: [...order, ...defaultOrder.filter((x) => !order.includes(x))] });
    }
    if (scheduleData) setSchedule(scheduleData as ScheduleItem[]);
  }

  useEffect(() => { void load(); }, []);

  async function saveSettings(message = "Homepage section saved.") {
    if (!supabase) return;
    const { error } = await supabase.from("site_settings").upsert(settings, { onConflict: "id" });
    setStatus(error ? error.message : message);
    if (!error) setEditing(null);
  }

  async function persistOrder(next: SectionId[]) {
    if (!supabase) return;
    const updated = { ...settings, home_section_order: next };
    setSettings(updated);
    setStatus("Saving homepage order…");
    const { error } = await supabase.from("site_settings").update({ home_section_order: next }).eq("id", 1);
    setStatus(error ? error.message : "Homepage order saved.");
  }

  function dropOn(target: SectionId) {
    if (!dragging || dragging === target) { setDragging(null); return; }
    const next = [...settings.home_section_order] as SectionId[];
    const from = next.indexOf(dragging);
    const to = next.indexOf(target);
    if (from < 0 || to < 0) return;
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setDragging(null);
    void persistOrder(next);
  }

  function allowDrop(e: DragEvent<HTMLDivElement>) { e.preventDefault(); }

  async function uploadLogo(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !supabase) return;
    setUploadingLogo(true);
    setStatus("Uploading logo…");
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `logo-${Date.now()}.${ext}`;
    try {
      const { error: uploadError } = await supabase.storage.from("camp-rise-again-branding").upload(path, file, { cacheControl: "3600", upsert: false });
      if (uploadError) throw uploadError;
      const oldPath = settings.logo_path;
      const next = { ...settings, logo_path: path };
      const { error: saveError } = await supabase.from("site_settings").update({ logo_path: path }).eq("id", 1);
      if (saveError) {
        await supabase.storage.from("camp-rise-again-branding").remove([path]);
        throw saveError;
      }
      setSettings(next);
      if (oldPath) await supabase.storage.from("camp-rise-again-branding").remove([oldPath]);
      setStatus("Logo updated. The header and homepage now use the new image.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not upload logo.");
    } finally {
      setUploadingLogo(false);
      e.target.value = "";
    }
  }

  async function resetLogo() {
    if (!supabase) return;
    const oldPath = settings.logo_path;
    const { error } = await supabase.from("site_settings").update({ logo_path: "" }).eq("id", 1);
    if (error) { setStatus(error.message); return; }
    setSettings({ ...settings, logo_path: "" });
    if (oldPath) await supabase.storage.from("camp-rise-again-branding").remove([oldPath]);
    setStatus("Logo reset to the original Camp Rise Again image.");
  }

  async function addScheduleItem() {
    if (!supabase) return;
    const nextOrder = schedule.length ? Math.max(...schedule.map((x) => x.sort_order)) + 10 : 10;
    const { data, error } = await supabase.from("schedule_items").insert({ day_label: "Day 1", time_label: "9:00 AM", title: "New activity", details: "", sort_order: nextOrder }).select("*").single();
    if (error) setStatus(error.message); else setSchedule([...schedule, data as ScheduleItem]);
  }

  async function saveScheduleItem(item: ScheduleItem) {
    if (!supabase) return;
    const { error } = await supabase.from("schedule_items").update({ day_label: item.day_label, time_label: item.time_label, title: item.title, details: item.details, sort_order: item.sort_order }).eq("id", item.id);
    setStatus(error ? error.message : `Saved: ${item.title}`);
  }

  async function deleteScheduleItem(id: number) {
    if (!supabase) return;
    const { error } = await supabase.from("schedule_items").delete().eq("id", id);
    if (error) setStatus(error.message); else setSchedule(schedule.filter((x) => x.id !== id));
  }

  function logoUrl() {
    if (!settings.logo_path || !supabase) return "/3426A745-DDB8-4CB7-8BBC-9DC68C16B20A.png";
    return supabase.storage.from("camp-rise-again-branding").getPublicUrl(settings.logo_path).data.publicUrl;
  }

  return (
    <section className="form-card">
      <h2>Home Page</h2>
      <p className="section-copy">Drag cards to change the order on the public homepage. Select Edit to change that section. Order changes save automatically.</p>

      <div style={{ marginTop: 22 }}>
        {(settings.home_section_order as SectionId[]).map((id, index) => {
          const isEditing = editing === id;
          return (
            <div key={id} className="card" draggable={!isEditing} onDragStart={() => setDragging(id)} onDragOver={allowDrop} onDrop={() => dropOn(id)} onDragEnd={() => setDragging(null)} style={{ marginBottom: 14, opacity: dragging === id ? .55 : 1, cursor: isEditing ? "default" : "grab" }}>
              {!isEditing ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14, flex: "1 1 320px" }}>
                    <span aria-hidden="true" style={{ fontSize: 24, opacity: .7, letterSpacing: -4 }}>☰</span>
                    <div><div style={{ fontSize: 13, opacity: .72, marginBottom: 3 }}>#{index + 1}</div><strong style={{ fontSize: 18 }}>{labels[id].title}</strong><div style={{ fontSize: 13, opacity: .72, marginTop: 4 }}>{labels[id].subtitle}</div></div>
                  </div>
                  <button className="btn btn-secondary" type="button" onClick={() => setEditing(id)}>Edit</button>
                </div>
              ) : (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 18 }}><h3 style={{ margin: 0 }}>{labels[id].title}</h3><button className="btn btn-secondary" type="button" onClick={() => setEditing(null)}>Cancel</button></div>

                  {id === "announcement" && <div className="field"><label>Announcement</label><textarea value={settings.announcement} onChange={(e) => setSettings({ ...settings, announcement: e.target.value })} placeholder="Leave blank to hide this section." /></div>}

                  {id === "hero" && <><div className="field"><label>Main headline</label><input value={settings.hero_heading} onChange={(e) => setSettings({ ...settings, hero_heading: e.target.value })} /></div><div className="field"><label>Introduction</label><textarea value={settings.hero_lead} onChange={(e) => setSettings({ ...settings, hero_lead: e.target.value })} /></div><div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap", marginBottom: 18 }}><img src={logoUrl()} alt="Current Camp Rise Again logo" style={{ width: 120, height: 120, objectFit: "contain", borderRadius: 14, background: "white" }} /><div><div className="field"><label>Replace logo</label><input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={uploadLogo} disabled={uploadingLogo} /></div><div className="actions"><button className="btn btn-secondary" type="button" onClick={resetLogo} disabled={!settings.logo_path || uploadingLogo}>Use Original Logo</button></div></div></div></>}

                  {id === "about" && <><div className="field"><label>About heading</label><input value={settings.about_heading} onChange={(e) => setSettings({ ...settings, about_heading: e.target.value })} /></div><div className="field"><label>About copy</label><textarea style={{ minHeight: 180 }} value={settings.about_copy} onChange={(e) => setSettings({ ...settings, about_copy: e.target.value })} /></div><div className="field"><label>Fall season details</label><textarea value={settings.fall_details} onChange={(e) => setSettings({ ...settings, fall_details: e.target.value })} /></div><div className="field"><label>Spring season details</label><textarea value={settings.spring_details} onChange={(e) => setSettings({ ...settings, spring_details: e.target.value })} /></div></>}

                  {id === "schedule" && <><p className="section-copy">Edit schedule activities below. The whole schedule section moves with this card.</p>{schedule.map((item, itemIndex) => <div className="card" key={item.id} style={{ marginBottom: 12 }}><div className="field-grid"><div className="field"><label>Day</label><input value={item.day_label} onChange={(e) => setSchedule(schedule.map((x, i) => i === itemIndex ? { ...x, day_label: e.target.value } : x))} /></div><div className="field"><label>Time</label><input value={item.time_label} onChange={(e) => setSchedule(schedule.map((x, i) => i === itemIndex ? { ...x, time_label: e.target.value } : x))} /></div></div><div className="field"><label>Activity</label><input value={item.title} onChange={(e) => setSchedule(schedule.map((x, i) => i === itemIndex ? { ...x, title: e.target.value } : x))} /></div><div className="field"><label>Details</label><textarea value={item.details || ""} onChange={(e) => setSchedule(schedule.map((x, i) => i === itemIndex ? { ...x, details: e.target.value } : x))} /></div><div className="actions"><button className="btn btn-primary" type="button" onClick={() => saveScheduleItem(item)}>Save Activity</button><button className="btn btn-secondary" type="button" onClick={() => deleteScheduleItem(item.id)}>Delete</button></div></div>)}<button className="btn btn-secondary" type="button" onClick={addScheduleItem}>+ Add Schedule Activity</button></>}

                  {id === "team" && <p className="section-copy">This card controls where Meet the Staff appears on the homepage. Add, edit, hide, or remove staff profiles from the Meet the Staff admin tab.</p>}

                  {id === "keep-going" && <><div className="field"><label>Heading</label><input value={settings.keep_going_heading} onChange={(e) => setSettings({ ...settings, keep_going_heading: e.target.value })} /></div><div className="field"><label>Message</label><textarea value={settings.keep_going_copy} onChange={(e) => setSettings({ ...settings, keep_going_copy: e.target.value })} /></div></>}

                  {id === "donate" && <><div className="field"><label>Heading</label><input value={settings.donate_heading} onChange={(e) => setSettings({ ...settings, donate_heading: e.target.value })} /></div><div className="field"><label>Description</label><textarea value={settings.donate_copy} onChange={(e) => setSettings({ ...settings, donate_copy: e.target.value })} /></div><div className="field"><label>GoFundMe URL</label><input type="url" value={settings.gofundme_url} onChange={(e) => setSettings({ ...settings, gofundme_url: e.target.value })} /></div></>}

                  {id === "contact" && <><div className="field"><label>Contact heading</label><input value={settings.contact_heading} onChange={(e) => setSettings({ ...settings, contact_heading: e.target.value })} /></div><div className="field"><label>Contact description</label><textarea value={settings.contact_copy} onChange={(e) => setSettings({ ...settings, contact_copy: e.target.value })} /></div></>}

                  {id !== "schedule" && id !== "team" && <button className="btn btn-primary" type="button" onClick={() => void saveSettings(`${labels[id].title} saved.`)}>Save Section</button>}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {status && <div className="status" aria-live="polite" style={{ marginTop: 16 }}>{status}</div>}
    </section>
  );
}
