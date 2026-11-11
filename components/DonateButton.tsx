"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

const DEFAULT_URL = "https://gofund.me/80cd44483";

type DonateButtonProps = {
  label?: string;
  className?: string;
  onClick?: () => void;
};

export default function DonateButton({
  label = "Donate on GoFundMe",
  className = "btn btn-primary",
  onClick,
}: DonateButtonProps) {
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
    <a className={className} href={url} target="_blank" rel="noopener noreferrer" onClick={onClick}>
      {label}
    </a>
  );
}
