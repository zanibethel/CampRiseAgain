"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

const ADMINS = ["schofieldtierra@gmail.com", "zanibethel@gmail.com"];

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
  const [settings, setSettings] = useState<Settings>(defaults);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadContent() {
    if (!supabase) return;
    const [{ data: settingsData }, { data: scheduleData }] = await Promise.all([
      supabase.from("site_settings").select("*").eq("id", 1).maybeSingle(),
      supabase.from("schedule_items").select("*").order("sort_order").order("id"),
    ]);
    if (settingsData) setSettings(settingsData as Settings);
    if (scheduleData) setSchedule(scheduleData as ScheduleItem[]);
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

  return <><SiteHeader /><main className="form-wrap" style={{maxWidth: 980}}><div className="eyebrow">Administration</div><h1>Camp Rise Again Admin</h1><p className="section-copy">Signed in as {userEmail}. Changes saved here update the public website without editing GitHub.</p><div className="actions"><button className="btn btn-secondary" type="button" onClick={signOut}>Sign Out</button></div>

  <form className="form-card" onSubmit={saveSettings} style={{marginTop: 24}}><h2>Homepage information</h2><div className="field"><label>Announcement (optional)</label><input value={settings.announcement} onChange={(e)=>setSettings({...settings,announcement:e.target.value})} placeholder="Example: Fall applications are now open!" /></div><div className="field"><label>Homepage introduction</label><textarea value={settings.hero_lead} onChange={(e)=>setSettings({...settings,hero_lead:e.target.value})} /></div><div className="field"><label>About heading</label><input value={settings.about_heading} onChange={(e)=>setSettings({...settings,about_heading:e.target.value})} /></div><div className="field"><label>Fall season details</label><textarea value={settings.fall_details} onChange={(e)=>setSettings({...settings,fall_details:e.target.value})} /></div><div className="field"><label>Spring season details</label><textarea value={settings.spring_details} onChange={(e)=>setSettings({...settings,spring_details:e.target.value})} /></div><div className="field"><label>Contact heading</label><input value={settings.contact_heading} onChange={(e)=>setSettings({...settings,contact_heading:e.target.value})} /></div><div className="field"><label>Contact description</label><textarea value={settings.contact_copy} onChange={(e)=>setSettings({...settings,contact_copy:e.target.value})} /></div><button className="btn btn-primary">Save Homepage</button></form>

  <section className="form-card" style={{marginTop: 24}}><h2>Camp schedule</h2><p className="section-copy">Add activities in the order you want them displayed publicly.</p>{schedule.map((item,index)=><div key={item.id} className="card" style={{marginBottom: 16}}><div className="field-grid"><div className="field"><label>Day</label><input value={item.day_label} onChange={(e)=>setSchedule(schedule.map((x,i)=>i===index?{...x,day_label:e.target.value}:x))} /></div><div className="field"><label>Time</label><input value={item.time_label} onChange={(e)=>setSchedule(schedule.map((x,i)=>i===index?{...x,time_label:e.target.value}:x))} /></div></div><div className="field"><label>Activity</label><input value={item.title} onChange={(e)=>setSchedule(schedule.map((x,i)=>i===index?{...x,title:e.target.value}:x))} /></div><div className="field"><label>Details</label><textarea value={item.details || ""} onChange={(e)=>setSchedule(schedule.map((x,i)=>i===index?{...x,details:e.target.value}:x))} /></div><div className="field"><label>Display order</label><input type="number" value={item.sort_order} onChange={(e)=>setSchedule(schedule.map((x,i)=>i===index?{...x,sort_order:Number(e.target.value)}:x))} /></div><div className="actions"><button className="btn btn-primary" type="button" onClick={()=>saveScheduleItem(item)}>Save Activity</button><button className="btn btn-secondary" type="button" onClick={()=>deleteScheduleItem(item.id)}>Delete</button></div></div>)}<button className="btn btn-secondary" type="button" onClick={addScheduleItem}>+ Add Schedule Activity</button></section>{status && <div className="status" aria-live="polite" style={{marginTop:20}}>{status}</div>}</main></>;
}
