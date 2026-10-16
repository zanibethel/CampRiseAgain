"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { defaultMemorial, type MemorialContent } from "@/lib/memorial";
import { michaelPhotoDataUrl } from "@/lib/michael-portrait";
import MemorialPhotoCarousel from "@/components/MemorialPhotoCarousel";
import { MEMORIAL_GALLERY_TABLE, MEMORIAL_IMAGE_BUCKET, orderGallery, memorialGalleryPlacements, type MemorialGalleryPhoto, type MemorialGalleryPlacement } from "@/lib/memorial-gallery";

export default function MemorialSection({ variant }: { variant: "home" | "page" }) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [memorial, setMemorial] = useState<MemorialContent>(defaultMemorial);
  const [imageFailed, setImageFailed] = useState(false);
  const [gallery, setGallery] = useState<MemorialGalleryPhoto[]>([]);

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

  useEffect(() => {
    if (!supabase || variant !== "page") return;
    let active = true;
    supabase.from(MEMORIAL_GALLERY_TABLE).select("*").eq("is_visible", true)
      .order("sort_order").order("created_at")
      .then(({ data, error }) => {
        if (active && !error) setGallery(orderGallery((data || []) as MemorialGalleryPhoto[]));
      });
    return () => { active = false; };
  }, [supabase, variant]);

  function galleryAt(placement: MemorialGalleryPlacement) {
    if (!supabase) return null;
    // Retain the order saved by Tierra in the admin. Each placement becomes
    // an independent carousel; a single image is displayed without autoplay.
    const photos = gallery
      .filter((photo) => photo.placement === placement)
      .map((photo) => ({
        id: photo.id,
        src: supabase.storage.from(MEMORIAL_IMAGE_BUCKET).getPublicUrl(photo.storage_path).data.publicUrl,
        caption: photo.caption || "",
      }));
    if (!photos.length) return null;
    const label = memorialGalleryPlacements.find((item) => item.id === placement)?.label || "Michael's photo memories";
    return <MemorialPhotoCarousel key={placement} photos={photos} label={label} />;
  }

  const photoUrl = memorial.photo_path && supabase
    ? supabase.storage.from("camp-rise-again-branding").getPublicUrl(memorial.photo_path).data.publicUrl
    : michaelPhotoDataUrl;

  useEffect(() => { setImageFailed(false); }, [photoUrl]);

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
            {galleryAt("after-intro")}
            <h2>Beyond the Uniform</h2>
            {memorial.personal_story.split(/\n\s*\n/).filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
            {galleryAt("after-personal")}
            <h2>Why Camp Rise Again Exists</h2>
            <p>{memorial.tierra_story}</p>
            {galleryAt("after-founder")}
            <h2>Michael’s Legacy</h2>
            <p>{memorial.legacy}</p>
            {galleryAt("after-legacy")}
          </div>
        </div>

        <div className="memorial-honors">
          <div className="eyebrow">Military service</div>
          <h2>Honors and decorations</h2>
          <p>Military decorations listed in Michael’s published obituary:</p>
          <ul>{memorial.honors.split("\n").map((honor, index) => honor.trim() && <li key={index}>{honor.trim()}</li>)}</ul>
        </div>

        {galleryAt("after-honors")}

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
