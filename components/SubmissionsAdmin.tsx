"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import CampFormFieldsAdmin from "@/components/CampFormFieldsAdmin";

type Summary = {
  id: string; kind: "camper" | "volunteer" | "contact"; created_at: string;
  first_name?: string; last_name?: string; name?: string; email: string;
  topic?: string; season_preference?: string;
};
type Detail = Record<string, unknown>;
type Counters = {total:number;last30Days:number};
type Report = {
  counts:Record<"camper"|"volunteer"|"contact",Counters>;
  roleCounts:Record<string,number>;
  seasonCounts:Record<string,number>;
  sourceCounts:Record<string,number>;
  preferencesSampled:boolean;
};
const roleLabels:Record<string,string>={
  food_beverage:"Food & beverage",camp_mentor_support:"Camp mentor support",
  activity_coordinator:"Activity coordinator",transportation:"Transportation",
  setup:"Setup",take_down:"Take down",
};

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
  const [report,setReport] = useState<Report|null>(null);
  const [exporting,setExporting] = useState(false);

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

  const fetchProtectedEngagement = useCallback(async ():Promise<Report> => {
    const {data,error}=await getSupabaseBrowserClient().auth.getSession();
    if(error || !data.session?.access_token) throw new Error("Please sign in again.");
    const response=await fetch("/api/admin/engagement",{
      headers:{Authorization:"Bearer "+data.session.access_token},cache:"no-store",
    });
    const payload=await response.json();
    if(!response.ok) throw new Error(payload.error || "Unable to load engagement report.");
    return payload as Report;
  },[]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchProtected();
      setRecords(result.submissions || []);
      const counts=await fetchProtectedEngagement();
      setReport(counts);
      setStatus("");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Unable to load submissions."); }
    finally { setLoading(false); }
  }, [fetchProtected,fetchProtectedEngagement]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function show(item: Summary) {
    setSelected(item); setDetail(null); setStatus("");
    try {
      const result = await fetchProtected("?kind=" + encodeURIComponent(item.kind) + "&id=" + encodeURIComponent(item.id));
      setDetail(result.submission);
    } catch (error) { setStatus(error instanceof Error ? error.message : "Unable to load the submission."); }
  }

  async function exportCsv() {
    if(exporting) return;
    setExporting(true);setStatus("");
    try {
      const {data,error}=await getSupabaseBrowserClient().auth.getSession();
      if(error || !data.session?.access_token) throw new Error("Please sign in again.");
      const response=await fetch("/api/admin/submissions/export?kind="+filter,{
        headers:{Authorization:"Bearer "+data.session.access_token},cache:"no-store",
      });
      if(!response.ok) throw new Error("Could not download submissions.");
      const truncated=response.headers.get("X-Export-Truncated")==="true";
      const blob=await response.blob();
      const url=URL.createObjectURL(blob);
      const a=document.createElement("a");
      a.href=url;
      a.download="camp-rise-again-"+filter+"-submissions.csv";
      document.body.appendChild(a);a.click();a.remove();
      window.setTimeout(()=>URL.revokeObjectURL(url),1000);
      setStatus(truncated
        ? "CSV downloaded, but this export includes at most 1,000 entries per form. Contact support for a complete historical export."
        : "CSV downloaded. Keep this file private; it contains applicant contact information.");
    }catch(error){setStatus(error instanceof Error?error.message:"Export unavailable.");}
    finally{setExporting(false);}
  }

  const visible = filter === "all" ? records : records.filter(x=>x.kind === filter);
  return (
    <section className="form-card" aria-label="Camp Rise Again submissions">
      <h2>Form Submissions</h2>
      <p className="section-copy">Review applications and contact requests privately. Email notifications contain a reference number, not the full submission.</p>
      {report && <div className="card" style={{margin:"18px 0"}}>
        <h3>Engagement report</h3>
        <p className="section-copy">Stored form submissions, not anonymous website visits. The 30-day numbers count each completed form.</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12}}>
          {(["camper","volunteer","contact"] as const).map(kind=><div className="card" key={kind}>
            <div style={{textTransform:"capitalize",fontSize:14,fontWeight:700}}>{kind==="camper"?"Attendees":kind==="volunteer"?"Volunteers":"Contact inquiries"}</div>
            <div style={{fontSize:28,fontWeight:800,marginTop:6}}>{report.counts[kind]?.total ?? 0}</div>
            <div style={{fontSize:13,opacity:.75}}>{report.counts[kind]?.last30Days ?? 0} in last 30 days</div>
          </div>)}
        </div>
        <h4 style={{marginTop:20}}>Volunteer interest</h4>
        {Object.keys(report.roleCounts).length===0 ? <p className="section-copy">No volunteer interests submitted yet.</p> :
          <div style={{display:"grid",gap:8}}>
            {Object.entries(report.roleCounts).sort((a,b)=>b[1]-a[1]).map(([role,count])=>
              <div key={role} style={{display:"flex",justifyContent:"space-between",gap:12}}>
                <span>{roleLabels[role] || role}</span><strong>{count}</strong>
              </div>)}
          </div>}
        <h4 style={{marginTop:20}}>How people found us</h4>
        {Object.keys(report.sourceCounts || {}).length===0
          ? <p className="section-copy">No discovery sources collected yet.</p>
          : <div style={{display:"grid",gap:8}}>
              {Object.entries(report.sourceCounts).sort((a,b)=>b[1]-a[1]).map(([source,count])=>
                <div key={source} style={{display:"flex",justifyContent:"space-between",gap:12}}>
                  <span>{source}</span><strong>{count}</strong>
                </div>)}
            </div>}
        {report.preferencesSampled && <p className="section-copy">Preference breakdown samples up to 1,000 submissions per form; totals remain exact.</p>}
      </div>}
      <div className="actions">
        <label className="field" style={{minWidth:200}}>Show
          <select value={filter} onChange={event=>setFilter(event.target.value as typeof filter)}>
            <option value="all">All</option><option value="camper">Camper applications</option>
            <option value="volunteer">Volunteer forms</option><option value="contact">Contact questions</option>
          </select>
        </label>
        <button type="button" className="btn btn-secondary" onClick={()=>void refresh()}>Refresh</button>
        <button type="button" className="btn btn-primary" disabled={exporting} onClick={()=>void exportCsv()}>
          {exporting?"Preparing CSV…":"Export CSV"}
        </button>
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
      <p className="section-copy" style={{marginTop:18}}>For privacy, keep downloaded CSV files secure and do not forward personal application details by email. Reply to the notification in Gmail to contact the applicant using the original organization address.</p>
      <CampFormFieldsAdmin/>
    </section>
  );
}
