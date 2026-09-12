"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

const DEFAULT_URL = "https://gofund.me/4e650f52a";

export default function DonateButton() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [url, setUrl] = useState(DEFAULT_URL);

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

  return (
    <a className="btn btn-primary" href={url} target="_blank" rel="noopener noreferrer">
      Donate on GoFundMe
    </a>
  );
}
