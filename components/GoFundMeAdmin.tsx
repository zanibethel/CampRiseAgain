"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

const DEFAULT_URL = "https://gofund.me/4e650f52a";

export default function GoFundMeAdmin() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [url, setUrl] = useState(DEFAULT_URL);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!supabase) return;
    supabase
      .from("site_settings")
      .select("gofundme_url")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.gofundme_url) setUrl(data.gofundme_url);
      });
  }, [supabase]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;

    const trimmed = url.trim();
    if (!/^https:\/\//i.test(trimmed)) {
      setStatus("Enter a full secure URL beginning with https://");
      return;
    }

    setStatus("Saving GoFundMe link…");
    const { error } = await supabase
      .from("site_settings")
      .update({ gofundme_url: trimmed })
      .eq("id", 1);

    setStatus(error ? error.message : "GoFundMe link updated.");
  }

  return (
    <form className="form-card" onSubmit={save} style={{ marginTop: 24 }}>
      <h2>GoFundMe</h2>
      <p className="section-copy">Update the donation link used by the Donate on GoFundMe button on the homepage.</p>
      <div className="field">
        <label htmlFor="gofundmeUrl">GoFundMe URL</label>
        <input
          id="gofundmeUrl"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://gofund.me/..."
          required
        />
      </div>
      <button className="btn btn-primary">Save GoFundMe URL</button>
      {status && <div className="status" aria-live="polite">{status}</div>}
    </form>
  );
}
