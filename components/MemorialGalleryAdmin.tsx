"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import {
  MEMORIAL_GALLERY_TABLE,
  MEMORIAL_IMAGE_BUCKET,
  memorialGalleryPlacements,
  orderGallery,
  type MemorialGalleryPhoto,
  type MemorialGalleryPlacement,
} from "@/lib/memorial-gallery";

// Resize large phone photos and save without location or camera EXIF metadata.
async function prepareJpeg(file: File): Promise<Blob> {
  const allowed = file.type.startsWith("image/") || /\.(heic|heif|jpg|jpeg|png|webp)$/i.test(file.name);
  if (!allowed) throw new Error("Choose an image file (JPG, PNG, WebP, or a supported iPhone photo).");
  if (file.size > 20 * 1024 * 1024) throw new Error("Choose a photo smaller than 20 MB.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("This photo cannot be opened by your browser. Try exporting it as a JPG."));
      image.src = url;
    });
    if (!image.naturalWidth || !image.naturalHeight) throw new Error("This photo has no readable dimensions.");
    const scale = Math.min(1, 1920 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Your browser cannot prepare this photo.");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
    if (!blob) throw new Error("Could not prepare this image for upload.");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function MemorialGalleryAdmin() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [photos, setPhotos] = useState<MemorialGalleryPhoto[]>([]);
  const [draftCaptions, setDraftCaptions] = useState<Record<string, string>>({});
  const [uploadPlacement, setUploadPlacement] = useState<MemorialGalleryPlacement>("after-personal");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  async function loadPhotos() {
    if (!supabase) return;
    const { data, error } = await supabase.from(MEMORIAL_GALLERY_TABLE).select("*")
      .order("sort_order").order("created_at");
    if (error) setStatus("Could not load gallery: " + error.message);
    else setPhotos(orderGallery((data || []) as MemorialGalleryPhoto[]));
    setLoading(false);
  }

  useEffect(() => { void loadPhotos(); }, [supabase]);

  async function uploadMany(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    if (!files.length || !supabase || busy) return;
    if (files.length > 20) {
      setStatus("Please choose up to 20 photos per upload."); event.target.value = ""; return;
    }
    setBusy(true);
    let uploaded = 0;
    let errorMessage = "";
    try {
      for (const [index, file] of files.entries()) {
        setStatus(`Uploading photo ${index + 1} of ${files.length}: ${file.name}`);
        let path = "";
        try {
          const jpeg = await prepareJpeg(file);
          path = `memorial-gallery/${crypto.randomUUID()}.jpg`;
          const { error: uploadError } = await supabase.storage.from(MEMORIAL_IMAGE_BUCKET)
            .upload(path, jpeg, { contentType: "image/jpeg", cacheControl: "3600", upsert: false });
          if (uploadError) throw uploadError;
          const { data: existing, error: orderError } = await supabase.from(MEMORIAL_GALLERY_TABLE)
            .select("sort_order").eq("placement", uploadPlacement)
            .order("sort_order", { ascending: false }).limit(1);
          if (orderError) throw orderError;
          const nextSort = (existing?.[0]?.sort_order ?? 0) + 10;
          const { error: insertError } = await supabase.from(MEMORIAL_GALLERY_TABLE).insert({
            storage_path: path,
            caption: "",
            placement: uploadPlacement,
            sort_order: nextSort,
            is_visible: true,
          });
          if (insertError) throw insertError;
          uploaded += 1;
        } catch (error) {
          // Only remove a file if its database record was not successfully created.
          if (path) await supabase.storage.from(MEMORIAL_IMAGE_BUCKET).remove([path]);
          errorMessage = `${file.name}: ${error instanceof Error ? error.message : "Upload failed"}`;
          break;
        }
      }
    } finally {
      setBusy(false);
      event.target.value = "";
      await loadPhotos();
      setStatus(errorMessage
        ? `${uploaded} photo(s) added. ${errorMessage}`
        : `${uploaded} photo(s) added to Our Story. You can change their positions below.`);
    }
  }

  async function changePhoto(id: string, update: Partial<Pick<MemorialGalleryPhoto, "caption" | "placement" | "sort_order" | "is_visible">>, success: string) {
    if (!supabase || busy) return false;
    setBusy(true);
    const { error } = await supabase.from(MEMORIAL_GALLERY_TABLE).update(update).eq("id", id);
    await loadPhotos();
    setBusy(false);
    setStatus(error ? error.message : success);
    return !error;
  }

  async function moveToSection(photo: MemorialGalleryPhoto, placement: MemorialGalleryPlacement) {
    if (!supabase || busy || placement === photo.placement) return;
    setBusy(true);
    const { data, error: fetchError } = await supabase.from(MEMORIAL_GALLERY_TABLE)
      .select("sort_order").eq("placement", placement)
      .order("sort_order", { ascending: false }).limit(1);
    if (fetchError) {
      setBusy(false); setStatus(fetchError.message); return;
    }
    const { error } = await supabase.from(MEMORIAL_GALLERY_TABLE)
      .update({ placement, sort_order: (data?.[0]?.sort_order ?? 0) + 10 }).eq("id", photo.id);
    await loadPhotos();
    setBusy(false);
    setStatus(error ? error.message : "Photo placement updated.");
  }

  async function movePhoto(photo: MemorialGalleryPhoto, direction: -1 | 1) {
    if (!supabase || busy) return;
    const group = orderGallery(photos).filter(p => p.placement === photo.placement);
    const index = group.findIndex(p => p.id === photo.id);
    const other = group[index + direction];
    if (!other) return;
    setBusy(true);
    // A temporary order value avoids tied sort keys during the swap.
    const temporary = Math.min(...group.map(p => p.sort_order)) - 10;
    const first = await supabase.from(MEMORIAL_GALLERY_TABLE).update({ sort_order: temporary }).eq("id", photo.id);
    const second = first.error ? null : await supabase.from(MEMORIAL_GALLERY_TABLE)
      .update({ sort_order: photo.sort_order }).eq("id", other.id);
    const third = first.error || second?.error ? null : await supabase.from(MEMORIAL_GALLERY_TABLE)
      .update({ sort_order: other.sort_order }).eq("id", photo.id);
    await loadPhotos();
    setBusy(false);
    setStatus(first.error?.message || second?.error?.message || third?.error?.message ||
      "Photo order updated.");
  }

  async function deletePhoto(photo: MemorialGalleryPhoto) {
    if (!supabase || busy) return;
    if (!window.confirm("Remove this photo from Michael's story? This cannot be undone.")) return;
    setBusy(true);
    const { error } = await supabase.from(MEMORIAL_GALLERY_TABLE).delete().eq("id", photo.id);
    if (!error) {
      const { error: fileError } = await supabase.storage.from(MEMORIAL_IMAGE_BUCKET).remove([photo.storage_path]);
      setStatus(fileError ? "Photo removed from the page, but its stored file could not be deleted." : "Photo removed.");
    } else {
      setStatus(error.message);
    }
    await loadPhotos();
    setBusy(false);
  }

  if (!supabase) return <p className="section-copy">Photo gallery requires the site database connection.</p>;

  return (
    <section className="memorial-gallery-admin" aria-label="Michael's story photo gallery">
      <h3>Additional Photos — Our Story</h3>
      <p className="section-copy">Add family photos without changing the main portrait. Choose where the new photos appear among the stories, then adjust each photo's placement, caption, and order. Gallery changes save immediately.</p>
      <div className="field">
        <label htmlFor="memorial-gallery-upload-location">Place new photos</label>
        <select id="memorial-gallery-upload-location" value={uploadPlacement}
          disabled={busy} onChange={e => setUploadPlacement(e.target.value as MemorialGalleryPlacement)}>
          {memorialGalleryPlacements.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="memorial-gallery-upload">Upload additional photos</label>
        <input id="memorial-gallery-upload" type="file" accept="image/*,.heic,.heif" multiple
          onChange={uploadMany} disabled={busy} />
        <small>Choose several at once (up to 20). Photos are resized for the website. JPG, PNG, WebP, and browser-supported iPhone images work.</small>
      </div>
      <p className="status" role="status" aria-live="polite">{status || (loading ? "Loading photos…" : `${photos.length} photo(s) in the gallery`)}</p>
      {!loading && photos.length === 0 && <p className="section-copy">No additional pictures yet. The main military portrait will stay in place.</p>}
      <div className="memorial-gallery-admin-list">
        {photos.map(photo => {
          const section = memorialGalleryPlacements.find(p => p.id === photo.placement);
          const group = orderGallery(photos).filter(p => p.placement === photo.placement);
          const order = group.findIndex(p => p.id === photo.id);
          const src = supabase.storage.from(MEMORIAL_IMAGE_BUCKET).getPublicUrl(photo.storage_path).data.publicUrl;
          return (
            <div key={photo.id} className="memorial-gallery-admin-item">
              <img src={src} alt={photo.caption || "Uploaded memorial photo"} loading="lazy" />
              <div className="memorial-gallery-admin-fields">
                <div className="field">
                  <label htmlFor={`memorial-caption-${photo.id}`}>Photo caption (optional)</label>
                  <textarea id={`memorial-caption-${photo.id}`} rows={2}
                    value={draftCaptions[photo.id] ?? photo.caption}
                    onChange={e => setDraftCaptions(old => ({ ...old, [photo.id]: e.target.value }))}
                    placeholder="A memory or description of this photo" />
                </div>
                <div className="actions memorial-gallery-admin-actions">
                  <button className="btn btn-primary" type="button" disabled={busy || (draftCaptions[photo.id] ?? photo.caption) === photo.caption}
                    onClick={async () => {
                      const ok = await changePhoto(photo.id, { caption: draftCaptions[photo.id] ?? photo.caption }, "Caption saved.");
                      if (ok) setDraftCaptions(old => { const next = { ...old }; delete next[photo.id]; return next; });
                    }}>Save Caption</button>
                </div>
                <div className="field">
                  <label htmlFor={`memorial-location-${photo.id}`}>Position on page</label>
                  <select id={`memorial-location-${photo.id}`} value={photo.placement}
                    disabled={busy} onChange={e => void moveToSection(photo, e.target.value as MemorialGalleryPlacement)}>
                    {memorialGalleryPlacements.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                </div>
                <p className="memorial-gallery-admin-hint">{section?.label} · {order + 1} of {group.length}</p>
                <div className="actions memorial-gallery-admin-actions">
                  <button type="button" className="btn btn-secondary" disabled={busy || order === 0}
                    onClick={() => void movePhoto(photo, -1)}>↑ Earlier</button>
                  <button type="button" className="btn btn-secondary" disabled={busy || order === group.length - 1}
                    onClick={() => void movePhoto(photo, 1)}>↓ Later</button>
                  <button type="button" className="btn btn-secondary" disabled={busy}
                    onClick={() => void changePhoto(photo.id, { is_visible: !photo.is_visible }, photo.is_visible ? "Photo hidden." : "Photo shown.")}>
                    {photo.is_visible ? "Hide" : "Show"}
                  </button>
                  <button type="button" className="btn memorial-gallery-delete" disabled={busy}
                    onClick={() => void deletePhoto(photo)}>Remove</button>
                </div>
                <small>{photo.is_visible ? "Visible on Our Story" : "Hidden from Our Story"}</small>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
