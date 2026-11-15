"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type Box = "info" | "volunteer" | "forms";
type Folder = "inbox" | "sent" | "archive";
type Thread = {
  id: string; subject: string; from?: string; to?: string[]; read?: boolean;
  folder?: string; received_at?: string; email_count?: number;
};
type Mail = {
  id: string; from: string; to?: string[]; reply_to?: string[] | string; subject?: string; direction: string;
  received_at?: string; text?: string; html?: string; attachments?: {filename?: string;size?: number}[];
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
export default function CampInboxAdmin({initialTo="",initialContact=""}:{initialTo?:string;initialContact?:string}) {
  const [box,setBox]=useState<Box>("info");
  const [folder,setFolder]=useState<Folder>("inbox");
  const [contact,setContact]=useState(initialContact);
  const [threads,setThreads]=useState<Thread[]>([]);
  const [hasMore,setHasMore]=useState(false);
  const [active,setActive]=useState<Thread|null>(null);
  const [messages,setMessages]=useState<Mail[]>([]);
  const [message,setMessage]=useState<Mail|null>(null);
  const [showHtml,setShowHtml]=useState(true);
  const [loadRemoteImages,setLoadRemoteImages]=useState(false);
  const [signature,setSignature]=useState("Camp Rise Again Team");
  const [sender,setSender]=useState("");
  const [compose,setCompose]=useState(Boolean(initialTo));
  const [recipient,setRecipient]=useState(initialTo);
  const [subject,setSubject]=useState("");
  const [body,setBody]=useState("");
  const [reply,setReply]=useState("");
  const composeRequest=useRef<string|null>(null);
  const replyRequest=useRef<string|null>(null);
  const [sendUncertain,setSendUncertain]=useState(false);
  const [replyUncertain,setReplyUncertain]=useState(false);
  const [busy,setBusy]=useState(false);
  const [status,setStatus]=useState("");
  const [filter,setFilter]=useState("");

  const loadThreads=useCallback(async(nextBox:Box,nextFolder:Folder,cursor?:string,contactEmail="")=>{
    const result=await mailRequest("GET",{view:"threads",inbox:nextBox,folder:nextFolder,
      ...(cursor?{after:cursor}:{}),...(contactEmail?{contact:contactEmail}:{})});
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
    void loadThreads(box,folder,undefined,contact).catch(error=>{
      if(current)setStatus(error instanceof Error?error.message:"Inbox unavailable.");
    }).finally(()=>{if(current)setBusy(false);});
    return()=>{current=false;};
  },[box,folder,contact,loadThreads]);

  const shown=useMemo(()=>threads.filter(t=>[t.subject,t.from,...(t.to||[])]
    .some(v=>String(v||"").toLowerCase().includes(filter.trim().toLowerCase()))),[threads,filter]);
  const replyTarget=message?.direction==="inbound" ? message : null;
  const replyRecipient=replyTarget
    ? (Array.isArray(replyTarget.reply_to) ? replyTarget.reply_to.join(", ") : replyTarget.reply_to)||replyTarget.from
    : "";
  const currentAddress=boxes.find(b=>b.id===box)?.address||"info@campriseagain.org";
  // Keep received HTML in an opaque sandboxed document, not in the admin DOM.
  // Remote images are disabled by default because opening them tracks the reader.
  const htmlPreview=useMemo(()=>{
    if(!message?.html)return "";
    const csp="default-src 'none'; script-src 'none'; object-src 'none'; "+
      "style-src 'unsafe-inline'; img-src "+(loadRemoteImages?"https: data:":"data:")+"; "+
      "font-src 'none'; media-src 'none'; frame-src 'none'; connect-src 'none'; "+
      "form-action 'none'; base-uri 'none';";
    return '<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="'+
      csp+'"><body style="margin:12px;font-family:Arial,Helvetica,sans-serif;">'+message.html+"</body>";
  },[message?.html,loadRemoteImages]);

  async function openThread(t:Thread) {
    setActive(t);setCompose(false);setMessage(null);setMessages([]);setReply("");
    replyRequest.current=null;setReplyUncertain(false);
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
      setShowHtml(Boolean(m.html));
      setLoadRemoteImages(false);
    }catch(error){setStatus(error instanceof Error?error.message:"Could not read message.");}
  }
  function startCompose(to="") {
    setCompose(true);setActive(null);setMessage(null);setRecipient(to);
    setSubject("");setBody("");setStatus("");
    composeRequest.current=null;setSendUncertain(false);
  }
  async function sendNew(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanBody=body.trim();
    if(!cleanBody || !recipient.trim() || !subject.trim() || sendUncertain)return;
    if(!window.confirm("Send this official Camp Rise Again email?\n\nFrom: "+
      currentAddress+"\nTo: "+recipient.trim()+"\nSubject: "+subject.trim()+
      "\n\n"+cleanBody+"\n\n"+signature+"\n\nSending cannot be undone."))return;
    setBusy(true);setStatus("");
    try{
      composeRequest.current??=crypto.randomUUID();
      await mailRequest("POST",{}, {action:"new",inbox:box,to:recipient.trim(),
        subject:subject.trim(),text:cleanBody,requestId:composeRequest.current});
      setCompose(false);setBody("");setSubject("");
      composeRequest.current=null;setSendUncertain(false);
      setStatus("Email accepted by Resend. Check Sent for the conversation.");
      await loadThreads(box,folder,undefined,contact);
    }catch(error){
      setSendUncertain(true);
      setStatus((error instanceof Error?error.message:"Send could not be confirmed.")+
        " Check Sent and any Resend drafts before attempting another send; the recipient may already have received it.");
    }
    finally{setBusy(false);}
  }
  async function sendReply(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!active || !replyTarget || !reply.trim() || replyUncertain)return;
    if(!window.confirm("Send this reply?\n\nFrom: "+currentAddress+
      "\nReplying to: "+replyRecipient+"\nSubject: Re: "+(active.subject||"Message")+
      "\n\n"+reply.trim()+"\n\n"+signature+"\n\nSending cannot be undone."))return;
    setBusy(true);setStatus("");
    try{
      replyRequest.current??=crypto.randomUUID();
      await mailRequest("POST",{}, {action:"reply",inbox:box,thread:active.id,
        message:replyTarget.id,text:reply.trim(),requestId:replyRequest.current});
      setReply("");replyRequest.current=null;setReplyUncertain(false);
      setStatus("Reply accepted by Resend.");
      const result=await mailRequest("GET",{view:"thread",inbox:box,thread:active.id});
      setMessages(Array.isArray(result.emails)?result.emails:[]);
      await loadThreads(box,folder,undefined,contact);
    }catch(error){
      setReplyUncertain(true);
      setStatus((error instanceof Error?error.message:"Reply could not be confirmed.")+
        " Check this thread before attempting another reply.");
    }
    finally{setBusy(false);}
  }
  async function archiveThread() {
    if(!active)return;
    setBusy(true);
    try{
      await mailRequest("PATCH",{}, {inbox:box,thread:active.id,folder:active.folder==="archive"?"inbox":"archive"});
      setActive(null);setMessages([]);setMessage(null);
      await loadThreads(box,folder,undefined,contact);
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
    {contact&&<p className="section-copy"><strong>Contact history:</strong> {contact} · Search includes inbox, sent and archived messages for this mailbox (results can lag by about a minute).
      <button type="button" className="btn btn-secondary" style={{marginLeft:12}} onClick={()=>{setContact("");setFilter("");}}>Show All Mail</button>
    </p>}
    <div className="actions" style={{margin:"12px 0",gap:8,flexWrap:"wrap"}}>
      {!contact&&folders.map(f=><button type="button" key={f.id}
        className={"btn "+(folder===f.id?"btn-primary":"btn-secondary")}
        onClick={()=>{setFolder(f.id);setCompose(false);}} disabled={busy}>{f.label}</button>)}
      <button className="btn btn-secondary" type="button" onClick={()=>startCompose()}>+ Compose</button>
      <button className="btn btn-secondary" type="button" disabled={busy}
        onClick={()=>{setBusy(true);void loadThreads(box,folder,undefined,contact).catch(error=>setStatus(String(error)))
          .finally(()=>setBusy(false));}}>Refresh</button>
    </div>
    {sender&&<p className="section-copy">Signed in as {sender}. Outgoing signature: <strong style={{whiteSpace:"pre-line"}}>{signature}</strong></p>}
    {status&&<p className="status" role="status" aria-live="polite">{status}</p>}
    {compose?<form className="card" onSubmit={sendNew}>
      <h3>New official email</h3>
      <p className="section-copy">From: {currentAddress}</p>
      <div className="field"><label htmlFor="camp-compose-to">To</label>
        <input id="camp-compose-to" type="email" required maxLength={254} value={recipient}
          onChange={event=>{setRecipient(event.target.value);composeRequest.current=null;setSendUncertain(false);}}/></div>
      <div className="field"><label htmlFor="camp-compose-subject">Subject</label>
        <input id="camp-compose-subject" required minLength={3} maxLength={160} value={subject}
          onChange={event=>{setSubject(event.target.value);composeRequest.current=null;setSendUncertain(false);}}/></div>
      <div className="field"><label htmlFor="camp-compose-body">Message</label>
        <textarea id="camp-compose-body" required rows={9} maxLength={12000} value={body}
          onChange={event=>{setBody(event.target.value);composeRequest.current=null;setSendUncertain(false);}}/></div>
      <p className="section-copy">Your Camp Rise Again logo, branded HTML layout and sender signature are added automatically, with a plain-text version for email clients that need it. This is a direct operational email, not a newsletter blast.</p>
      <div className="actions"><button className="btn btn-primary" disabled={busy||sendUncertain}>Review &amp; Send</button>
        <button className="btn btn-secondary" type="button" onClick={()=>setCompose(false)}>Cancel</button></div>
    </form>:active?<div className="card">
      <div className="actions" style={{justifyContent:"space-between",marginBottom:14}}>
        <button className="btn btn-secondary" type="button" onClick={()=>{setActive(null);setMessage(null);}}>Back to {folder}</button>
        <button className="btn btn-secondary" type="button" disabled={busy} onClick={()=>void archiveThread()}>
          {active.folder==="archive"?"Restore to Inbox":"Archive"}
        </button>
      </div>
      <h3>{active.subject||"(No subject)"}</h3>
      <p className="section-copy">Select a message to read it. HTML messages open in a protected viewer. Scripts, forms and links are disabled; external images only load if you choose to allow them.</p>
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
        {Boolean(message.html)&&<div className="actions" style={{marginTop:14,gap:8,flexWrap:"wrap"}}>
          <button type="button" className={"btn "+(showHtml?"btn-primary":"btn-secondary")}
            onClick={()=>setShowHtml(true)}>View HTML</button>
          <button type="button" className={"btn "+(!showHtml?"btn-primary":"btn-secondary")}
            onClick={()=>setShowHtml(false)}>View Plain Text</button>
          {showHtml&&<button type="button" className="btn btn-secondary"
            onClick={()=>setLoadRemoteImages(!loadRemoteImages)}>
            {loadRemoteImages?"Block Remote Images":"Load Remote Images"}
          </button>}
        </div>}
        {showHtml&&Boolean(message.html)?
          <iframe title="Protected email HTML preview" sandbox="" referrerPolicy="no-referrer"
            srcDoc={htmlPreview} style={{display:"block",width:"100%",height:520,
              marginTop:16,border:"1px solid #dae4dc",borderRadius:10,background:"#fff"}}/>:
          <div style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere",marginTop:16}}>
            {message.text||"(No plain-text version supplied by the sender.)"}
          </div>}
        {Boolean(message.attachments?.length)&&<p className="section-copy" style={{marginTop:12}}>
          Attachments: {message.attachments?.map(a=>a.filename||"Attachment").join(", ")}
          {" "}— downloads are available from the original Resend inbox.
        </p>}
      </div>}
      {replyTarget&&<form onSubmit={sendReply}>
        <h3>Reply to {replyRecipient}</h3>
        <div className="field"><label htmlFor="camp-reply-body">Reply</label>
          <textarea id="camp-reply-body" required rows={6} maxLength={12000} value={reply}
            onChange={event=>{setReply(event.target.value);replyRequest.current=null;setReplyUncertain(false);}}/></div>
        <p className="section-copy">Replies include the current Camp Rise Again logo, branded HTML and a plain-text alternative.</p>
        <button className="btn btn-primary" disabled={busy||replyUncertain}>Review &amp; Send Reply</button>
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
        onClick={()=>{setBusy(true);void loadThreads(box,folder,threads[threads.length-1].id,contact)
          .catch(error=>setStatus(String(error))).finally(()=>setBusy(false));}}>Load More</button>}
    </>}
  </section>;
}
