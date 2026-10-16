"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { defaultMemorial, type MemorialContent } from "@/lib/memorial";

export default function MemorialSection({ variant }: { variant: "home" | "page" }) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [memorial, setMemorial] = useState<MemorialContent>(defaultMemorial);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase.from("site_settings").select("memorial_content").eq("id", 1).maybeSingle()
      .then(({ data }) => {
        if (active && data?.memorial_content && typeof data.memorial_content === "object") {
          setMemorial({ ...defaultMemorial, ...(data.memorial_content as Partial<MemorialContent>) });
        }
      });
    return () => { active = false; };
  }, [supabase]);

  const photoUrl = memorial.photo_path && supabase
    ? supabase.storage.from("camp-rise-again-branding").getPublicUrl(memorial.photo_path).data.publicUrl
    : "/michael-garza.webp";

  const portrait = (
    <div className="memorial-photo-wrap">
      {!imageFailed ? (
        <img
          key={photoUrl}
          className="memorial-photo"
          src={photoUrl}
          alt="Michael Alexander Garza in United States Air Force dress uniform beside the American flag"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div className="memorial-photo-placeholder" role="img" aria-label="Michael Alexander Garza, United States Air Force veteran">
          <span>In loving memory</span>
          <strong>Michael Alexander Garza</strong>
          <span>United States Air Force</span>
        </div>
      )}
      <div className="memorial-photo-caption">Michael Alexander Garza · 19½ years of service</div>
    </div>
  );

  if (variant === "home") {
    return (
      <section id="legacy" data-home-section="legacy" className="section memorial-home-section" aria-labelledby="legacy-heading">
        <div className="memorial-home-grid">
          {portrait}
          <div>
            <div className="eyebrow">The story behind Camp Rise Again</div>
            <h2 id="legacy-heading">{memorial.home_heading}</h2>
            <p className="memorial-lead">{memorial.home_copy}</p>
            <blockquote className="memorial-quote">“{memorial.quote}”<cite>— Tierra Schofield, Founder</cite></blockquote>
            <Link href="/michael-garza" className="btn btn-primary">Read Michael's Story →</Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <main className="memorial-page">
      <section className="memorial-page-header" aria-labelledby="memorial-title">
        <Link href="/" className="memorial-back">← Back to Camp Rise Again</Link>
        <div className="eyebrow">In loving memory</div>
        <h1 id="memorial-title">Michael Alexander Garza</h1>
        <p>United States Air Force · 19½ years of service</p>
      </section>

      <section className="section memorial-page-content">
        <div className="memorial-page-grid">
          {portrait}
          <div className="memorial-prose">
            <h2>A life of service. A lasting legacy.</h2>
            <p>{memorial.intro}</p>
            <h2>Why Camp Rise Again Exists</h2>
            <p>{memorial.tierra_story}</p>
            <h2>His Memory. Our Mission.</h2>
            <p>{memorial.legacy}</p>
          </div>
        </div>

        <div className="memorial-honors">
          <div className="eyebrow">Military service</div>
          <h2>Honors and decorations</h2>
          <p>Michael's service was recognized through military honors and decorations.</p>
          <ul>{memorial.honors.split("\n").map((honor, index) => honor.trim() && <li key={index}>{honor.trim()}</li>)}</ul>
        </div>

        <div className="memorial-closing">
          <blockquote>“{memorial.quote}”</blockquote>
          <p>— Tierra Schofield, Founder of Camp Rise Again</p>
          <Link href="/#about" className="btn btn-secondary">Learn About the Camp</Link>
        </div>
        <p className="memorial-safety"><strong>Need support now?</strong> If you or someone you know is in immediate danger, call 911. In the United States, call or text 988 for the Suicide & Crisis Lifeline.</p>
      </section>
    </main>
  );
}
