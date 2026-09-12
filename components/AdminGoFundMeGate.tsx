"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import GoFundMeAdmin from "@/components/GoFundMeAdmin";

const ADMINS = ["schofieldtierra@gmail.com", "zanibethel@gmail.com"];

export default function AdminGoFundMeGate() {
  const pathname = usePathname();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (pathname !== "/admin") {
      setAllowed(false);
      return;
    }

    supabase.auth.getUser().then(({ data }) => {
      const email = data.user?.email?.toLowerCase() || "";
      setAllowed(ADMINS.includes(email));
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const email = session?.user?.email?.toLowerCase() || "";
      setAllowed(ADMINS.includes(email));
    });

    return () => listener.subscription.unsubscribe();
  }, [pathname, supabase]);

  if (pathname !== "/admin" || !allowed) return null;

  return (
    <div className="form-wrap" style={{ maxWidth: 980, paddingTop: 0 }}>
      <GoFundMeAdmin />
    </div>
  );
}
