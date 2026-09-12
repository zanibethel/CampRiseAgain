"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type TeamMember = {
  id: number;
  name: string;
  bio: string;
  image_path: string;
  sort_order: number;
};

export default function TeamSection() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [members, setMembers] = useState<TeamMember[]>([]);

  useEffect(() => {
    supabase
      .from("camp_rise_again_team_members")
      .select("id,name,bio,image_path,sort_order")
      .eq("is_visible", true)
      .order("sort_order")
      .order("id")
      .then(({ data }) => {
        if (data) setMembers(data as TeamMember[]);
      });
  }, [supabase]);

  if (members.length === 0) return null;

  return (
    <section id="team" className="section">
      <div className="eyebrow">Meet the team</div>
      <h2>The people helping Camp Rise Again come to life.</h2>
      <div className="cards" style={{ marginTop: 24 }}>
        {members.map((member) => {
          const imageUrl = member.image_path
            ? supabase.storage.from("camp-rise-again-team").getPublicUrl(member.image_path).data.publicUrl
            : "";
          return (
            <article className="card" key={member.id} style={{ overflow: "hidden" }}>
              {imageUrl && (
                <img
                  src={imageUrl}
                  alt={member.name}
                  style={{ width: "100%", aspectRatio: "4 / 3", objectFit: "cover", borderRadius: 14, marginBottom: 16 }}
                />
              )}
              <h3>{member.name}</h3>
              {member.bio && <p>{member.bio}</p>}
            </article>
          );
        })}
      </div>
    </section>
  );
}
