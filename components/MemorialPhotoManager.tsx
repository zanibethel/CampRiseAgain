"use client";

import { ChangeEvent } from "react";
import { memorialPhotoPlacements, type MemorialGalleryPhoto, type MemorialPhotoPlacement } from "@/lib/memorial";

type Props = {
  photos: MemorialGalleryPhoto[];
  uploading: boolean;
  onUpload: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  onChange: (next: MemorialGalleryPhoto[]) => void;
  getPhotoUrl: (path: string) => string;
};

function moveWithinSection(photos: MemorialGalleryPhoto[], id: string, direction: -1 | 1) {
  const current = photos.find((photo) => photo.id === id);
  if (!current) return photos;
  const indices = photos.map((photo, index) => photo.placement === current.placement ? index : -1).filter((index) => index >= 0);
  const currentInSection = indices.findIndex((index) => photos[index].id === id);
  const targetIndex = indices[currentInSection + direction];
  if (targetIndex === undefined) return photos;
  const next = [...photos];
  const originalIndex = indices[currentInSection];
  [next[originalIndex], next[targetIndex]] = [next[targetIndex], next[originalIndex]];
  return next;
}

export default function MemorialPhotoManager({ photos, uploading, onUpload, onChange, getPhotoUrl }: Props) {
  const update = (id: string, patch: Partial<MemorialGalleryPhoto>) =>
    onChange(photos.map((photo) => photo.id === id ? { ...photo, ...patch } : photo));

  return (
    <div className="memorial-gallery-editor">
      <h3>Photos throughout Michael&apos;s story</h3>
      <p className="section-copy">
        Add family, service, or favorite-memory photos and choose where each appears on Michael&apos;s page.
        His main portrait above stays separate. Photo uploads publish immediately; for captions, placement,
        ordering, visibility, or removals, select <strong>Save Section</strong> below.
      </p>
      <div className="field">
        <label htmlFor="memorial-gallery-upload">Add photos from your phone or computer</label>
        <input id="memorial-gallery-upload" type="file" accept="image/*,.heic,.heif" multiple onChange={onUpload} disabled={uploading || photos.length >= 30} />
        <small>{uploading ? "Uploading and preparing photos…" : `${photos.length} of 30 photos · Choose several at once · JPEG, PNG, WebP or supported iPhone images`}</small>
      </div>

      {photos.length === 0 ? (
        <p className="notice">No extra photos yet. Upload a few and they can appear between the different chapters of Michael&apos;s story.</p>
      ) : (
        <div className="memorial-admin-photo-list">
          {photos.map((photo, index) => {
            const peers = photos.filter((item) => item.placement === photo.placement);
            const peerIndex = peers.findIndex((item) => item.id === photo.id);
            return (
              <div className="memorial-admin-photo" key={photo.id}>
                <img src={getPhotoUrl(photo.path)} alt={photo.caption.trim() || `Uploaded memorial photo ${index + 1}`} loading="lazy" />
                <div className="memorial-admin-photo-fields">
                  <strong>Photo {index + 1}</strong>
                  <div className="field">
                    <label htmlFor={`memorial-photo-caption-${photo.id}`}>Caption / description</label>
                    <input id={`memorial-photo-caption-${photo.id}`} type="text" maxLength={220} value={photo.caption} placeholder="Optional memory or photo description" onChange={(e) => update(photo.id, { caption: e.target.value })} disabled={uploading} />
                  </div>
                  <div className="field">
                    <label htmlFor={`memorial-photo-placement-${photo.id}`}>Where to show this photo</label>
                    <select id={`memorial-photo-placement-${photo.id}`} value={photo.placement} onChange={(e) => update(photo.id, { placement: e.target.value as MemorialPhotoPlacement })} disabled={uploading}>
                      {memorialPhotoPlacements.map((placement) => <option value={placement.value} key={placement.value}>{placement.label}</option>)}
                    </select>
                  </div>
                  <label className="memorial-photo-visible">
                    <input type="checkbox" checked={photo.visible !== false} onChange={(e) => update(photo.id, { visible: e.target.checked })} disabled={uploading} />
                    Show on Michael&apos;s page
                  </label>
                  <div className="memorial-photo-actions">
                    <button className="btn btn-secondary" type="button" disabled={uploading || peerIndex <= 0} onClick={() => onChange(moveWithinSection(photos, photo.id, -1))}>↑ Earlier</button>
                    <button className="btn btn-secondary" type="button" disabled={uploading || peerIndex >= peers.length - 1} onClick={() => onChange(moveWithinSection(photos, photo.id, 1))}>↓ Later</button>
                    <button className="btn memorial-remove-photo" type="button" disabled={uploading} onClick={() => {
                      if (window.confirm("Remove this photo from Michael's page when you save?")) {
                        onChange(photos.filter((item) => item.id !== photo.id));
                      }
                    }}>Remove</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p className="section-copy" style={{ fontSize: 13 }}>Photos with the same placement appear together, in the order above. Earlier/Later works within that placement. Removing a photo from this list does not delete Tierra&apos;s original file from her device.</p>
    </div>
  );
}
