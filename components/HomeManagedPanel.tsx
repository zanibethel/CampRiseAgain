"use client";

import { useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function HomeManagedPanel() {
  const pathname = usePathname();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  useEffect(() => {
    if (pathname !== "/") return;

    Promise.all([
      supabase.from("site_settings").select("announcement,hero_lead,about_heading,fall_details,spring_details,contact_heading,contact_copy").eq("id",1).maybeSingle(),
      supabase.from("schedule_items").select("id,day_label,time_label,title,details,sort_order").order("sort_order").order("id")
    ]).then(([settingsResult, scheduleResult]) => {
      const s = settingsResult.data;
      if (s) {
        const hero = document.querySelector(".hero .lead");
        const aboutHeading = document.querySelector("#about h2");
        const seasonCopy = document.querySelectorAll("#about .cards .card p");
        const contactHeading = document.querySelector("#contact h2");
        const contactCopy = document.querySelector("#contact .section-copy");
        if (hero && s.hero_lead) hero.textContent = s.hero_lead;
        if (aboutHeading && s.about_heading) aboutHeading.textContent = s.about_heading;
        if (seasonCopy[0] && s.fall_details) seasonCopy[0].textContent = s.fall_details;
        if (seasonCopy[1] && s.spring_details) seasonCopy[1].textContent = s.spring_details;
        if (contactHeading && s.contact_heading) contactHeading.textContent = s.contact_heading;
        if (contactCopy && s.contact_copy) contactCopy.textContent = s.contact_copy;

        if (s.announcement && !document.getElementById("camp-announcement")) {
          const section = document.createElement("section");
          section.id = "camp-announcement";
          section.className = "section";
          section.style.paddingBottom = "0";
          const notice = document.createElement("div");
          notice.className = "notice";
          notice.textContent = s.announcement;
          section.appendChild(notice);
          const main = document.querySelector("main");
          const heroSection = document.querySelector(".hero");
          if (main && heroSection) main.insertBefore(section, heroSection);
        }
      }

      const items = scheduleResult.data || [];
      if (items.length && !document.getElementById("schedule")) {
        const section = document.createElement("section");
        section.id = "schedule";
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
        document.getElementById("about")?.insertAdjacentElement("afterend", section);
      }
    });
  }, [pathname, supabase]);

  return null;
}
