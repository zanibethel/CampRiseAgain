"use client";

import { useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

const defaultOrder = ["announcement", "hero", "about", "schedule", "team", "keep-going", "donate", "contact"];

export default function HomeManagedPanel() {
  const pathname = usePathname();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  useEffect(() => {
    if (pathname !== "/" || !supabase) return;

    Promise.all([
      supabase.from("site_settings").select("announcement,hero_heading,hero_lead,about_heading,about_copy,fall_details,spring_details,keep_going_heading,keep_going_copy,donate_heading,donate_copy,contact_heading,contact_copy,home_section_order").eq("id", 1).maybeSingle(),
      supabase.from("schedule_items").select("id,day_label,time_label,title,details,sort_order").order("sort_order").order("id"),
    ]).then(([settingsResult, scheduleResult]) => {
      const s = settingsResult.data;
      const main = document.querySelector("main");
      if (!main) return;

      if (s) {
        const heroHeading = document.querySelector("#hero h1");
        const heroLead = document.querySelector("#hero .lead");
        const aboutHeading = document.querySelector("#about h2");
        const aboutCopy = document.querySelector("#about [data-managed-about-copy]");
        const seasonCopy = document.querySelectorAll("#about .cards .card p");
        const keepHeading = document.querySelector("#keep-going h2");
        const keepCopy = document.querySelector("#keep-going .section-copy");
        const donateHeading = document.querySelector("#donate h2");
        const donateCopy = document.querySelector("#donate .section-copy");
        const contactHeading = document.querySelector("#contact h2");
        const contactCopy = document.querySelector("#contact [data-managed-contact-copy]");

        if (heroHeading && s.hero_heading) heroHeading.textContent = s.hero_heading;
        if (heroLead && s.hero_lead) heroLead.textContent = s.hero_lead;
        if (aboutHeading && s.about_heading) aboutHeading.textContent = s.about_heading;
        if (aboutCopy && s.about_copy) {
          aboutCopy.innerHTML = "";
          s.about_copy.split(/\n\s*\n/).filter(Boolean).forEach((paragraph: string) => {
            const p = document.createElement("p");
            p.textContent = paragraph;
            aboutCopy.appendChild(p);
          });
        }
        if (seasonCopy[0] && s.fall_details) seasonCopy[0].textContent = s.fall_details;
        if (seasonCopy[1] && s.spring_details) seasonCopy[1].textContent = s.spring_details;
        if (keepHeading && s.keep_going_heading) keepHeading.textContent = s.keep_going_heading;
        if (keepCopy && s.keep_going_copy) keepCopy.textContent = s.keep_going_copy;
        if (donateHeading && s.donate_heading) donateHeading.textContent = s.donate_heading;
        if (donateCopy && s.donate_copy) donateCopy.textContent = s.donate_copy;
        if (contactHeading && s.contact_heading) contactHeading.textContent = s.contact_heading;
        if (contactCopy && s.contact_copy) contactCopy.textContent = s.contact_copy;

        const oldAnnouncement = document.getElementById("camp-announcement");
        if (!s.announcement && oldAnnouncement) oldAnnouncement.remove();
        if (s.announcement) {
          const section = oldAnnouncement || document.createElement("section");
          section.id = "camp-announcement";
          section.setAttribute("data-home-section", "announcement");
          section.className = "section";
          section.setAttribute("style", "padding-bottom:0");
          section.innerHTML = "";
          const notice = document.createElement("div");
          notice.className = "notice";
          notice.textContent = s.announcement;
          section.appendChild(notice);
          if (!oldAnnouncement) main.prepend(section);
        }
      }

      const existingSchedule = document.getElementById("schedule");
      existingSchedule?.remove();
      const items = scheduleResult.data || [];
      if (items.length) {
        const section = document.createElement("section");
        section.id = "schedule";
        section.setAttribute("data-home-section", "schedule");
        section.className = "section";
        const eyebrow = document.createElement("div");
        eyebrow.className = "eyebrow";
        eyebrow.textContent = "Camp schedule";
        const heading = document.createElement("h2");
        heading.textContent = "What to expect at camp.";
        const cards = document.createElement("div");
        cards.className = "cards";
        items.forEach((item) => {
          const card = document.createElement("div");
          card.className = "card";
          const meta = document.createElement("div");
          meta.className = "eyebrow";
          meta.textContent = item.day_label + (item.time_label ? ` · ${item.time_label}` : "");
          const title = document.createElement("h3");
          title.textContent = item.title;
          card.append(meta, title);
          if (item.details) {
            const details = document.createElement("p");
            details.textContent = item.details;
            card.appendChild(details);
          }
          cards.appendChild(card);
        });
        section.append(eyebrow, heading, cards);
        main.appendChild(section);
      }

      const stored = s && Array.isArray(s.home_section_order) ? s.home_section_order : [];
      const order = [...stored.filter((id: string) => defaultOrder.includes(id)), ...defaultOrder.filter((id) => !stored.includes(id))];
      order.forEach((id) => {
        const element = main.querySelector(`[data-home-section="${id}"]`);
        if (element) main.appendChild(element);
      });
    });
  }, [pathname, supabase]);

  return null;
}
