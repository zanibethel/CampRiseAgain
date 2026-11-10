"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type Summary = {
  id: string; kind: "camper" | "volunteer" | "contact"; created_at: string;
  first_name?: string; last_name?: string; name?: string; email: string;
  topic?: string; season_preference?: string;
};
type Detail = Record<string, unknown>;

const labels: Record<string, string> = {
  id: "Reference", created_at: "Submitted at", first_name: "First name",
  last_name: "Last name", name: "Name", email: "Email", phone: "Phone",
  address_1: "Street address", address_2: "Apartment / unit",
  city: "City", state: "State", postal_code: "ZIP code",
  date_of_birth: "Birthday", shirt_size: "Shirt size",
  season_preference: "Preferred season", volunteer_roles: "Volunteer interests",
  topic: "Topic", message: "Question / message", notes: "Additional notes",
};
function display(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  return Array.isArray(value) ? value.join(", ") : String(value);
}

export default function SubmissionsAdmin() {
  const [records, setRecords] = useState<Summary[]>([]);
  const [filter, setFilter] = useState<"all"|"camper"|"volunteer"|"contact">("all");
  const [selected, setSelected] = useState<Summary | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");

  const fetchProtected = useCallback(async (query = "") => {
    const { data, error } = await getSupabaseBrowserClient().auth.getSession();
    if (error || !data.session?.access_token) throw new Error("Please sign in again.");
    const response = await fetch("/api/admin/submissions" + query, {
      headers: { Authorization: "Bearer " + data.session.access_token },
      cache: "no-store",
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Unable to retrieve submissions.");
    return payload;
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchProtected();
      setRecords(result.submissions || []);
      setStatus("");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Unable to load submissions."); }
    finally { setLoading(false); }
  }, [fetchProtected]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function show(item: Summary) {
    setSelected(item); setDetail(null); setStatus("");
    try {
      const result = await fetchProtected("?kind=" + encodeURIComponent(item.kind) + "&id=" + encodeURIComponent(item.id));
      setDetail(result.submission);
    } catch (error) { setStatus(error instanceof Error ? error.message : "Unable to load the submission."); }
  }

  const visible = filter === "all" ? records : records.filter(x=>x.kind === filter);
  return (
    <section className="form-card" aria-label="Camp Rise Again submissions">
      <h2>Form Submissions</h2>
      <p className="section-copy">Review applications and contact requests privately. Email notifications contain a reference number, not the full submission.</p>
      <div className="actions">
        <label className="field" style={{minWidth:200}}>Show
          <select value={filter} onChange={event=>setFilter(event.target.value as typeof filter)}>
            <option value="all">All</option><option value="camper">Camper applications</option>
            <option value="volunteer">Volunteer forms</option><option value="contact">Contact questions</option>
          </select>
        </label>
        <button type="button" className="btn btn-secondary" onClick={()=>void refresh()}>Refresh</button>
      </div>
      {loading ? <p>Loading private submissions…</p> : visible.length === 0
        ? <p className="section-copy">No submissions in this view yet.</p>
        : <div style={{display:"grid",gap:10}}>
          {visible.map(item=><button key={item.kind + item.id} type="button"
            className="card" onClick={()=>void show(item)}
            style={{textAlign:"left",cursor:"pointer",border:selected?.id===item.id?"2px solid currentColor":undefined}}>
            <strong>{item.kind === "camper" ? "Camper" : item.kind === "volunteer" ? "Volunteer" : "Contact"} — {item.name || [item.first_name,item.last_name].filter(Boolean).join(" ")}</strong>
            <span style={{display:"block",fontSize:14,marginTop:4}}>{item.email} · {new Date(item.created_at).toLocaleString()}</span>
            {item.topic && <span style={{display:"block",fontSize:14}}>Topic: {item.topic}</span>}
            <span style={{display:"block",fontSize:12,opacity:.7}}>Ref: {item.id}</span>
          </button>)}
        </div>}
      {selected && <div className="card" style={{marginTop:20}}>
        <div className="actions" style={{justifyContent:"space-between"}}>
          <h3>Submission details</h3>
          <button type="button" className="btn btn-secondary" onClick={()=>{setSelected(null);setDetail(null);}}>Close</button>
        </div>
        {!detail ? <p>Loading details…</p> :
        <dl style={{display:"grid",gap:12}}>
          {Object.entries(detail).filter(([key])=>key in labels).map(([key,value])=>
            <div key={key} style={{overflowWrap:"anywhere"}}>
              <dt style={{fontSize:13,fontWeight:700,opacity:.75}}>{labels[key]}</dt>
              <dd style={{margin:0,whiteSpace:"pre-wrap"}}>{display(value)}</dd>
            </div>)}
        </dl>}
      </div>}
      {status && <p className="status" role="status" aria-live="polite">{status}</p>}
      <p className="section-copy" style={{marginTop:18}}>For privacy, do not forward camper medical or personal details outside the protected admin portal. Reply to the notification in Gmail to contact the applicant using the original organization address.</p>
    </section>
  );
}
