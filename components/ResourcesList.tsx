"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type ResourceItem = {
  id: number;
  title: string;
  description: string;
  href: string;
  action_label: string;
  category: string;
  sort_order: number;
};

export default function ResourcesList() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase
      .from("resources")
      .select("id,title,description,href,action_label,category,sort_order")
      .order("sort_order")
      .order("id")
      .then(({ data }) => {
        setResources((data || []) as ResourceItem[]);
        setLoading(false);
      });
  }, [supabase]);

  if (loading) {
    return <p className="section-copy">Loading resources…</p>;
  }

  if (!resources.length) {
    return <p className="section-copy">Additional support resources will be added here soon.</p>;
  }

  return (
    <div className="cards">
      {resources.map((resource) => (
        <article className="card" key={resource.id}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>{resource.category}</div>
          <h3>{resource.title}</h3>
          <p className="section-copy">{resource.description}</p>
          <div className="actions">
            <a
              className="btn btn-primary"
              href={resource.href}
              target="_blank"
              rel="noreferrer"
            >
              {resource.action_label || "Learn More"}
            </a>
          </div>
        </article>
      ))}
    </div>
  );
}
