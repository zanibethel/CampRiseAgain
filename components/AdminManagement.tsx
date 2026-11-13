"use client";

import {FormEvent,useCallback,useEffect,useState} from "react";
import {getSupabaseBrowserClient} from "@/lib/supabase-browser";

type Member={
  email:string; enabled:boolean;is_protected:boolean;
  added_by:string|null;created_at:string;last_invited_at:string|null;
  revoked_at:string|null;account_status:"not_created"|"pending_confirmation"|"verified";
};

function accountStatus(member:Member):string{
  if(!member.enabled)return "Access removed";
  if(member.account_status==="verified")return "Account verified";
  if(member.account_status==="pending_confirmation")return "Email confirmation pending";
  return "Invite required";
}
function friendlyDate(date:string|null):string{
  if(!date)return "Not yet sent";
  return new Date(date).toLocaleDateString("en-US",{year:"numeric",month:"short",day:"numeric"});
}

export default function AdminManagement(){
  const [admins,setAdmins]=useState<Member[]>([]);
  const [me,setMe]=useState("");
  const [email,setEmail]=useState("");
  const [status,setStatus]=useState("");
  const [busy,setBusy]=useState("");
  const [loading,setLoading]=useState(true);

  const call=useCallback(async(method:"GET"|"POST"|"PATCH"|"DELETE",value?:{email:string})=>{
    const supabase=getSupabaseBrowserClient();
    const {data,error}=await supabase.auth.getSession();
    if(error||!data.session?.access_token)throw new Error("Sign in again to manage administrators.");
    const res=await fetch("/api/admin/admins",{
      method,
      headers:{
        Authorization:"Bearer "+data.session.access_token,
        ...(value?{"Content-Type":"application/json"}:{}),
      },
      body:value?JSON.stringify(value):undefined,
      cache:"no-store",
    });
    const result=await res.json().catch(()=>({error:"The server did not respond."}));
    if(!res.ok)throw new Error(result.error||"Could not update administrator access.");
    return result;
  },[]);

  const refresh=useCallback(async()=>{
    try{
      const result=await call("GET");
      setAdmins(Array.isArray(result.admins)?result.admins:[]);
      setMe(result.email||"");
    }catch(error){
      setStatus(error instanceof Error?error.message:"Could not list administrators.");
    }finally{setLoading(false);}
  },[call]);

  useEffect(()=>{void refresh();},[refresh]);

  async function add(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(busy)return;
    setBusy("add");setStatus("");
    try{
      const normalized=email.trim().toLowerCase();
      const result=await call("POST",{email:normalized});
      setStatus(result.message||"Administrator approved.");
      setEmail("");
      await refresh();
    }catch(error){
      setStatus(error instanceof Error?error.message:"Could not add administrator.");
    }finally{setBusy("");}
  }
  async function resend(member:Member){
    if(busy)return;
    setBusy(member.email);setStatus("");
    try{
      const result=await call("PATCH",{email:member.email});
      setStatus(result.message||"Secure invitation sent.");
      await refresh();
    }catch(error){
      setStatus(error instanceof Error?error.message:"Could not resend invitation.");
    }finally{setBusy("");}
  }
  async function revoke(member:Member){
    if(busy||member.is_protected||member.email===me)return;
    if(!window.confirm("Remove Camp Rise Again admin access for "+member.email+"? This does not delete their personal Supabase account or email forwarding."))return;
    setBusy(member.email);setStatus("");
    try{
      const result=await call("DELETE",{email:member.email});
      setStatus(result.message||"Administrator access removed.");
      await refresh();
    }catch(error){
      setStatus(error instanceof Error?error.message:"Could not remove access.");
    }finally{setBusy("");}
  }

  return <section className="form-card" aria-label="Camp administrator management">
    <h2>Admin Management</h2>
    <p className="section-copy">
      Every active Camp Rise Again administrator can invite and manage teammates.
      New administrators receive an email from <strong>support@campriseagain.org</strong>
      to create a password. Their personal email forwarding is configured separately.
    </p>

    <form onSubmit={add} style={{margin:"22px 0",display:"flex",flexWrap:"wrap",gap:10,alignItems:"end"}}>
      <div className="field" style={{flex:"1 1 240px",margin:0,minWidth:0}}>
        <label htmlFor="camp-new-admin">Add an administrator</label>
        <input id="camp-new-admin" type="email" required autoComplete="off"
          placeholder="teammate@example.com" value={email}
          onChange={e=>setEmail(e.target.value)} disabled={!!busy}/>
      </div>
      <button className="btn btn-primary" type="submit" disabled={!!busy}>
        {busy==="add"?"Sending…":"+ Add & Invite Admin"}
      </button>
    </form>

    {loading?<p className="section-copy">Loading administrators…</p>:
      <div style={{display:"grid",gap:12}}>
        {admins.map(member=><div key={member.email} className="card"
          style={{padding:16,display:"flex",flexWrap:"wrap",gap:12,alignItems:"center",justifyContent:"space-between"}}>
          <div style={{minWidth:0,flex:"1 1 240px"}}>
            <strong style={{overflowWrap:"anywhere"}}>{member.email}</strong>
            <div style={{fontSize:13,marginTop:5}}>
              <span style={{fontWeight:600}}>{accountStatus(member)}</span>
              {member.is_protected?" · Recovery admin":""}
            </div>
            <div style={{fontSize:12,opacity:.72,marginTop:4}}>
              Last access email: {friendlyDate(member.last_invited_at)}
            </div>
          </div>
          <div className="actions" style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
            {member.enabled?
              <button className="btn btn-secondary" type="button"
                disabled={!!busy} onClick={()=>void resend(member)}>
                {busy===member.email?"Sending…":"Resend Access Email"}
              </button>:
              <button className="btn btn-secondary" type="button"
                disabled={!!busy} onClick={async()=>{
                  setBusy(member.email);setStatus("");
                  try{const result=await call("POST",{email:member.email});
                    setStatus(result.message||"Administrator restored.");await refresh();
                  }catch(e){setStatus(e instanceof Error?e.message:"Could not restore administrator.");}
                  finally{setBusy("");}
                }}>Restore Access</button>}
            {member.enabled&&!member.is_protected&&member.email!==me&&
              <button className="btn btn-secondary" type="button"
                disabled={!!busy} onClick={()=>void revoke(member)}>
                Remove Access
              </button>}
          </div>
        </div>)}
        {admins.length===0&&<p className="section-copy">No administrators found.</p>}
      </div>
    }
    {status&&<p className="status" role="status" aria-live="polite">{status}</p>}
    <p className="section-copy" style={{marginTop:16}}>
      Removed administrators lose access to Camp content and forms. Their shared
      Supabase account, other projects, and forwarding settings are not deleted.
      You cannot remove yourself or the protected recovery administrator.
    </p>
  </section>;
}
