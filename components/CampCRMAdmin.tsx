"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type Contact={
  email:string;display_name:string;phone:string;source_kinds:string[];stage:string;
  tags:string[];notes:string;last_engaged_at:string|null;mailing_status:string;
};
type Campaign={
  id:string;kind:"announcement"|"newsletter";purpose:"community"|"commercial";subject:string;body:string;
  status:"draft"|"sending"|"sent";created_at:string;completed_at:string|null;
};
type ContactsResponse={contacts:Contact[];total:number;truncated:boolean};
type MailingSettings={
  postal_address:string;address_confirmed:boolean;updated_at:string|null;updated_by:string;
};
type CampaignsResponse={campaigns:Campaign[];subscribers:number;
  mailing_settings:MailingSettings;mailing_ready:boolean};
const stages=["new","follow_up","active","alumni","archived"] as const;
const stageName=(stage:string)=>stage.replaceAll("_"," ").replace(/\b\w/g,x=>x.toUpperCase());

async function adminCall(view:string,body?:Record<string,unknown>) {
  const {data,error}=await getSupabaseBrowserClient().auth.getSession();
  if(error||!data.session?.access_token)throw new Error("Sign in to use the CRM.");
  const response=await fetch("/api/admin/crm"+(body?"":"?view="+view),{
    method:body?"POST":"GET",
    headers:{
      Authorization:"Bearer "+data.session.access_token,
      ...(body?{"Content-Type":"application/json"}:{}),
    },
    body:body?JSON.stringify(body):undefined,
    cache:"no-store",
  });
  const result=await response.json();
  if(!response.ok)throw new Error(result.error||"CRM request failed.");
  return result;
}

export default function CampCRMAdmin() {
  const [section,setSection]=useState<"contacts"|"campaigns">("contacts");
  const [contacts,setContacts]=useState<Contact[]>([]);
  const [total,setTotal]=useState(0);
  const [truncated,setTruncated]=useState(false);
  const [campaigns,setCampaigns]=useState<Campaign[]>([]);
  const [subscribers,setSubscribers]=useState(0);
  const [mailingSettings,setMailingSettings]=useState<MailingSettings>({
    postal_address:"",address_confirmed:false,updated_at:null,updated_by:"",
  });
  const [mailingAddress,setMailingAddress]=useState("");
  const [mailingConfirmed,setMailingConfirmed]=useState(false);
  const [mailingReady,setMailingReady]=useState(false);
  const [selected,setSelected]=useState<Contact|null>(null);
  const [search,setSearch]=useState("");
  const [status,setStatus]=useState("");
  const [busy,setBusy]=useState(false);
  const [newContact,setNewContact]=useState<{display_name:string;email:string;phone:string;tags:string[];notes:string}>({display_name:"",email:"",phone:"",tags:[],notes:""});
  const [draft,setDraft]=useState<{id?:string;kind:"announcement"|"newsletter";purpose:"community"|"commercial";subject:string;body:string}>({
    kind:"announcement",purpose:"community",subject:"",body:"",
  });

  const loadContacts=useCallback(async()=>{
    const data=await adminCall("contacts") as ContactsResponse;
    setContacts(data.contacts||[]);setTotal(data.total||0);setTruncated(Boolean(data.truncated));
  },[]);
  const loadCampaigns=useCallback(async()=>{
    const data=await adminCall("campaigns") as CampaignsResponse;
    setCampaigns(data.campaigns||[]);setSubscribers(data.subscribers||0);
    const settings=data.mailing_settings||{postal_address:"",address_confirmed:false,updated_at:null,updated_by:""};
    setMailingSettings(settings);
    setMailingAddress(settings.postal_address);
    setMailingConfirmed(settings.address_confirmed);
    setMailingReady(Boolean(data.mailing_ready));
  },[]);
  useEffect(()=>{
    let active=true;
    setBusy(true);
    Promise.all([loadContacts(),loadCampaigns()])
      .catch(error=>{if(active)setStatus(error instanceof Error?error.message:"CRM unavailable.");})
      .finally(()=>{if(active)setBusy(false);});
    return()=>{active=false;};
  },[loadContacts,loadCampaigns]);

  const visible=useMemo(()=>{
    const q=search.trim().toLowerCase();
    return contacts.filter(c=>!q||[c.email,c.display_name,c.phone,...c.tags,...c.source_kinds]
      .some(x=>x.toLowerCase().includes(q)));
  },[contacts,search]);
  const mailingHasChanges=mailingAddress.trim()!==mailingSettings.postal_address ||
    mailingConfirmed!==mailingSettings.address_confirmed;
  const canSend=(purpose:"community"|"commercial")=>
    purpose==="community" || (mailingReady && !mailingHasChanges);
  async function saveMailingSettings(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setStatus("");
    try{
      await adminCall("campaigns",{action:"update_mailing_settings",
        postal_address:mailingAddress,address_confirmed:mailingConfirmed});
      await loadCampaigns();
      setStatus(mailingConfirmed?"Organization mailing address saved and confirmed.":
        "Mailing address saved as incomplete. Sending remains disabled until confirmed.");
    }catch(error){
      setStatus(error instanceof Error?error.message:"Unable to save mailing details.");
    }finally{setBusy(false);}
  }
  async function addContact(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setStatus("");
    try{
      await adminCall("contacts",{action:"add_contact",...newContact});
      await loadContacts();setNewContact({display_name:"",email:"",phone:"",tags:[],notes:""});
      setStatus("Contact added.");
    }catch(error){setStatus(error instanceof Error?error.message:"Unable to add contact.");}
    finally{setBusy(false);}
  }
  async function exportContacts(){
    if(busy)return;
    setBusy(true);setStatus("");
    try{
      const {data,error}=await getSupabaseBrowserClient().auth.getSession();
      if(error||!data.session?.access_token)throw new Error("Sign in again to export contacts.");
      const response=await fetch("/api/admin/crm/export",{
        headers:{Authorization:"Bearer "+data.session.access_token},cache:"no-store",
      });
      if(!response.ok)throw new Error("Could not export contacts.");
      const truncated=response.headers.get("X-Export-Truncated")==="true";
      const blob=await response.blob();
      const url=URL.createObjectURL(blob);
      const a=document.createElement("a");
      a.href=url;a.download="camp-rise-again-contacts.csv";
      document.body.appendChild(a);a.click();a.remove();
      window.setTimeout(()=>URL.revokeObjectURL(url),1000);
      setStatus(truncated
        ?"Contacts CSV downloaded; export limit reached, so some contacts were not included."
        :"Contacts CSV downloaded. Keep it private because it includes internal notes.");
    }catch(error){setStatus(error instanceof Error?error.message:"Export unavailable.");}
    finally{setBusy(false);}
  }
  async function saveContact(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(!selected)return;
    setBusy(true);setStatus("");
    try{
      await adminCall("contacts",{action:"update_contact",...selected});
      await loadContacts();setStatus("Contact updated.");
    }catch(error){setStatus(error instanceof Error?error.message:"Unable to update contact.");}
    finally{setBusy(false);}
  }
  async function saveDraft(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setStatus("");
    try{
      const saved=await adminCall("campaigns",{action:"save_campaign",...draft});
      setDraft({...draft,id:saved.id});await loadCampaigns();
      setStatus("Draft saved. Nothing has been sent.");
    }catch(error){setStatus(error instanceof Error?error.message:"Could not save draft.");}
    finally{setBusy(false);}
  }
  async function beginCampaign(id:string){
    const item=campaigns.find(c=>c.id===id);
    if(!item || !canSend(item.purpose))return;
    const notice=item.purpose==="community"?
      "Confirm that this is a noncommercial community message, not an advertisement for commercial goods or services. ":
      "This is a commercial promotion, and the verified postal address will appear in its footer. ";
    if(!window.confirm(notice+"Send “"+item.subject+"” to up to "+subscribers+
      " confirmed subscribers? This cannot be undone once sending begins."))return;
    setBusy(true);setStatus("Preparing subscriber delivery queue…");
    try{
      await adminCall("campaigns",{action:"begin_campaign",id,
        noncommercial_reviewed:item.purpose==="community"});
      await loadCampaigns();setStatus("Queue prepared. Sending confirmed subscribers…");
      await continueCampaign(id);
    }catch(error){setStatus(error instanceof Error?error.message:"Campaign could not start.");}
    finally{setBusy(false);}
  }
  async function continueCampaign(id:string){
    setBusy(true);
    let delivered=0,failures=0;
    try{
      // Small durable batches work around serverless execution limits.
      for(let batch=0;batch<55;batch++){
        const result=await adminCall("campaigns",{action:"send_batch",id});
        delivered+=Number(result.sent||0);failures+=Number(result.failed||0);
        const remaining=Number(result.remaining||0);
        setStatus("Sent "+delivered+" email(s), "+failures+
          " failed. "+remaining+" delivery record(s) remain.");
        if(result.completed || (result.sent===0 && result.failed===0))break;
      }
      await loadCampaigns();
      setStatus("Campaign run finished for now: "+delivered+" delivered, "+failures+
        " failed. Reopen a still-sending campaign to resume outstanding batches.");
    }catch(error){
      setStatus((error instanceof Error?error.message:"Delivery interrupted.")+
        " Completed emails are recorded; use Resume to continue safely.");
    }finally{setBusy(false);}
  }

  return <section className="form-card" aria-label="Camp Rise Again CRM">
    <h2>Contacts &amp; Announcements</h2>
    <p className="section-copy">One contact per email across camp applications, volunteer forms, inquiries and newsletter signups. Intake answers stay in the protected Form Submissions panel.</p>
    <div className="actions" style={{marginBottom:20}}>
      <button type="button" className={"btn "+(section==="contacts"?"btn-primary":"btn-secondary")}
        onClick={()=>setSection("contacts")}>Contacts ({total})</button>
      <button type="button" className={"btn "+(section==="campaigns"?"btn-primary":"btn-secondary")}
        onClick={()=>setSection("campaigns")}>Announcements &amp; Newsletters</button>
    </div>
    {status&&<p className="status" role="status" aria-live="polite">{status}</p>}
    {section==="contacts"&&<>
      <div className="card" style={{marginBottom:18}}>
        <h3>Add contact</h3>
        <form onSubmit={addContact}>
          <div className="field-grid">
            <div className="field"><label>Name</label><input required maxLength={160} value={newContact.display_name} onChange={e=>setNewContact({...newContact,display_name:e.target.value})}/></div>
            <div className="field"><label>Email</label><input required type="email" value={newContact.email} onChange={e=>setNewContact({...newContact,email:e.target.value})}/></div>
            <div className="field"><label>Phone (optional)</label><input maxLength={40} value={newContact.phone} onChange={e=>setNewContact({...newContact,phone:e.target.value})}/></div>
          </div>
          <fieldset style={{border:0,padding:0,margin:"16px 0"}}>
            <legend style={{fontWeight:700,marginBottom:10}}>Contact type (select both if applicable)</legend>
            <div style={{display:"flex",flexWrap:"wrap",gap:22}}>
              {(["camper","volunteer"] as const).map(role=>
                <label key={role} className="checks" style={{display:"flex",alignItems:"center",gap:8}}>
                  <input type="checkbox" checked={newContact.tags.includes(role)}
                    onChange={event=>setNewContact({...newContact,tags:event.target.checked
                      ? [...newContact.tags.filter(t=>t!==role),role]
                      : newContact.tags.filter(t=>t!==role)})}/>
                  {role==="camper"?"Camper":"Volunteer"}
                </label>
              )}
            </div>
          </fieldset>
          <div className="field"><label htmlFor="camp-contact-new-notes">Internal notes (private)</label>
            <textarea id="camp-contact-new-notes" rows={3} maxLength={1000}
              placeholder="For example: Contacted through Instagram on Nov 12; follow up about volunteering"
              value={newContact.notes}
              onChange={event=>setNewContact({...newContact,notes:event.target.value})}/>
            <small>Avoid personal health details. Notes will be included in admin CSV exports.</small>
          </div>
          <button className="btn btn-secondary" disabled={busy}>+ Add Contact</button>
        </form>
        <p className="section-copy" style={{marginTop:12}}>Adding a person does not sign them up for promotional email. They must confirm their own subscription.</p>
      </div>
      <div className="actions" style={{margin:"16px 0"}}>
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={()=>void exportContacts()}>
          Export Contacts CSV
        </button>
        <small>Private download includes contact tags and notes. Store it securely.</small>
      </div>
      <div className="field" style={{marginBottom:14}}>
        <label htmlFor="crm-search">Search contacts</label>
        <input id="crm-search" type="search" placeholder="Name, email, tag or relationship" value={search} onChange={e=>setSearch(e.target.value)}/>
      </div>
      <p className="section-copy">Showing {visible.length} of {total} contact(s). {truncated?"Showing the 500 most recent contacts; server-side pagination is still needed for larger lists.":""}</p>
      <div style={{display:"grid",gap:8,maxHeight:390,overflowY:"auto",marginBottom:20}}>
        {visible.map(c=><button type="button" key={c.email} className="card" onClick={()=>setSelected({...c})}
          style={{textAlign:"left",cursor:"pointer",border:selected?.email===c.email?"2px solid currentColor":undefined}}>
          <strong>{c.display_name||c.email}</strong>
          <div style={{fontSize:13,overflowWrap:"anywhere"}}>{c.email} · {stageName(c.stage)} · {c.source_kinds.join(", ")||"Newsletter"}</div>
          <div style={{fontSize:12,opacity:.8}}>Email updates: {stageName(c.mailing_status)}</div>
        </button>)}
      </div>
      {selected&&<form className="card" onSubmit={saveContact}>
        <h3>Edit contact</h3>
        <p className="section-copy">Email: {selected.email} (fixed for deduplication). Mailing consent cannot be overridden by staff.</p>
        <div className="field-grid">
          <div className="field"><label>Name</label><input required maxLength={160} value={selected.display_name} onChange={e=>setSelected({...selected,display_name:e.target.value})}/></div>
          <div className="field"><label>Phone</label><input maxLength={40} value={selected.phone} onChange={e=>setSelected({...selected,phone:e.target.value})}/></div>
          <div className="field"><label>Stage</label><select value={selected.stage} onChange={e=>setSelected({...selected,stage:e.target.value})}>
            {stages.map(s=><option key={s} value={s}>{stageName(s)}</option>)}</select></div>
          <div className="field"><label>Tags (comma separated, up to 12)</label>
            <input value={selected.tags.join(", ")} onChange={e=>setSelected({...selected,
              tags:e.target.value.split(",").map(x=>x.trim()).filter(Boolean).slice(0,12)})}/></div>
        </div>
        <fieldset style={{border:0,padding:0,margin:"12px 0"}}>
          <legend style={{fontWeight:700,marginBottom:8}}>Contact type</legend>
          <div style={{display:"flex",flexWrap:"wrap",gap:22}}>
            {(["camper","volunteer"] as const).map(role=>
              <label key={role} className="checks" style={{display:"flex",alignItems:"center",gap:8}}>
                <input type="checkbox" checked={selected.tags.includes(role)}
                  onChange={event=>setSelected({...selected,tags:event.target.checked
                    ? [...selected.tags.filter(t=>t!==role),role]
                    : selected.tags.filter(t=>t!==role)})}/>
                {role==="camper"?"Camper":"Volunteer"}
              </label>
            )}
          </div>
        </fieldset>
        <div className="field"><label>Internal notes (private, non-clinical; included in CSV exports)</label>
          <textarea maxLength={1000} rows={3} value={selected.notes} onChange={e=>setSelected({...selected,notes:e.target.value})}/></div>
        <div className="actions"><button className="btn btn-primary" disabled={busy}>Save Contact</button>
          <button type="button" className="btn btn-secondary" onClick={()=>setSelected(null)}>Close</button></div>
      </form>}
    </>}
    {section==="campaigns"&&<>
      <div className="card" style={{marginBottom:18}}>
        <h3>Confirmed mailing list: {subscribers}</h3>
        <p className="section-copy">Only people who used the email confirmation link receive newsletters or announcements. Sending is manually initiated and includes an unsubscribe link for every recipient.</p>
        <a href="/newsletter" className="btn btn-secondary" target="_blank" rel="noreferrer">Preview Subscription Page</a>
      </div>
      <form className="card" onSubmit={saveMailingSettings} style={{marginBottom:18}}>
        <h3>Organization Mailing Details</h3>
        <p className="section-copy">This optional address will appear in all newsletter and announcement footers once saved. Noncommercial camp updates may be sent without it; commercial promotions require a confirmed postal address.</p>
        <p className="section-copy" role="status" style={{fontWeight:700}}>
          {mailingReady?"Mailing address confirmed — included in email footers":
            "Mailing address not yet provided — noncommercial updates are still available"}
        </p>
        <div className="field">
          <label htmlFor="camp-mailing-address">Organization physical mailing address or PO Box</label>
          <textarea id="camp-mailing-address" rows={3} maxLength={500}
            placeholder="Official Camp Rise Again postal mailing address or PO Box"
            value={mailingAddress}
            onChange={event=>{setMailingAddress(event.target.value);setMailingConfirmed(false);}}/>
        </div>
        <label className="checks" style={{display:"flex",alignItems:"flex-start",gap:10,marginTop:8}}>
          <input type="checkbox" checked={mailingConfirmed} disabled={!mailingAddress.trim()}
            onChange={event=>setMailingConfirmed(event.target.checked)}/>
          I confirm this is Camp Rise Again’s actual postal mailing address (or PO Box) and may appear in outgoing emails.
        </label>
        <div className="actions" style={{marginTop:12}}>
          <button type="submit" className="btn btn-secondary" disabled={busy ||
            !mailingHasChanges || (mailingAddress.trim().length>0 && !mailingConfirmed)}>
            Save Mailing Details
          </button>
        </div>
        {mailingSettings.updated_at&&<p className="section-copy">
          Last saved {new Date(mailingSettings.updated_at).toLocaleString()}
          {mailingSettings.updated_by?" by "+mailingSettings.updated_by:""}.
        </p>}
        {!mailingReady&&<p className="section-copy">Noncommercial newsletters and camp announcements can be sent without an address. Save the actual postal address before using the commercial promotions option.</p>}
      </form>
      <form className="card" onSubmit={saveDraft}>
        <h3>{draft.id?"Edit draft":"Create announcement or newsletter"}</h3>
        <div className="field"><label>Type</label><select value={draft.kind} onChange={e=>setDraft({...draft,kind:e.target.value as "announcement"|"newsletter"})}>
          <option value="announcement">Announcement</option><option value="newsletter">Newsletter</option>
        </select></div>
        <div className="field"><label>Message purpose</label>
          <select value={draft.purpose} onChange={e=>setDraft({...draft,purpose:e.target.value as "community"|"commercial"})}>
            <option value="community">Noncommercial community update / camp newsletter</option>
            <option value="commercial">Commercial promotion of products or services</option>
          </select>
          <p className="section-copy">Choose by the actual primary purpose of the message. Noncommercial updates may include camp dates, volunteering, and mental health resources. If you promote paid products or commercial services, choose commercial; a confirmed postal address is then required.</p>
        </div>
        <div className="field"><label>Email subject</label>
          <input required minLength={3} maxLength={150} value={draft.subject} onChange={e=>setDraft({...draft,subject:e.target.value})}/></div>
        <div className="field"><label>Message (plain text)</label>
          <textarea required minLength={10} maxLength={12000} rows={8} value={draft.body} onChange={e=>setDraft({...draft,body:e.target.value})}/></div>
        <div className="actions"><button disabled={busy} className="btn btn-primary">Save Draft</button>
          <button type="button" className="btn btn-secondary" onClick={()=>setDraft({kind:"announcement",purpose:"community",subject:"",body:""})}>New Draft</button></div>
        <p className="section-copy">Preview the content before sending. The footer and personalized unsubscribe link are added automatically.</p>
        {draft.body&&<div style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere",borderTop:"1px solid #ddd",marginTop:14,paddingTop:14}}>
          <strong>{draft.subject||"Subject preview"}</strong><p>{draft.body}</p>
          <small>Camp Rise Again · Subscription management link added per recipient · {draft.purpose==="commercial"?"Commercial message — mailing address required":"Community update — mailing address optional"}</small>
        </div>}
      </form>
      <h3 style={{marginTop:24}}>Campaigns</h3>
      <div style={{display:"grid",gap:10}}>
        {campaigns.map(item=><div className="card" key={item.id}>
          <strong>{item.subject}</strong><div style={{fontSize:13,margin:"5px 0"}}>{stageName(item.kind)} · {item.purpose==="commercial"?"Commercial":"Community"} · {stageName(item.status)} · {new Date(item.created_at).toLocaleDateString()}</div>
          <div className="actions">
            {item.status==="draft"&&<>
              <button type="button" className="btn btn-secondary" onClick={()=>setDraft({id:item.id,kind:item.kind,purpose:item.purpose,subject:item.subject,body:item.body})}>Edit</button>
              <button type="button" disabled={busy||subscribers===0||!canSend(item.purpose)} className="btn btn-primary" onClick={()=>void beginCampaign(item.id)}>Confirm &amp; Send</button>
            </>}
            {item.status==="sending"&&<button type="button" className="btn btn-primary" disabled={busy||!canSend(item.purpose)} onClick={()=>void continueCampaign(item.id)}>Resume Sending</button>}
          </div>
        </div>)}
        {!campaigns.length&&<p className="section-copy">No announcements yet. Save the first draft above.</p>}
      </div>
    </>}
  </section>;
}
