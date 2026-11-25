"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {getSupabaseBrowserClient} from "@/lib/supabase-browser";
import {aliasLocalPart} from "@/lib/camp-custom-alias";
type Alias={local_part:string;label:string;enabled:boolean;access_emails:string[];forwarder_ids:string[]};
type Person={id:string;email:string;display_name:string};
type Message={id:string;direction:string;from_email:string;to_email:string;subject:string;body?:string;state:string;read_at:string|null;archived:boolean;created_at:string;attachment_names:string[]};
async function call(query:Record<string,string>={},data?:Record<string,unknown>){
  const {data:auth}=await getSupabaseBrowserClient().auth.getSession();
  if(!auth.session?.access_token)throw new Error("Sign in again.");
  const r=await fetch("/api/admin/email-aliases"+(data?"":"?"+new URLSearchParams(query)),{method:data?"POST":"GET",
    headers:{Authorization:"Bearer "+auth.session.access_token,...(data?{"Content-Type":"application/json"}:{})},
    ...(data?{body:JSON.stringify(data)}:{}),cache:"no-store"});
  const result=await r.json();if(!r.ok)throw new Error(result.error||"Custom mail unavailable");return result;
}
const empty:Alias={local_part:"",label:"",enabled:true,access_emails:[],forwarder_ids:[]};
export default function CampAliasAdmin({mode}:{mode:"settings"|"inbox"}){
  const [aliases,setAliases]=useState<Alias[]>([]),[people,setPeople]=useState<Person[]>([]),[self,setSelf]=useState("");
  const [edit,setEdit]=useState<Alias>(empty),[access,setAccess]=useState(""),[selected,setSelected]=useState(""),[folder,setFolder]=useState("inbox");
  const [messages,setMessages]=useState<Message[]>([]),[message,setMessage]=useState<Message|null>(null),[page,setPage]=useState(0);
  const [to,setTo]=useState(""),[subject,setSubject]=useState(""),[body,setBody]=useState(""),[replyId,setReplyId]=useState("");
  const [status,setStatus]=useState(""),[busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false);
  const request=useRef(""),generation=useRef(0);
  const refresh=useCallback(async()=>{const r=await call();setAliases(r.aliases||[]);setPeople(r.recipients||[]);setSelf(r.email||"");},[]);
  const errorText=(e:unknown)=>e instanceof Error?e.message:"Mail operation failed.";
  useEffect(()=>{void refresh().catch(e=>setStatus(errorText(e)));},[refresh]);
  useEffect(()=>{
    if(mode!=="inbox")return;
    const g=++generation.current;setMessages([]);setMessage(null);setReplyId("");setBody("");setSubject("");setTo("");setUncertain(false);request.current="";
    if(!selected)return;
    void call({alias:selected,folder,page:String(page)}).then(r=>{if(g===generation.current)setMessages(r.messages||[]);}).catch(e=>{if(g===generation.current)setStatus(errorText(e));});
    return()=>{generation.current++;};
  },[selected,folder,page,mode]);
  function choose(a:Alias){setEdit(a);setAccess(a.access_emails.filter(x=>x!==self).join(", "));setStatus("");}
  async function save(){
    const local=aliasLocalPart(edit.local_part);
    if(!local||!edit.label.trim()){setStatus("Enter a valid address prefix and label.");return;}
    if(!window.confirm("Save access and forwarding settings for "+local+"@campriseagain.org?"))return;
    setBusy(true);setStatus("");
    try{await call({}, {action:"save",...edit,local_part:local,access_emails:access.split(",").map(x=>x.trim()).filter(Boolean)});
      await refresh();setEdit(empty);setAccess("");setStatus("Alias saved.");}
    catch(e){setStatus(errorText(e));}finally{setBusy(false);}
  }
  async function open(m:Message){
    const g=++generation.current;setMessage(null);setBusy(true);
    try{const r=await call({alias:selected,id:m.id});if(g!==generation.current)return;setMessage(r.message);
      if(m.direction==="inbound"&&!m.read_at){await call({}, {action:"mark",local_part:selected,id:m.id,read:true});if(g===generation.current)setMessages(old=>old.map(x=>x.id===m.id?{...x,read_at:new Date().toISOString()}:x));}}
    catch(e){if(g===generation.current)setStatus(errorText(e));}finally{setBusy(false);}
  }
  async function send(){
    if(!selected||!body.trim()||(!replyId&&(!to.trim()||!subject.trim()))||uncertain)return;
    if(!window.confirm("Send this official Camp Rise Again email?"))return;
    setBusy(true);setStatus("");request.current ||= crypto.randomUUID();
    try{await call({}, {action:"send",local_part:selected,request_id:request.current,reply_to_id:replyId||null,to_email:to,subject,body});
      request.current="";setBody("");setTo("");setSubject("");setReplyId("");setStatus("Message sent.");}
    catch(e){setUncertain(true);setStatus(errorText(e)+" Check Sent before composing again.");}finally{setBusy(false);}
  }
  async function mark(archived:boolean){
    if(!message)return;setBusy(true);
    try{await call({}, {action:"mark",local_part:selected,id:message.id,archived});setMessages(old=>old.filter(x=>x.id!==message.id));setMessage(null);}
    catch(e){setStatus(errorText(e));}finally{setBusy(false);}
  }
  if(mode==="settings")return <section className="form-card"><h2>Custom Email Addresses</h2>
    <p className="section-copy">Create addresses without another Resend inbox. Messages are private to explicitly selected Camp administrators. Only verified forwarding recipients can receive copies.</p>
    {aliases.map(a=><div className="card" key={a.local_part}><strong>{a.local_part}@campriseagain.org</strong><p>{a.label} · {a.enabled?"Active":"Paused"}</p>
      <p>Forwarding: {a.forwarder_ids.map(id=>people.find(p=>p.id===id)?.email||"Unavailable recipient").join(", ")||"None"}</p>
      <button type="button" className="btn btn-secondary" onClick={()=>choose(a)} disabled={busy}>Edit</button></div>)}
    <div className="field"><label>Address prefix</label><input value={edit.local_part} readOnly={aliases.some(a=>a.local_part===edit.local_part)} onChange={e=>setEdit({...edit,local_part:e.target.value})} placeholder="admin" maxLength={48}/><small>@campriseagain.org</small></div>
    <div className="field"><label>Display label</label><input value={edit.label} onChange={e=>setEdit({...edit,label:e.target.value})} maxLength={100}/></div>
    <div className="field"><label>Additional administrators who may read, send and manage (comma-separated login emails)</label><input value={access} onChange={e=>setAccess(e.target.value)} placeholder="director@example.com"/><small>Your own account is included.</small></div>
    <fieldset><legend>Forward to verified recipients</legend>{people.map(p=><label key={p.id} style={{display:"block"}}><input type="checkbox" checked={edit.forwarder_ids.includes(p.id)} onChange={()=>setEdit({...edit,forwarder_ids:edit.forwarder_ids.includes(p.id)?edit.forwarder_ids.filter(x=>x!==p.id):[...edit.forwarder_ids,p.id]})}/> {p.display_name} — {p.email}</label>)}
    <p>Add and verify new recipients above, then refresh this section.</p><button type="button" className="btn btn-secondary" disabled={busy} onClick={()=>void refresh().catch(e=>setStatus(errorText(e)))}>Refresh recipients</button></fieldset>
    <label><input type="checkbox" checked={edit.enabled} onChange={e=>setEdit({...edit,enabled:e.target.checked})}/> Receive and send mail</label>
    <div className="actions"><button className="btn btn-primary" disabled={busy} onClick={()=>void save()} type="button">Save address</button><button className="btn btn-secondary" type="button" disabled={busy} onClick={()=>{setEdit(empty);setAccess("");}}>New / clear</button></div>
    {status&&<p role="status">{status}</p>}</section>;
  return <section className="form-card"><h2>Custom Mailboxes</h2><p className="section-copy">Private mailboxes for your configured aliases.</p>
    <div className="field"><label>Mailbox</label><select disabled={busy} value={selected} onChange={e=>{setSelected(e.target.value);setPage(0);}}><option value="">Choose address</option>{aliases.map(a=><option key={a.local_part} value={a.local_part}>{a.local_part}@campriseagain.org{a.enabled?"":" (paused)"}</option>)}</select></div>
    {selected&&<><div className="actions">{["inbox","sent","archive"].map(f=><button key={f} className="btn btn-secondary" disabled={busy||f===folder} onClick={()=>{setFolder(f);setPage(0);}} type="button">{f}</button>)}</div>
      {messages.map(m=><button key={m.id} className="card" type="button" disabled={busy} onClick={()=>void open(m)} style={{display:"block",width:"100%",textAlign:"left",marginBottom:8}}><strong>{m.subject}</strong><div>{m.direction==="inbound"?m.from_email:m.to_email} · {m.state} · {new Date(m.created_at).toLocaleString()}{m.direction==="inbound"&&!m.read_at?" · Unread":""}</div></button>)}
      <div className="actions"><button type="button" disabled={busy||page===0} onClick={()=>setPage(p=>p-1)}>Previous</button><button type="button" disabled={busy||messages.length<30} onClick={()=>setPage(p=>p+1)}>Next</button></div>
      {message&&<div className="card"><h3>{message.subject}</h3><p>From: {message.from_email} · To: {message.to_email}</p><p style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{message.body}</p>
        {!!message.attachment_names?.length&&<p>Attachments (metadata only): {message.attachment_names.join(", ")}</p>}
        <button type="button" disabled={busy} onClick={()=>void mark(!message.archived)}>{message.archived?"Unarchive":"Archive"}</button>
        {message.direction==="inbound"&&<button type="button" disabled={busy||uncertain} onClick={()=>{setReplyId(message.id);setTo(message.from_email);setSubject("Re: "+message.subject);setBody("");request.current="";}}>Reply</button>}</div>}
      <h3>{replyId?"Reply":"New email"}</h3>
      <div className="field"><label>To</label><input type="email" value={to} disabled={!!replyId||busy||uncertain} onChange={e=>setTo(e.target.value)}/></div>
      <div className="field"><label>Subject</label><input value={subject} disabled={!!replyId||busy||uncertain} onChange={e=>setSubject(e.target.value)} maxLength={160}/></div>
      <div className="field"><label>Message</label><textarea value={body} disabled={busy||uncertain} onChange={e=>setBody(e.target.value)} maxLength={12000}/></div>
      <div className="actions"><button type="button" className="btn btn-primary" disabled={busy||uncertain||!body.trim()||!aliases.find(a=>a.local_part===selected)?.enabled} onClick={()=>void send()}>Send</button>
      <button type="button" disabled={busy} onClick={()=>{if(uncertain&&!window.confirm("Have you reviewed Sent and confirmed this is not a duplicate?"))return;setUncertain(false);request.current="";setReplyId("");setTo("");setSubject("");setBody("");}}>Clear draft</button></div>
    </>}{status&&<p role="status">{status}</p>}</section>;
}
