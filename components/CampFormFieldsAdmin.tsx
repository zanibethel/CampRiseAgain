"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { orderedCampFields, BUILTIN_QUESTIONS } from "@/lib/camp-form-layout";

type InputType = "short_text"|"long_text"|"select"|"multi_select"|"checkbox";
type Kind = "camper"|"volunteer";
type Field = {
  id:string; form_kind:Kind; field_key:string; label:string; input_type:InputType;
  choices:string[]; required:boolean; active:boolean; sort_order:number;
  after_field:string|null; updated_at:string;
};
type Draft = Omit<Field,"id"|"updated_at">;
const kinds:Kind[]=["camper","volunteer"];
const inputTypes:{value:InputType;label:string}[]=[
  {value:"short_text",label:"Short answer"},{value:"long_text",label:"Paragraph"},
  {value:"select",label:"Dropdown"},{value:"multi_select",label:"Multiple choices"},
  {value:"checkbox",label:"Yes / No checkbox"},
];
const blank:Draft={
  form_kind:"camper",field_key:"",label:"",input_type:"short_text",
  choices:[],required:false,active:true,sort_order:0,after_field:"notes",
};
function slug(text:string):string {
  return text.toLowerCase().normalize("NFKD").replace(/[^a-z0-9\s_]/g,"")
    .trim().replace(/[\s_]+/g,"_").slice(0,48);
}
function isChoice(type:InputType):boolean {
  return type==="select" || type==="multi_select";
}

export default function CampFormFieldsAdmin() {
  const [items,setItems]=useState<Field[]>([]);
  const [draft,setDraft]=useState<Draft|null>(null);
  const [editing,setEditing]=useState<Field|null>(null);
  const [choicesText,setChoicesText]=useState("");
  const [busy,setBusy]=useState(false);
  const [status,setStatus]=useState("");
  const [loaded,setLoaded]=useState(false);

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
      setLoaded(true);
      setStatus("");
    } catch(error){
      setStatus(error instanceof Error ? error.message : "Questions unavailable.");
    }
  },[call]);
  useEffect(()=>{void refresh();},[refresh]);

  function beginAdding(kind:Kind, afterField:string) {
    const siblings=items.filter(x=>x.form_kind===kind && x.after_field===afterField);
    const first=siblings.length>0 ? Math.min(...siblings.map(x=>x.sort_order)) : 100;
    setDraft({...blank,form_kind:kind,after_field:afterField,sort_order:Math.max(0,first-10)});
    setEditing(null);
    setChoicesText("");
    setStatus("");
  }

  function beginEditing(field:Field) {
    setEditing({...field});
    setDraft(null);
    setChoicesText(field.choices.join("\n"));
    setStatus("");
  }

  function cancel(){setEditing(null);setDraft(null);setChoicesText("");}

  const current=editing || draft;
  function update(patch:Partial<Draft>) {
    if(editing) setEditing({...editing,...patch});
    else if(draft) setDraft({...draft,...patch});
  }

  async function save() {
    if(!current || busy) return;
    const key=editing?.field_key || slug(current.field_key || current.label);
    const choices=isChoice(current.input_type)
      ? choicesText.split("\n").map(x=>x.trim()).filter(Boolean) : [];
    if(key.length<2 || !current.label.trim() ||
        (isChoice(current.input_type) && (choices.length<2 || choices.length>20))) {
      setStatus("Enter a question and, for choice questions, 2–20 options.");
      return;
    }
    setBusy(true);
    try {
      await call(editing ? "PATCH":"POST",{
        ...(editing ? {id:editing.id,updated_at:editing.updated_at}
          : {field_key:key,after_field:current.after_field}),
        form_kind:current.form_kind,label:current.label.trim(),
        input_type:current.input_type,choices,required:current.required,
        active:current.active,sort_order:Number(current.sort_order),
      });
      cancel();
      await refresh();
      setStatus("Question saved. It now appears in the selected form position.");
    } catch(error){
      setStatus(error instanceof Error ? error.message : "Unable to save question.");
    } finally {setBusy(false);}
  }

  function editor() {
    if(!current) return null;
    const afterLabel=orderedCampFields(current.form_kind,items.filter(x=>x.form_kind===current.form_kind))
      .find(x=>x.field_key===current.after_field);
    const afterName=afterLabel
      ? afterLabel.type==="builtin" ? afterLabel.label : afterLabel.field.label
      : "the selected question";
    return <div className="card" style={{margin:"12px 0 18px",padding:16}}>
      <h4 style={{marginTop:0}}>{editing ? "Edit Field" : "Add New Field"}</h4>
      <p className="section-copy">
        {current.form_kind==="camper" ? "Attendee" : "Volunteer"} form
        {" · "}{editing ? "Existing field" : "Insert directly after " + afterName}
      </p>
      <div className="field"><label>Question / field label</label>
        <input autoFocus value={current.label} maxLength={160}
          onChange={e=>update({label:e.target.value})}/></div>
      <div className="field"><label>Field type</label>
        <select value={current.input_type}
          onChange={e=>{update({input_type:e.target.value as InputType});setChoicesText("");}}>
          {inputTypes.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>
      {editing ? <p className="section-copy">
        Report key: {editing.field_key}. Kept unchanged so historical answers stay associated.
      </p> : <div className="field"><label>Report field key (optional)</label>
        <input value={current.field_key} maxLength={48}
          placeholder={slug(current.label)} onChange={e=>update({field_key:e.target.value})}/>
      </div>}
      {isChoice(current.input_type) && <div className="field">
        <label>Choices (one per line, 2–20)</label>
        <textarea rows={4} value={choicesText} onChange={e=>setChoicesText(e.target.value)}/>
      </div>}
      <div className="checks" style={{marginTop:14}}>
        <label><input type="checkbox" checked={current.required}
          onChange={e=>update({required:e.target.checked})}/> Required</label>
        <label><input type="checkbox" checked={current.active}
          onChange={e=>update({active:e.target.checked})}/> Show publicly</label>
      </div>
      {editing && <div className="field" style={{marginTop:14}}>
        <label>Order among questions inserted at this position</label>
        <input type="number" min={0} max={100000} value={current.sort_order}
          onChange={e=>update({sort_order:Number(e.target.value)})}/>
      </div>}
      <div className="actions" style={{marginTop:16}}>
        <button type="button" className="btn btn-primary" disabled={busy} onClick={()=>void save()}>
          {busy ? "Saving…" : "Save Field"}
        </button>
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={cancel}>Cancel</button>
      </div>
    </div>;
  }

  return <section className="card" style={{marginTop:24}}>
    <h3>Form Field Editor</h3>
    <p className="section-copy">Every existing field has an <strong>+ Add Field Below</strong> option.
      Select the position, enter the new question, and save. All authorized Camp Rise Again
      admins can edit these shared form definitions. Answers remain private in the database.</p>
    <div className="actions">
      <button type="button" className="btn btn-secondary" onClick={()=>void refresh()}>Refresh Fields</button>
      <Link className="btn btn-secondary" href="/apply" target="_blank">Preview Attendee Form</Link>
      <Link className="btn btn-secondary" href="/volunteer" target="_blank">Preview Volunteer Form</Link>
    </div>
    {!loaded && <p className="section-copy">Loading form fields…</p>}
    {kinds.map(kind=><div key={kind} style={{marginTop:24}}>
      <h4 style={{fontSize:18,marginBottom:8}}>
        {kind==="camper" ? "Attendee Application" : "Volunteer Application"}
      </h4>
      <p className="section-copy">{BUILTIN_QUESTIONS[kind].length} standard fields plus{" "}
        {items.filter(x=>x.form_kind===kind).length} custom fields. Standard fields are
        required by the existing intake process and remain protected from removal.</p>
      <div style={{display:"grid",gap:8}}>
        {orderedCampFields(kind,items.filter(x=>x.form_kind===kind)).map(position=>{
          const existing=position.type==="custom" ? position.field : null;
          const isEditing=editing?.field_key===position.field_key &&
            editing?.form_kind===kind;
          const isAdding=draft?.after_field===position.field_key &&
            draft?.form_kind===kind;
          return <div key={kind+position.field_key} className="card"
            style={{padding:12}}>
            <div style={{display:"flex",gap:12,justifyContent:"space-between",
              alignItems:"center",flexWrap:"wrap"}}>
              <div style={{minWidth:0,flex:"1 1 170px"}}>
                <strong>{existing?.label || (position.type==="builtin" ? position.label:"")}</strong>
                <div style={{fontSize:12,opacity:.75,marginTop:4}}>
                  {existing ? [inputTypes.find(t=>t.value===existing.input_type)?.label,
                    existing.required ? "Required":"Optional",
                    existing.active ? "Visible":"Hidden"].filter(Boolean).join(" · ")
                    : "Standard field · Existing application data"}
                </div>
              </div>
              <div className="actions" style={{margin:0}}>
                {existing && <button type="button" className="btn btn-secondary"
                  onClick={()=>beginEditing(existing)}>Edit</button>}
                <button type="button" className="btn btn-secondary"
                  onClick={()=>beginAdding(kind,position.field_key)}>
                  + Add Field Below
                </button>
              </div>
            </div>
            {(isAdding || isEditing) && editor()}
          </div>;
        })}
      </div>
    </div>)}
    {status && <p className="status" role="status" aria-live="polite">{status}</p>}
    <p className="section-copy" style={{marginTop:18}}>
      Avoid collecting mental-health diagnoses, medications, or detailed clinical information
      in custom fields. Hiding a question will not erase previously submitted answers.
    </p>
  </section>;
}
