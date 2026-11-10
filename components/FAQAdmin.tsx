"use client";

import { DragEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { orderedFAQs, moveFAQ, validFAQ } from "@/lib/camp-faq-editor";

type Section = "general" | "campers" | "volunteers";
type Faq = {
  id: string; section: Section; question: string; answer: string;
  is_published: boolean; sort_order: number; updated_at: string;
  updated_by: string | null;
};
const pages: { id: Section; label: string; url: string }[] = [
  { id:"general", label:"General FAQs", url:"/faq" },
  { id:"campers", label:"Camper FAQs", url:"/faq/campers" },
  { id:"volunteers", label:"Volunteer FAQs", url:"/faq/volunteers" },
];

export default function FAQAdmin() {
  const [items, setItems] = useState<Faq[]>([]);
  const [section, setSection] = useState<Section>("general");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQuestion, setEditQuestion] = useState("");
  const [editAnswer, setEditAnswer] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [newQuestion, setNewQuestion] = useState("");
  const [newAnswer, setNewAnswer] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const call = useCallback(async (method: "GET"|"POST"|"PATCH"|"DELETE", value?: object) => {
    const { data, error } = await getSupabaseBrowserClient().auth.getSession();
    if (error || !data.session?.access_token) throw new Error("Sign in again to manage FAQs.");
    const response = await fetch("/api/admin/faqs", {
      method,
      headers: {
        Authorization:"Bearer " + data.session.access_token,
        ...(value ? { "Content-Type":"application/json" } : {}),
      },
      ...(value ? { body:JSON.stringify(value) } : {}),
      cache:"no-store",
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not save FAQ.");
    return result;
  }, []);

  const refresh = useCallback(async () => {
    try {
      const result = await call("GET");
      setItems(result.faqs || []);
      setStatus("");
    } catch(error) {
      setStatus(error instanceof Error ? error.message : "Could not load FAQs.");
    } finally { setLoading(false); }
  }, [call]);

  useEffect(() => { void refresh(); }, [refresh]);

  const current = useMemo(() => orderedFAQs(items.filter(item=>item.section===section)), [items,section]);
  const page = pages.find(x=>x.id===section) || pages[0];

  function startEdit(item: Faq) {
    setEditingId(item.id);
    setEditQuestion(item.question);
    setEditAnswer(item.answer);
    setStatus("");
  }

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!validFAQ(newQuestion,newAnswer)) {
      setStatus("Enter a question and answer first.");
      return;
    }
    setBusy(true);
    try {
      await call("POST",{ section,question:newQuestion.trim(),answer:newAnswer.trim() });
      setNewQuestion("");setNewAnswer("");setAddOpen(false);
      await refresh();
      setStatus("New FAQ saved as a draft. Use Publish when you're ready.");
    } catch(error) {
      setStatus(error instanceof Error ? error.message : "Could not add FAQ.");
    } finally { setBusy(false); }
  }

  async function save(item: Faq) {
    if (busy) return;
    if (!validFAQ(editQuestion,editAnswer)) {
      setStatus("The question must have at least five characters and the answer cannot be empty.");
      return;
    }
    setBusy(true);
    try {
      const result = await call("PATCH",{
        id:item.id,section:item.section,
        question:editQuestion.trim(),answer:editAnswer.trim(),
        is_published:item.is_published,updated_at:item.updated_at,
      });
      setItems(all=>all.map(x=>x.id===item.id?result.item:x));
      setEditingId(null);
      setStatus("Saved. Published answers update on the public FAQ page immediately.");
    } catch(error) {
      setStatus(error instanceof Error ? error.message : "Could not save FAQ.");
    } finally { setBusy(false); }
  }

  async function publish(item: Faq) {
    if (busy) return;
    setBusy(true);
    try {
      const result=await call("PATCH",{
        id:item.id,section:item.section,question:item.question,answer:item.answer,
        is_published:!item.is_published,updated_at:item.updated_at,
      });
      setItems(all=>all.map(x=>x.id===item.id?result.item:x));
      setStatus(item.is_published ? "FAQ hidden from visitors." : "FAQ is now published.");
    } catch(error) {
      setStatus(error instanceof Error ? error.message : "Could not change visibility.");
    } finally { setBusy(false); }
  }

  async function remove(item: Faq) {
    if (busy || !window.confirm('Permanently delete "' + item.question + '"?')) return;
    setBusy(true);
    try {
      await call("DELETE",{ id:item.id,section:item.section });
      setItems(all=>all.filter(x=>x.id!==item.id));
      if (editingId===item.id) setEditingId(null);
      setStatus("FAQ deleted.");
    } catch(error) {
      setStatus(error instanceof Error ? error.message : "Could not delete FAQ.");
    } finally { setBusy(false); }
  }

  async function applyOrder(newOrder: Faq[]) {
    if (busy || newOrder.length!==current.length) return;
    const unchanged=newOrder.every((x,i)=>x.id===current[i].id);
    if (unchanged) return;
    setBusy(true);
    try {
      await call("PATCH",{
        action:"reorder",section,ids:newOrder.map(x=>x.id),
      });
      // Persisted ordering, not browser-only visual order.
      setItems(all=>all.map(item=>{
        const index=newOrder.findIndex(x=>x.id===item.id);
        return index<0?item:{...item,sort_order:(index+1)*10};
      }));
      setStatus("FAQ order saved.");
    } catch(error) {
      setStatus(error instanceof Error ? error.message : "Could not reorder FAQs.");
      await refresh();
    } finally { setBusy(false); }
  }

  function move(id: string, shift: -1|1) {
    void applyOrder(moveFAQ(current,id,shift));
  }

  function drop(event: DragEvent<HTMLDivElement>, targetId: string) {
    event.preventDefault();
    const from=current.findIndex(x=>x.id===draggingId);
    const to=current.findIndex(x=>x.id===targetId);
    setDraggingId(null);
    if (from<0 || to<0 || from===to) return;
    const ordered=[...current];
    const [moved]=ordered.splice(from,1);
    ordered.splice(to,0,moved);
    void applyOrder(ordered);
  }

  return <section aria-label="Manage FAQ questions" className="form-card">
    <h2>Frequently Asked Questions</h2>
    <p className="section-copy">
      Add, edit, hide, or arrange questions on each public FAQ page.
      Changes to published items appear on the site without redeploying.
    </p>
    <div className="actions" role="group" aria-label="Choose FAQ page" style={{margin:"16px 0 20px"}}>
      {pages.map(p=><button key={p.id} type="button"
        className={p.id===section?"btn btn-primary":"btn btn-secondary"}
        aria-pressed={section===p.id}
        onClick={()=>{
          setSection(p.id);setEditingId(null);setAddOpen(false);
          setDraggingId(null);setStatus("");
        }}>{p.label}</button>)}
    </div>
    <p className="section-copy" style={{marginBottom:14}}>
      Editing: <strong>{page.label}</strong> · <a href={page.url} target="_blank" rel="noopener noreferrer"
        style={{textDecoration:"underline"}}>View public page</a>
    </p>

    {loading ? <p>Loading FAQs…</p> : (
      <div style={{display:"grid",gap:12}}>
        {current.length===0 && <p className="section-copy">No questions on this page. Add one below.</p>}
        {current.map((item,i)=><div className="card" key={item.id}
          style={{padding:18,minWidth:0,opacity:busy ? .9 : 1}}
          draggable={!busy && editingId!==item.id}
          onDragStart={event=>{event.dataTransfer.effectAllowed="move";setDraggingId(item.id);}}
          onDragOver={event=>{if(!busy)event.preventDefault();}}
          onDrop={event=>drop(event,item.id)}
          onDragEnd={()=>setDraggingId(null)}>
          <div style={{display:"flex",gap:10,alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap"}}>
            <div style={{minWidth:0,flex:"1 1 200px"}}>
              <strong style={{display:"block",overflowWrap:"anywhere"}}>{i+1}. {item.question}</strong>
              <span style={{fontSize:13,color:item.is_published?"#145c3d":"#7a5d25"}}>
                {item.is_published ? "Published" : "Draft / hidden"}
              </span>
            </div>
            <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
              <button type="button" className="btn btn-secondary" style={{padding:"8px 12px"}}
                aria-label={"Move "+item.question+" up"} disabled={busy||i===0}
                onClick={()=>move(item.id,-1)}>↑</button>
              <button type="button" className="btn btn-secondary" style={{padding:"8px 12px"}}
                aria-label={"Move "+item.question+" down"} disabled={busy||i===current.length-1}
                onClick={()=>move(item.id,1)}>↓</button>
            </div>
          </div>
          {editingId===item.id ? <div style={{marginTop:16}}>
            <div className="field"><label htmlFor={"question-"+item.id}>Question</label>
              <input id={"question-"+item.id} maxLength={240} value={editQuestion}
                onChange={event=>setEditQuestion(event.target.value)} /></div>
            <div className="field"><label htmlFor={"answer-"+item.id}>Answer</label>
              <textarea id={"answer-"+item.id} rows={5} maxLength={3000}
                value={editAnswer} onChange={event=>setEditAnswer(event.target.value)} /></div>
            <div className="actions" style={{marginTop:12}}>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={()=>void save(item)}>Save Changes</button>
              <button type="button" className="btn btn-secondary" disabled={busy}
                onClick={()=>setEditingId(null)}>Cancel</button>
            </div>
          </div> : <p style={{lineHeight:1.6,whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>
            {item.answer.length>220?item.answer.slice(0,220)+"…":item.answer}</p>}
          <div className="actions" style={{marginTop:12,gap:8}}>
            {editingId!==item.id &&
              <button type="button" className="btn btn-secondary" disabled={busy}
                onClick={()=>startEdit(item)}>Edit</button>}
            <button type="button" className="btn btn-secondary" disabled={busy}
              onClick={()=>void publish(item)}>{item.is_published?"Unpublish":"Publish"}</button>
            <button type="button" className="btn" disabled={busy}
              style={{background:"#fce8e8",color:"#812424"}}
              onClick={()=>void remove(item)}>Delete</button>
          </div>
          <p style={{fontSize:12,color:"#68776f",marginBottom:0}}>
            Drag cards to reorder, or use the ↑ and ↓ buttons.
            {item.updated_by?" Last edited by "+item.updated_by+".":""}
          </p>
        </div>)}
      </div>
    )}

    <div style={{borderTop:"1px solid #d7e1dc",marginTop:24,paddingTop:20}}>
      {!addOpen ? <button type="button" className="btn btn-primary" disabled={busy}
        onClick={()=>setAddOpen(true)}>Add FAQ</button> :
        <form onSubmit={event=>void add(event)}>
          <h3>Add a question to {page.label}</h3>
          <p className="section-copy">New questions are saved as hidden drafts. Publish when the answer is ready.</p>
          <div className="field"><label htmlFor="faq-new-question">Question</label>
            <input id="faq-new-question" maxLength={240} minLength={5} required
              value={newQuestion} onChange={event=>setNewQuestion(event.target.value)} /></div>
          <div className="field"><label htmlFor="faq-new-answer">Answer</label>
            <textarea id="faq-new-answer" maxLength={3000} required rows={5}
              value={newAnswer} onChange={event=>setNewAnswer(event.target.value)} /></div>
          <div className="actions">
            <button type="submit" className="btn btn-primary" disabled={busy}>Save Draft</button>
            <button type="button" className="btn btn-secondary" disabled={busy}
              onClick={()=>{setAddOpen(false);setNewQuestion("");setNewAnswer("");}}>Cancel</button>
          </div>
        </form>}
    </div>
    {status && <p role="status" aria-live="polite" className="status">{status}</p>}
  </section>;
}
