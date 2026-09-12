"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type Settings = {
  announcement: string;
  fall_details: string;
  spring_details: string;
  contact_heading: string;
  contact_copy: string;
};

type Item = {
  id: number;
  day_label: string;
  time_label: string;
  title: string;
  details: string;
  sort_order: number;
};

export default function HomeManagedPanel() {
  const pathname = usePathname();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    if (pathname !== "/") return;
    Promise.all([
      supabase.from("site_settings").select("announcement,fall_details,spring_details,contact_heading,contact_copy").eq("id", 1).maybeSingle(),
      supabase.from("schedule_items").select("id,day_label,time_label,title,details,sort_order").order("sort_order").order("id")
    ]).then(([a, b]) => {
      if (a.data) setSettings(a.data as Settings);
      if (b.data) setItems(b.data as Item[]);
    });
  }, [pathname, supabase]);

  if (pathname !== "/" || (!settings && items.length === 0)) return null;

  return (
    <section className="section" style={{paddingTop: 20, paddingBottom: 20}}>
      {settings?.announcement && <div className="notice"><strong>{settings.announcement}</strong></div>}
      <div className="cards" style={{marginTop: settings?.announcement ? 20 : 0}}>
        {settings?.fall_details && <div className="card"><h3>Fall Season</h3><p>{settings.fall_details}</p></div>}
        {settings?.spring_details && <div className="card"><h3>Spring Season</h3><p>{settings.spring_details}</p></div>}
        {settings?.contact_copy && <div className="card"><h3>{settings.contact_heading || "Contact"}</h3><p>{settings.contact_copy}</p></div>}
      </div>
      {items.length > 0 && <div style={{marginTop: 24}}><div className="eyebrow">Camp schedule</div><div className="cards" style={{marginTop: 12}}>{items.map(item => <div className="card" key={item.id}><div className="eyebrow">{item.day_label}{item.time_label ? ` · ${item.time_label}` : ""}</div><h3>{item.title}</h3>{item.details && <p>{item.details}</p>}</div>)}</div></div>}
    </section>
  );
}
