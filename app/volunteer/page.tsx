"use client";

import { FormEvent, useState } from "react";
import SiteHeader from "@/components/SiteHeader";

const roles = [["food_beverage", "Food & beverage"],["camp_mentor_support", "Camp mentor support"],["activity_coordinator", "Activity coordinator"],["transportation", "Transportation volunteer"],["setup", "Setup"],["take_down", "Take down"]];

export default function VolunteerPage() {
  const [status, setStatus] = useState("");
  const [sending, setSending] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setSending(true); setStatus("");
    const form = e.currentTarget; const fd = new FormData(form);
    const body: Record<string, unknown> = Object.fromEntries(fd.entries());
    body.roles = fd.getAll("roles");
    const res = await fetch("/api/volunteer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    if (res.ok) { form.reset(); setStatus("Volunteer form received. Thank you!"); } else setStatus(json.error || "We couldn't submit the form. Please try again.");
    setSending(false);
  }
  return <><SiteHeader /><main className="form-wrap"><div className="eyebrow">Volunteer</div><h1>Help make camp happen</h1><p className="section-copy">Choose one or more areas where you'd like to serve.</p><form className="form-card" onSubmit={submit}><div className="field-grid"><div className="field"><label htmlFor="firstName">First name</label><input id="firstName" name="firstName" required /></div><div className="field"><label htmlFor="lastName">Last name</label><input id="lastName" name="lastName" required /></div></div><div className="field-grid"><div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" required /></div><div className="field"><label htmlFor="phone">Phone</label><input id="phone" name="phone" type="tel" required /></div></div><div className="field"><label htmlFor="season">Preferred season</label><select id="season" name="season" required defaultValue=""><option value="" disabled>Select season</option><option value="fall">Fall</option><option value="spring">Spring</option><option value="both">Both</option></select></div><fieldset><legend>Volunteer interests</legend><div className="checks">{roles.map(([value,label]) => <label key={value}><input type="checkbox" name="roles" value={value} />{label}</label>)}</div></fieldset><div className="field"><label htmlFor="notes">Experience, availability, or notes (optional)</label><textarea id="notes" name="notes" /></div><input name="website" tabIndex={-1} autoComplete="off" style={{display:"none"}} /><label className="checks" style={{display:"flex"}}><input type="checkbox" name="consent" value="yes" required /> I consent to Camp Rise Again using this information to contact me about volunteering.</label><button className="btn btn-primary" disabled={sending}>{sending ? "Submitting…" : "Submit Volunteer Form"}</button>{status && <div className="status" aria-live="polite">{status}</div>}</form></main></>;
}
