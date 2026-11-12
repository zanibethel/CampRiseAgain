"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type InputType = "short_text"|"long_text"|"select"|"multi_select"|"checkbox";
type Kind = "camper"|"volunteer";
type Field = {
  id:string; form_kind:Kind; field_key:string; label:string; input_type:InputType;
  choices:string[]; required:boolean; active:boolean; sort_order:number; updated_at:string;
};
type Draft = Omit<Field,"id"|"updated_at">;
const kinds:Kind[]=["camper","volunteer"];
const inputTypes:{value:InputType;label:string}[]=[
  {value:"short_text",label:"Short answer"},{value:"long_text",label:"Paragraph"},
  {value:"select",label:"Dropdown"},{value:"multi_select",label:"Multiple choices"},
  {value:"checkbox",label:"Yes / No checkbox"},
];
const blank:Draft={form_kind:"camper",field_key:"",label:"",input_type:"short_text",
  choices:[],required:false,active:true,sort_order:100};
function slug(text:string) {
  return text.toLowerCase().normalize("NFKD").replace(/[^a-z0-9\s_]/g,"")
    .trim().replace(/[\s_]+/g,"_").slice(0,48);
}
function isChoice(type:InputType){return type==="select" || type==="multi_select";}

export default function CampFormFieldsAdmin() {
  const [items,setItems]=useState<Field[]>([]);
  const [adding,setAdding]=useState(false);
  const [draft,setDraft]=useState<Draft>({...blank});
  const [editing,setEditing]=useState<Field|null>(null);
  const [choicesText,setChoicesText]=useState("");
  const [busy,setBusy]=useState(false);
  const [status,setStatus]=useState("");

  const call = useCallback(async(method:"GET"|"POST"|"PATCH", body?:unknown) => {
    const {data,error}=await getSupabaseBrowserClient().auth.getSession();
    if(error || !data.session?.access_token) throw new Error("Sign in again.");
    const response=await fetch("/api/admin/form-fields",{
      method,
      headers:{Authorization:"Bearer "+data.session.access_token,
        ...(body ? {"Content-Type":"application/json"} : {})},
      body:body ? JSON.stringify(body) : undefined,
      cache:"no-store",
    });
    const payload=await response.json();
    if(!response.ok) throw new Error(payload.error || "Request failed.");
    return payload;
  },[]);
  const refresh=useCallback(async()=>{
    try {
      const result=await call("GET");
      setItems(result.fields || []);
      setStatus("");
    } catch(error){setStatus(error instanceof Error ? error.message : "Questions unavailable.");}
  },[call]);
  useEffect(()=>{void refresh();},[refresh]);

  function beginEditing(field:Field) {
    setEditing({...field}); setChoicesText(field.choices.join("\n")); setAdding(false); setStatus("");
  }
  function beginAdding(){
    setDraft({...blank});setChoicesText("");setEditing(null);setAdding(true);setStatus("");
  }
  async function save() {
    if(busy) return;
    const value=editing || draft;
    const key=editing?.field_key || slug(value.field_key || value.label);
    const choices=isChoice(value.input_type)
      ? choicesText.split("\n").map(x=>x.trim()).filter(Boolean) : [];
    if(key.length<2 || !value.label.trim() || (isChoice(value.input_type) && choices.length<2)) {
      setStatus("Add a question label and, for multiple-choice questions, at least two options.");
      return;
    }
    setBusy(true);
    try {
      await call(editing ? "PATCH":"POST",{
        ...(editing ? {id:editing.id,updated_at:editing.updated_at} : {field_key:key}),
        form_kind:value.form_kind,label:value.label.trim(),input_type:value.input_type,
        choices,required:value.required,active:value.active,sort_order:Number(value.sort_order),
      });
      setAdding(false);setEditing(null);
      await refresh();
      setStatus("Question saved. Public forms will use this configuration on their next load.");
    }catch(error){setStatus(error instanceof Error?error.message:"Unable to save question.");}
    finally{setBusy(false);}
  }

  const current=editing || draft;
  const update=(patch:Partial<Draft>)=>{
    if(editing) setEditing({...editing,...patch});
    else setDraft({...draft,...patch});
  };

  return <section className="card" style={{marginTop:24}}>
    <h3>Manage form questions</h3>
    <p className="section-copy">Add optional or required questions without a code update.
      Answers are saved privately alongside each application. Turning off a question
      hides it on future forms without deleting past answers.</p>
    <div className="actions">
      <button type="button" className="btn btn-secondary" onClick={beginAdding}>+ Add Question</button>
      <button type="button" className="btn btn-secondary" onClick={()=>void refresh()}>Refresh Questions</button>
    </div>
    {(adding || editing) && <div className="card" style={{margin:"16px 0"}}>
      <h4>{editing?"Edit Question":"Add Question"}</h4>
      <div className="field-grid">
        <div className="field"><label>Form</label>
          <select value={current.form_kind} disabled={!!editing} onChange={e=>update({form_kind:e.target.value as Kind})}>
            {kinds.map(k=><option key={k} value={k}>{k==="camper"?"Attendee":"Volunteer"}</option>)}
          </select>
        </div>
        <div className="field"><label>Answer type</label>
          <select value={current.input_type} onChange={e=>update({input_type:e.target.value as InputType})}>
            {inputTypes.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
      </div>
      <div className="field"><label>Question label</label>
        <input value={current.label} maxLength={160} onChange={e=>update({label:e.target.value})}/></div>
      {editing ? <p className="section-copy">Saved answer key: {editing.field_key} (cannot be renamed, to preserve reports)</p>
        : <div className="field"><label>Report field key (optional — generated from label)</label>
          <input value={current.field_key} maxLength={48} placeholder={slug(current.label)}
            onChange={e=>update({field_key:e.target.value})}/></div>}
      {isChoice(current.input_type) && <div className="field">
        <label>Choices (one per line, 2–20 options)</label>
        <textarea rows={4} value={choicesText} onChange={e=>setChoicesText(e.target.value)}/>
      </div>}
      <div className="field"><label>Display order (lower appears first)</label>
        <input type="number" min={0} max={100000} value={current.sort_order}
          onChange={e=>update({sort_order:Number(e.target.value)})}/></div>
      <div className="checks">
        <label><input type="checkbox" checked={current.required}
          onChange={e=>update({required:e.target.checked})}/> Required</label>
        <label><input type="checkbox" checked={current.active}
          onChange={e=>update({active:e.target.checked})}/> Shown publicly</label>
      </div>
      <div className="actions" style={{marginTop:12}}>
        <button className="btn btn-primary" type="button" disabled={busy} onClick={()=>void save()}>{busy?"Saving…":"Save Question"}</button>
        <button className="btn btn-secondary" type="button" disabled={busy} onClick={()=>{setAdding(false);setEditing(null);}}>Cancel</button>
      </div>
    </div>}
    <div style={{display:"grid",gap:10,marginTop:16}}>
      {items.map(field=><div className="card" key={field.id} style={{padding:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
          <div><strong>{field.label}</strong>
            <div style={{fontSize:13,opacity:.75,marginTop:4}}>
              {field.form_kind==="camper"?"Attendee":"Volunteer"} ·
              {" "+(inputTypes.find(t=>t.value===field.input_type)?.label || field.input_type)} ·
              {field.required?" Required":" Optional"} · {field.active?"Visible":"Hidden"}
            </div>
          </div>
          <button type="button" className="btn btn-secondary" onClick={()=>beginEditing(field)}>Edit</button>
        </div>
      </div>)}
    </div>
    {status && <p className="status" role="status" aria-live="polite">{status}</p>}
    <p className="section-copy">Avoid collecting diagnoses, medication information, or other sensitive details through custom questions.
      Only authorized camp administrators can view submitted answers.</p>
  </section>;
}
