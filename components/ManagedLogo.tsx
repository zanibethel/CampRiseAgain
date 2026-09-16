"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

const FALLBACK = "/3426A745-DDB8-4CB7-8BBC-9DC68C16B20A.png";

type Props = {
  width: number;
  height: number;
  className?: string;
  priority?: boolean;
};

export default function ManagedLogo({ width, height, className, priority = false }: Props) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [src, setSrc] = useState(FALLBACK);

  useEffect(() => {
    if (!supabase) return;
    supabase
      .from("site_settings")
      .select("logo_path")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.logo_path) {
          const url = supabase.storage.from("camp-rise-again-branding").getPublicUrl(data.logo_path).data.publicUrl;
          if (url) setSrc(url);
        }
      });
  }, [supabase]);

  return <Image src={src} alt="Camp Rise Again" width={width} height={height} className={className} priority={priority} unoptimized={src.startsWith("http")} />;
}
