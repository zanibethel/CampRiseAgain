"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type TeamMember = {
  id: number;
  name: string;
  bio: string;
  image_path: string;
  is_visible: boolean;
  sort_order: number;
};

type NewMember = {
  name: string;
  bio: string;
  image: File | null;
  is_visible: boolean;
};

const emptyNewMember: NewMember = { name: "", bio: "", image: null, is_visible: true };
const MAX_PHOTO_DIMENSION = 1400;
const JPEG_QUALITY = 0.82;

function safeFileName() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function optimizeTeamPhoto(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file.");

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      try {
        const sourceWidth = image.naturalWidth || image.width;
        const sourceHeight = image.naturalHeight || image.height;
        const scale = Math.min(1, MAX_PHOTO_DIMENSION / Math.max(sourceWidth, sourceHeight));
        const width = Math.max(1, Math.round(sourceWidth * scale));
        const height = Math.max(1, Math.round(sourceHeight * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Your browser could not prepare this photo.");

        context.drawImage(image, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(objectUrl);
            if (!blob) {
              reject(new Error("Your browser could not prepare this photo."));
              return;
            }
            resolve(new File([blob], "team-photo.jpg", { type: "image/jpeg", lastModified: Date.now() }));
          },
          "image/jpeg",
          JPEG_QUALITY,
        );
      } catch (error) {
        URL.revokeObjectURL(objectUrl);
        reject(error instanceof Error ? error : new Error("Could not prepare this photo."));
      }
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("That photo format could not be read. Try choosing a JPEG, PNG, or WebP image."));
    };

    image.src = objectUrl;
  });
}

export default function TeamAdmin() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMember, setNewMember] = useState<NewMember>(emptyNewMember);
  const [status, setStatus] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);

  async function loadMembers() {
    const { data, error } = await supabase
      .from("camp_rise_again_team_members")
      .select("id,name,bio,image_path,is_visible,sort_order")
      .order("sort_order")
      .order("id");
    if (error) setStatus(error.message);
    else setMembers((data || []) as TeamMember[]);
  }

  useEffect(() => {
    loadMembers();
  }, []);

  async function uploadImage(file: File) {
    setStatus(`Optimizing photo (${formatBytes(file.size)})…`);
    const optimized = await optimizeTeamPhoto(file);
    setStatus(`Uploading optimized photo (${formatBytes(optimized.size)})…`);
    const path = safeFileName();
    const { error } = await supabase.storage.from("camp-rise-again-team").upload(path, optimized, {
      cacheControl: "3600",
      contentType: "image/jpeg",
      upsert: false,
    });
    if (error) throw error;
    return path;
  }

  async function addMember(e: FormEvent) {
    e.preventDefault();
    if (!newMember.name.trim()) return;
    setAdding(true);
    setStatus("Adding team member…");
    let imagePath = "";
    try {
      if (newMember.image) imagePath = await uploadImage(newMember.image);
      const nextOrder = members.length ? Math.max(...members.map((m) => m.sort_order)) + 10 : 10;
      const { error } = await supabase.from("camp_rise_again_team_members").insert({
        name: newMember.name.trim(),
        bio: newMember.bio.trim(),
        image_path: imagePath,
        is_visible: newMember.is_visible,
        sort_order: nextOrder,
      });
      if (error) throw error;
      setNewMember(emptyNewMember);
      setShowAddForm(false);
      setStatus("Team member added.");
      await loadMembers();
    } catch (error) {
      if (imagePath) await supabase.storage.from("camp-rise-again-team").remove([imagePath]);
      setStatus(error instanceof Error ? error.message : "Could not add team member.");
    } finally {
      setAdding(false);
    }
  }

  function updateLocal(id: number, patch: Partial<TeamMember>) {
    setMembers((current) => current.map((member) => member.id === id ? { ...member, ...patch } : member));
  }

  async function saveMember(member: TeamMember) {
    setSavingId(member.id);
    setStatus(`Saving ${member.name}…`);
    const { error } = await supabase.from("camp_rise_again_team_members").update({
      name: member.name.trim(),
      bio: member.bio.trim(),
      is_visible: member.is_visible,
      sort_order: member.sort_order,
      updated_at: new Date().toISOString(),
    }).eq("id", member.id);
    setStatus(error ? error.message : `${member.name} saved.`);
    setSavingId(null);
  }

  async function toggleVisibility(member: TeamMember) {
    const next = !member.is_visible;
    updateLocal(member.id, { is_visible: next });
    const { error } = await supabase.from("camp_rise_again_team_members").update({
      is_visible: next,
      updated_at: new Date().toISOString(),
    }).eq("id", member.id);
    if (error) {
      updateLocal(member.id, { is_visible: member.is_visible });
      setStatus(error.message);
    } else {
      setStatus(`${member.name} is now ${next ? "visible" : "hidden"} on the homepage.`);
    }
  }

  async function replaceImage(member: TeamMember, e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSavingId(member.id);
    setStatus(`Preparing photo for ${member.name}…`);
    try {
      const newPath = await uploadImage(file);
      const { error } = await supabase.from("camp_rise_again_team_members").update({
        image_path: newPath,
        updated_at: new Date().toISOString(),
      }).eq("id", member.id);
      if (error) {
        await supabase.storage.from("camp-rise-again-team").remove([newPath]);
        throw error;
      }
      if (member.image_path) await supabase.storage.from("camp-rise-again-team").remove([member.image_path]);
      updateLocal(member.id, { image_path: newPath });
      setStatus(`${member.name}'s photo was updated.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not upload photo.");
    } finally {
      setSavingId(null);
      e.target.value = "";
    }
  }

  async function deleteMember(member: TeamMember) {
    if (!window.confirm(`Delete ${member.name} from the team?`)) return;
    setSavingId(member.id);
    const { error } = await supabase.from("camp_rise_again_team_members").delete().eq("id", member.id);
    if (error) {
      setStatus(error.message);
    } else {
      if (member.image_path) await supabase.storage.from("camp-rise-again-team").remove([member.image_path]);
      setMembers((current) => current.filter((m) => m.id !== member.id));
      setStatus(`${member.name} deleted.`);
    }
    setSavingId(null);
  }

  function publicImageUrl(path: string) {
    return path ? supabase.storage.from("camp-rise-again-team").getPublicUrl(path).data.publicUrl : "";
  }

  return (
    <section className="form-card" style={{ marginTop: 24 }}>
      <div style={{ display: "flex", gap: 16, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ marginBottom: 6 }}>Meet the Team</h2>
          <p className="section-copy" style={{ marginBottom: 0 }}>Add people, upload photos, and show or hide each person from the homepage.</p>
        </div>
        <button className="btn btn-secondary" type="button" onClick={() => setShowAddForm((value) => !value)}>
          {showAddForm ? "Cancel" : "+ Add Team Member"}
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={addMember} style={{ marginTop: 22, paddingTop: 22, borderTop: "1px solid rgba(255,255,255,.12)" }}>
          <div className="field"><label htmlFor="team-name">Name</label><input id="team-name" value={newMember.name} onChange={(e) => setNewMember({ ...newMember, name: e.target.value })} required /></div>
          <div className="field"><label htmlFor="team-bio">Short bio</label><textarea id="team-bio" value={newMember.bio} onChange={(e) => setNewMember({ ...newMember, bio: e.target.value })} /></div>
          <div className="field"><label htmlFor="team-photo">Photo (optional)</label><input id="team-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setNewMember({ ...newMember, image: e.target.files?.[0] || null })} />{newMember.image && <small style={{ display: "block", marginTop: 8, opacity: .72 }}>Selected: {newMember.image.name} · {formatBytes(newMember.image.size)}. It will be optimized automatically before upload.</small>}</div>
          <label style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 18 }}><input type="checkbox" checked={newMember.is_visible} onChange={(e) => setNewMember({ ...newMember, is_visible: e.target.checked })} /> Show this person on the homepage</label>
          <button className="btn btn-primary" disabled={adding}>{adding ? "Uploading…" : "Add Team Member"}</button>
        </form>
      )}

      <div style={{ marginTop: 24 }}>
        {members.length === 0 && <div className="notice">No team members yet. Use “Add Team Member” to create the first profile.</div>}
        {members.map((member) => {
          const imageUrl = publicImageUrl(member.image_path);
          return (
            <div className="card" key={member.id} style={{ marginBottom: 18 }}>
              <div style={{ display: "grid", gridTemplateColumns: imageUrl ? "110px 1fr" : "1fr", gap: 18, alignItems: "start" }}>
                {imageUrl && <img src={imageUrl} alt={member.name} style={{ width: 110, height: 110, borderRadius: 14, objectFit: "cover" }} />}
                <div>
                  <div className="field"><label>Name</label><input value={member.name} onChange={(e) => updateLocal(member.id, { name: e.target.value })} /></div>
                  <div className="field"><label>Bio</label><textarea value={member.bio} onChange={(e) => updateLocal(member.id, { bio: e.target.value })} /></div>
                  <div className="field-grid">
                    <div className="field"><label>Display order</label><input type="number" value={member.sort_order} onChange={(e) => updateLocal(member.id, { sort_order: Number(e.target.value) })} /></div>
                    <div className="field"><label>Replace photo</label><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => replaceImage(member, e)} disabled={savingId === member.id} /></div>
                  </div>
                  <div className="actions" style={{ alignItems: "center" }}>
                    <button className="btn btn-primary" type="button" onClick={() => saveMember(member)} disabled={savingId === member.id}>{savingId === member.id ? "Saving…" : "Save"}</button>
                    <button className="btn btn-secondary" type="button" onClick={() => toggleVisibility(member)}>{member.is_visible ? "Hide from Homepage" : "Show on Homepage"}</button>
                    <button className="btn btn-secondary" type="button" onClick={() => deleteMember(member)} disabled={savingId === member.id}>Delete</button>
                    <span style={{ opacity: .8, fontSize: 14 }}>{member.is_visible ? "Visible" : "Hidden"}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {status && <div className="status" aria-live="polite" style={{ marginTop: 16 }}>{status}</div>}
    </section>
  );
}
