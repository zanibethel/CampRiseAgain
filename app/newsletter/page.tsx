"use client";

import { FormEvent, useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";

export default function NewsletterPage(){
  const [mode,setMode]=useState("subscribe");
  const [email,setEmail]=useState("");
  const [token,setToken]=useState("");
  const [name,setName]=useState("");
  const [consent,setConsent]=useState(false);
  const [busy,setBusy]=useState(false);
  const [status,setStatus]=useState("");
  useEffect(()=>{
    const search=new URLSearchParams(window.location.search);
    const next=search.get("mode")||"subscribe";
    setMode(["subscribe","confirm","unsubscribe"].includes(next)?next:"subscribe");
    setEmail(search.get("email")||"");
    setToken(search.get("token")||"");
  },[]);
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setStatus("");
    try{
      const response=await fetch("/api/newsletter",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({action:mode,email,token,name,consent}),
      });
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||"Request failed.");
      setStatus(result.message||"Request completed.");
    }catch(error){setStatus(error instanceof Error?error.message:"Please try again.");}
    finally{setBusy(false);}
  }
  return <><SiteHeader/><main className="form-wrap" style={{maxWidth:650}}>
    <div className="eyebrow">Stay connected</div>
    <h1>Camp Rise Again Updates</h1>
    {mode==="subscribe"&&<p className="section-copy">Get occasional camp announcements, volunteer opportunities, event news and the Camp Rise Again newsletter. Signing up is optional and separate from camp applications.</p>}
    {mode==="confirm"&&<p className="section-copy">Confirm your email address to receive Camp Rise Again announcements and newsletters.</p>}
    {mode==="unsubscribe"&&<p className="section-copy">You can stop Camp Rise Again newsletters and promotional announcements at any time.</p>}
    <form className="form-card" onSubmit={submit}>
      {mode==="subscribe"&&<div className="field"><label htmlFor="news-name">Name (optional)</label>
        <input id="news-name" autoComplete="name" maxLength={120} value={name} onChange={e=>setName(e.target.value)}/></div>}
      <div className="field"><label htmlFor="news-email">Email address</label>
        <input id="news-email" type="email" required maxLength={254} autoComplete="email" value={email}
          disabled={mode!=="subscribe"} onChange={e=>setEmail(e.target.value)}/></div>
      {mode==="subscribe"&&<label className="checks" style={{display:"flex",gap:10,alignItems:"flex-start"}}>
        <input type="checkbox" required checked={consent} onChange={e=>setConsent(e.target.checked)}/>
        I agree to receive Camp Rise Again announcements and newsletters by email. I can unsubscribe at any time.
      </label>}
      <button className="btn btn-primary" disabled={busy||((mode!=="subscribe")&&!token)}>
        {busy?"Working…":mode==="confirm"?"Confirm My Subscription":mode==="unsubscribe"?"Unsubscribe":"Subscribe to Updates"}
      </button>
      {status&&<p className="status" role="status" aria-live="polite">{status}</p>}
      <p className="section-copy" style={{marginTop:16}}>
        This newsletter is not an emergency support service. If you're in immediate danger, call 911 or call/text 988 in the U.S.
      </p>
    </form>
  </main></>;
}
