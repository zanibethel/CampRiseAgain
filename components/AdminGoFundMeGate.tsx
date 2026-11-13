"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import {campAdminAllowed} from "@/lib/camp-admin-access";
import GoFundMeAdmin from "@/components/GoFundMeAdmin";



export default function AdminGoFundMeGate() {
  const pathname = usePathname();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (pathname !== "/admin") {
      setAllowed(false);
      return;
    }

    let mounted=true;
    const check=async(token?:string)=>{
      const active=token?await campAdminAllowed(token):false;
      if(mounted)setAllowed(active);
    };
    void supabase.auth.getSession().then(({data})=>check(data.session?.access_token));
    const {data:listener}=supabase.auth.onAuthStateChange((_event,session)=>{
      // Do not await an API call inside the Supabase auth callback.
      void check(session?.access_token);
    });

    return () => {mounted=false;listener.subscription.unsubscribe();};
  }, [pathname, supabase]);

  if (pathname !== "/admin" || !allowed) return null;

  return (
    <div className="form-wrap" style={{ maxWidth: 980, paddingTop: 0 }}>
      <GoFundMeAdmin />
    </div>
  );
}
