"use client";

import { FormEvent, useState } from "react";
import SiteHeader from "@/components/SiteHeader";

export default function ApplyPage() {
  const [status, setStatus] = useState("");
  const [sending, setSending] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setSending(true); setStatus("");
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    const res = await fetch("/api/apply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    const json = await res.json().catch(() => ({}));
    if (res.ok) { form.reset(); setStatus("Application received. Thank you!"); }
    else setStatus(json.error || "We couldn't submit your application. Please try again.");
    setSending(false);
  }

  return <><SiteHeader /><main className="form-wrap"><div className="eyebrow">Camper intake</div><h1>Apply to attend</h1><p className="section-copy">Complete the form below for an upcoming Camp Rise Again season.</p><form className="form-card" onSubmit={submit}><div className="field-grid"><div className="field"><label htmlFor="firstName">First name</label><input id="firstName" name="firstName" required /></div><div className="field"><label htmlFor="lastName">Last name</label><input id="lastName" name="lastName" required /></div></div><div className="field-grid"><div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" required /></div><div className="field"><label htmlFor="phone">Phone</label><input id="phone" name="phone" type="tel" required /></div></div><div className="field"><label htmlFor="address1">Street address</label><input id="address1" name="address1" required /></div><div className="field"><label htmlFor="address2">Apt / Unit (optional)</label><input id="address2" name="address2" /></div><div className="field-grid"><div className="field"><label htmlFor="city">City</label><input id="city" name="city" required /></div><div className="field"><label htmlFor="state">State</label><input id="state" name="state" required /></div></div><div className="field-grid"><div className="field"><label htmlFor="postalCode">ZIP code</label><input id="postalCode" name="postalCode" required /></div><div className="field"><label htmlFor="dateOfBirth">Birthday</label><input id="dateOfBirth" name="dateOfBirth" type="date" required /></div></div><div className="field-grid"><div className="field"><label htmlFor="shirtSize">Shirt size</label><select id="shirtSize" name="shirtSize" required defaultValue=""><option value="" disabled>Select size</option><option>XS</option><option>S</option><option>M</option><option>L</option><option>XL</option><option>2XL</option><option>3XL</option><option>4XL</option></select></div><div className="field"><label htmlFor="season">Preferred season</label><select id="season" name="season" required defaultValue=""><option value="" disabled>Select season</option><option value="fall">Fall</option><option value="spring">Spring</option><option value="either">Either / No preference</option></select></div></div><div className="field"><label htmlFor="notes">Anything else we should know? (optional)</label><textarea id="notes" name="notes" /></div><input name="website" tabIndex={-1} autoComplete="off" style={{display:"none"}} /><label className="checks" style={{display:"flex"}}><input type="checkbox" name="consent" value="yes" required /> I consent to Camp Rise Again collecting and reviewing this information for camp application purposes.</label><div className="notice">This form collects personal information, including date of birth and address, for camp intake purposes.</div><button className="btn btn-primary" disabled={sending}>{sending ? "Submitting…" : "Submit Application"}</button>{status && <div className="status" aria-live="polite">{status}</div>}</form></main></>;
}
