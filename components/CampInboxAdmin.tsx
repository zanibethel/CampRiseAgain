"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type Box = "info" | "volunteer" | "forms";
type Folder = "inbox" | "sent" | "archive";
type Thread = {
  id: string; subject: string; from?: string; to?: string[]; read?: boolean;
  folder?: string; received_at?: string; email_count?: number;
};
type Mail = {
  id: string; from: string; to?: string[]; reply_to?: string[] | string; subject?: string; direction: string;
  received_at?: string; text?: string; attachments?: {filename?: string;size?: number}[];
};
const boxes: {id:Box;name:string;address:string}[] = [
  {id:"info",name:"General",address:"info@campriseagain.org"},
  {id:"volunteer",name:"Volunteers",address:"volunteer@campriseagain.org"},
  {id:"forms",name:"Forms",address:"forms@campriseagain.org"},
];
const folders: {id:Folder;label:string}[] = [
  {id:"inbox",label:"Inbox"}, {id:"sent",label:"Sent"}, {id:"archive",label:"Archived"},
];
function dateLabel(value?:string) {
  if(!value)return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString();
}
async function mailRequest(method:"GET"|"POST"|"PATCH",query:Record<string,string>,data?:Record<string,unknown>) {
  const {data:auth,error}=await getSupabaseBrowserClient().auth.getSession();
  if(error || !auth.session?.access_token) throw new Error("Sign in to use the camp inbox.");
  const endpoint="/api/admin/inbox"+(method==="GET"?"?"+new URLSearchParams(query):"");
  const result=await fetch(endpoint,{
    method,
    headers:{Authorization:"Bearer "+auth.session.access_token,
      ...(method==="GET"?{}:{"Content-Type":"application/json"})},
    ...(data?{body:JSON.stringify(data)}:{}),
    cache:"no-store",
  });
  const json=await result.json();
  if(!result.ok)throw new Error(json.error||"Mail request failed.");
  return json;
}
export default function CampInboxAdmin({initialTo=""}:{initialTo?:string}) {
  const [box,setBox]=useState<Box>("info");
  const [folder,setFolder]=useState<Folder>("inbox");
  const [threads,setThreads]=useState<Thread[]>([]);
  const [hasMore,setHasMore]=useState(false);
  const [active,setActive]=useState<Thread|null>(null);
  const [messages,setMessages]=useState<Mail[]>([]);
  const [message,setMessage]=useState<Mail|null>(null);
  const [signature,setSignature]=useState("Camp Rise Again Team");
  const [sender,setSender]=useState("");
  const [compose,setCompose]=useState(Boolean(initialTo));
  const [recipient,setRecipient]=useState(initialTo);
  const [subject,setSubject]=useState("");
  const [body,setBody]=useState("");
  const [reply,setReply]=useState("");
  const [busy,setBusy]=useState(false);
  const [status,setStatus]=useState("");
  const [filter,setFilter]=useState("");

  const loadThreads=useCallback(async(nextBox:Box,nextFolder:Folder,cursor?:string)=>{
    const result=await mailRequest("GET",{view:"threads",inbox:nextBox,folder:nextFolder,
      ...(cursor?{after:cursor}:{})});
    const entries=Array.isArray(result.data)?result.data as Thread[]:[];
    setThreads(old=>cursor?[...old,...entries.filter(item=>!old.some(x=>x.id===item.id))]:entries);
    setHasMore(Boolean(result.has_more));
    setSignature(result.signature||"Camp Rise Again Team");
    setSender(result.sender||"");
  },[]);
  useEffect(()=>{
    let current=true;
    setBusy(true);setStatus("");
    setActive(null);setMessage(null);setMessages([]);
    void loadThreads(box,folder).catch(error=>{
      if(current)setStatus(error instanceof Error?error.message:"Inbox unavailable.");
    }).finally(()=>{if(current)setBusy(false);});
    return()=>{current=false;};
  },[box,folder,loadThreads]);

  const shown=useMemo(()=>threads.filter(t=>[t.subject,t.from,...(t.to||[])]
    .some(v=>String(v||"").toLowerCase().includes(filter.trim().toLowerCase()))),[threads,filter]);
  const replyTarget=message?.direction==="inbound" ? message : null;
  const replyRecipient=replyTarget
    ? (Array.isArray(replyTarget.reply_to) ? replyTarget.reply_to.join(", ") : replyTarget.reply_to)||replyTarget.from
    : "";
  const currentAddress=boxes.find(b=>b.id===box)?.address||"info@campriseagain.org";

  async function openThread(t:Thread) {
    setActive(t);setCompose(false);setMessage(null);setMessages([]);setReply("");
    setBusy(true);setStatus("");
    try{
      const result=await mailRequest("GET",{view:"thread",inbox:box,thread:t.id});
      const entries=Array.isArray(result.emails)?result.emails as Mail[]:[];
      setMessages(entries);
      const latestInbound=[...entries].reverse().find(item=>item.direction==="inbound");
      if(entries.length)await openMessage(t.id,(latestInbound||entries[entries.length-1]).id);
      if(!t.read) {
        await mailRequest("PATCH",{}, {inbox:box,thread:t.id,read:true});
        setThreads(old=>old.map(item=>item.id===t.id?{...item,read:true}:item));
      }
    }catch(error){setStatus(error instanceof Error?error.message:"Could not open conversation.");}
    finally{setBusy(false);}
  }
  async function openMessage(threadId:string,messageId:string) {
    try{
      const m=await mailRequest("GET",{view:"message",inbox:box,thread:threadId,message:messageId}) as Mail;
      setMessage(m);
    }catch(error){setStatus(error instanceof Error?error.message:"Could not read message.");}
  }
  function startCompose(to="") {
    setCompose(true);setActive(null);setMessage(null);setRecipient(to);
    setSubject("");setBody("");setStatus("");
  }
  async function sendNew(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanBody=body.trim();
    if(!cleanBody || !recipient.trim() || !subject.trim())return;
    if(!window.confirm("Send this official Camp Rise Again email?\n\nFrom: "+
      currentAddress+"\nTo: "+recipient.trim()+"\nSubject: "+subject.trim()+
      "\n\n"+cleanBody+"\n\n"+signature+"\n\nSending cannot be undone."))return;
    setBusy(true);setStatus("");
    try{
      await mailRequest("POST",{}, {action:"new",inbox:box,to:recipient.trim(),
        subject:subject.trim(),text:cleanBody,requestId:crypto.randomUUID()});
      setCompose(false);setBody("");setSubject("");
      setStatus("Email accepted by Resend. Check Sent for the conversation.");
      await loadThreads(box,folder);
    }catch(error){setStatus(error instanceof Error?error.message:"Email not sent.");}
    finally{setBusy(false);}
  }
  async function sendReply(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!active || !replyTarget || !reply.trim())return;
    if(!window.confirm("Send this reply?\n\nFrom: "+currentAddress+
      "\nReplying to: "+replyRecipient+"\nSubject: Re: "+(active.subject||"Message")+
      "\n\n"+reply.trim()+"\n\n"+signature+"\n\nSending cannot be undone."))return;
    setBusy(true);setStatus("");
    try{
      await mailRequest("POST",{}, {action:"reply",inbox:box,thread:active.id,
        message:replyTarget.id,text:reply.trim(),requestId:crypto.randomUUID()});
      setReply("");setStatus("Reply accepted by Resend.");
      const result=await mailRequest("GET",{view:"thread",inbox:box,thread:active.id});
      setMessages(Array.isArray(result.emails)?result.emails:[]);
      await loadThreads(box,folder);
    }catch(error){setStatus(error instanceof Error?error.message:"Reply was not sent.");}
    finally{setBusy(false);}
  }
  async function archiveThread() {
    if(!active)return;
    setBusy(true);
    try{
      await mailRequest("PATCH",{}, {inbox:box,thread:active.id,folder:active.folder==="archive"?"inbox":"archive"});
      setActive(null);setMessages([]);setMessage(null);
      await loadThreads(box,folder);
      setStatus("Conversation updated.");
    }catch(error){setStatus(error instanceof Error?error.message:"Could not update conversation.");}
    finally{setBusy(false);}
  }

  return <section className="form-card" aria-label="Camp Rise Again shared inbox">
    <h2>Camp Email Inbox</h2>
    <p className="section-copy">Official conversations stay in their Camp mailbox, alongside existing Gmail forwarding. All signed-in Camp admins share this view. Incoming messages are untrusted: verify requests before acting on them.</p>
    <div className="actions" style={{margin:"16px 0",gap:8,flexWrap:"wrap"}}>
      {boxes.map(item=><button type="button" key={item.id}
        className={"btn "+(box===item.id?"btn-primary":"btn-secondary")}
        onClick={()=>{setBox(item.id);setCompose(false);}} disabled={busy}>{item.name}</button>)}
    </div>
    <p className="section-copy">Mailbox: <strong>{currentAddress}</strong></p>
    <div className="actions" style={{margin:"12px 0",gap:8,flexWrap:"wrap"}}>
      {folders.map(f=><button type="button" key={f.id}
        className={"btn "+(folder===f.id?"btn-primary":"btn-secondary")}
        onClick={()=>{setFolder(f.id);setCompose(false);}} disabled={busy}>{f.label}</button>)}
      <button className="btn btn-secondary" type="button" onClick={()=>startCompose()}>+ Compose</button>
      <button className="btn btn-secondary" type="button" disabled={busy}
        onClick={()=>{setBusy(true);void loadThreads(box,folder).catch(error=>setStatus(String(error)))
          .finally(()=>setBusy(false));}}>Refresh</button>
    </div>
    {sender&&<p className="section-copy">Signed in as {sender}. Outgoing signature: <strong style={{whiteSpace:"pre-line"}}>{signature}</strong></p>}
    {status&&<p className="status" role="status" aria-live="polite">{status}</p>}
    {compose?<form className="card" onSubmit={sendNew}>
      <h3>New official email</h3>
      <p className="section-copy">From: {currentAddress}</p>
      <div className="field"><label htmlFor="camp-compose-to">To</label>
        <input id="camp-compose-to" type="email" required maxLength={254} value={recipient}
          onChange={event=>setRecipient(event.target.value)}/></div>
      <div className="field"><label htmlFor="camp-compose-subject">Subject</label>
        <input id="camp-compose-subject" required minLength={3} maxLength={160} value={subject}
          onChange={event=>setSubject(event.target.value)}/></div>
      <div className="field"><label htmlFor="camp-compose-body">Message</label>
        <textarea id="camp-compose-body" required rows={9} maxLength={12000} value={body}
          onChange={event=>setBody(event.target.value)}/></div>
      <p className="section-copy">Your sender signature is added automatically. This is a direct operational email, not a newsletter blast.</p>
      <div className="actions"><button className="btn btn-primary" disabled={busy}>Review &amp; Send</button>
        <button className="btn btn-secondary" type="button" onClick={()=>setCompose(false)}>Cancel</button></div>
    </form>:active?<div className="card">
      <div className="actions" style={{justifyContent:"space-between",marginBottom:14}}>
        <button className="btn btn-secondary" type="button" onClick={()=>{setActive(null);setMessage(null);}}>Back to {folder}</button>
        <button className="btn btn-secondary" type="button" disabled={busy} onClick={()=>void archiveThread()}>
          {active.folder==="archive"?"Restore to Inbox":"Archive"}
        </button>
      </div>
      <h3>{active.subject||"(No subject)"}</h3>
      <p className="section-copy">Select a message to read it. Plain text is shown without executing email HTML or links.</p>
      <div style={{display:"grid",gap:8,marginBottom:20}}>
        {messages.map(m=><button type="button" className="card" key={m.id}
          onClick={()=>void openMessage(active.id,m.id)}
          style={{textAlign:"left",cursor:"pointer",border:message?.id===m.id?"2px solid currentColor":undefined}}>
          <strong>{m.direction==="inbound"?"Received":"Sent"} · {m.from||"Sender"}</strong>
          <span style={{display:"block",fontSize:12,opacity:.7}}>{dateLabel(m.received_at)}</span>
        </button>)}
      </div>
      {message&&<div className="card" style={{marginBottom:16}}>
        <strong>From: {message.from}</strong>
        <div style={{overflowWrap:"anywhere",fontSize:13,marginTop:4}}>To: {(message.to||[]).join(", ")}</div>
        <div style={{marginTop:4,fontSize:13,opacity:.75}}>{dateLabel(message.received_at)}</div>
        <div style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere",marginTop:16}}>
          {message.text||"(No plain-text content; open the original message in Resend to view HTML.)"}
        </div>
        {Boolean(message.attachments?.length)&&<p className="section-copy" style={{marginTop:12}}>
          Attachments: {message.attachments?.map(a=>a.filename||"Attachment").join(", ")}
          {" "}— downloads are available from the original Resend inbox.
        </p>}
      </div>}
      {replyTarget&&<form onSubmit={sendReply}>
        <h3>Reply to {replyRecipient}</h3>
        <div className="field"><label htmlFor="camp-reply-body">Reply</label>
          <textarea id="camp-reply-body" required rows={6} maxLength={12000} value={reply}
            onChange={event=>setReply(event.target.value)}/></div>
        <button className="btn btn-primary" disabled={busy}>Review &amp; Send Reply</button>
      </form>}
      {!replyTarget&&<p className="section-copy">Select an incoming message above to reply.</p>}
    </div>:<>
      <div className="field"><label htmlFor="camp-inbox-filter">Filter loaded conversations</label>
        <input id="camp-inbox-filter" type="search" placeholder="Search sender or subject" value={filter}
          onChange={e=>setFilter(e.target.value)}/></div>
      <div style={{display:"grid",gap:10,marginTop:14}}>
        {shown.map(t=><button className="card" type="button" key={t.id}
          style={{textAlign:"left",cursor:"pointer"}} disabled={busy} onClick={()=>void openThread(t)}>
          <strong>{t.read?"":"● "}{t.subject||"(No subject)"}</strong>
          <div style={{fontSize:13,overflowWrap:"anywhere"}}>{t.from||((t.to||[]).join(", "))}</div>
          <div style={{fontSize:12,opacity:.75}}>{dateLabel(t.received_at)} · {t.email_count||1} message(s)</div>
        </button>)}
        {!shown.length&&<p className="section-copy">{busy?"Loading conversations…":"No matching conversations in this folder."}</p>}
      </div>
      {hasMore&&Boolean(threads.length)&&<button type="button" className="btn btn-secondary" disabled={busy}
        onClick={()=>{setBusy(true);void loadThreads(box,folder,threads[threads.length-1].id)
          .catch(error=>setStatus(String(error))).finally(()=>setBusy(false));}}>Load More</button>}
    </>}
  </section>;
}
