"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";

type Kind = "camper" | "volunteer" | "contact";
const roles = [
  ["food_beverage", "Food & beverage"],
  ["camp_mentor_support", "Camp mentor support"],
  ["activity_coordinator", "Activity coordinator"],
  ["transportation", "Transportation volunteer"],
  ["setup", "Setup"],
  ["take_down", "Take down"],
];

const paths: Record<Kind,{ endpoint:string; faq:string; label:string }> = {
  camper: { endpoint:"/api/apply", faq:"/faq/campers", label:"Camper application" },
  volunteer: { endpoint:"/api/volunteer", faq:"/faq/volunteers", label:"Volunteer application" },
  contact: { endpoint:"/api/contact", faq:"/faq", label:"Contact message" },
};

export default function CampSubmissionForm({ kind }: { kind: Kind }) {
  const [working, setWorking] = useState(false);
  const [status, setStatus] = useState("");
  const [success, setSuccess] = useState(false);
  const requestId = useRef<string | null>(null);
  const [contactTopic, setContactTopic] = useState("");
  useEffect(() => {
    if (kind !== "contact") return;
    const topic = new URLSearchParams(window.location.search).get("topic") || "";
    if (["Camper application","Volunteering","Camp dates or location",
      "Donations or sponsorships","Accessibility or accommodations","General question"].includes(topic)) {
      setContactTopic(topic);
    }
  }, [kind]);

  const isContact = kind === "contact";
  const isCamper = kind === "camper";
  const config = paths[kind];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (working) return;
    const form = event.currentTarget;
    const fd = new FormData(form);
    if (kind === "volunteer" && fd.getAll("roles").length === 0) {
      setStatus("Choose at least one volunteer interest.");
      setSuccess(false);
      return;
    }
    if (!requestId.current) requestId.current = crypto.randomUUID();
    const body: Record<string,unknown> = Object.fromEntries(fd.entries());
    if (kind === "volunteer") body.roles = fd.getAll("roles").map(String);
    body.consent = fd.get("consent") === "yes";
    body.requestId = requestId.current;
    setWorking(true);
    setSuccess(false);
    setStatus("");
    try {
      const response = await fetch(config.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setStatus(result.error || "Your form couldn't be submitted. Please try again.");
        return;
      }
      form.reset();
      requestId.current = null;
      setSuccess(true);
      setStatus(config.label + " received. Your reference number is " + result.id +
        ". " + (result.deliveryWarning
          ? "Your information is saved, but an email notification might be delayed."
          : "A confirmation has been sent to your email."));
    } catch {
      setStatus("Connection unavailable. Check your connection and try again. Your form has not been confirmed.");
    } finally { setWorking(false); }
  }

  return (
    <form className="form-card" onSubmit={submit}>
      <div style={{ position: "absolute", left: "-9999px", width: 1, height: 1, overflow: "hidden" }}
        aria-hidden="true">
        <label>Leave this field empty<input type="text" name="website" autoComplete="off" tabIndex={-1} /></label>
      </div>

      {isContact ? (
        <>
          <div className="field-grid">
            <div className="field"><label htmlFor="contact-name">Name</label><input id="contact-name" name="name" autoComplete="name" maxLength={120} required /></div>
            <div className="field"><label htmlFor="contact-email">Email</label><input id="contact-email" type="email" name="email" autoComplete="email" required /></div>
          </div>
          <div className="field-grid">
            <div className="field"><label htmlFor="contact-phone">Phone (optional)</label><input id="contact-phone" type="tel" name="phone" autoComplete="tel" maxLength={40} /></div>
            <div className="field"><label htmlFor="contact-topic">What can we help with?</label>
              <select id="contact-topic" name="topic" required value={contactTopic} onChange={event => setContactTopic(event.target.value)}>
                <option value="" disabled>Select a topic</option>
                <option>Camper application</option>
                <option>Volunteering</option>
                <option>Camp dates or location</option>
                <option>Donations or sponsorships</option>
                <option>Accessibility or accommodations</option>
                <option>General question</option>
              </select>
            </div>
          </div>
          <div className="field"><label htmlFor="contact-message">Message</label><textarea id="contact-message" name="message" maxLength={4000} minLength={3} rows={5} required /></div>
        </>
      ) : (
        <>
          <div className="field-grid">
            <div className="field"><label htmlFor="firstName">First name</label><input id="firstName" name="firstName" autoComplete="given-name" maxLength={100} required /></div>
            <div className="field"><label htmlFor="lastName">Last name</label><input id="lastName" name="lastName" autoComplete="family-name" maxLength={100} required /></div>
          </div>
          <div className="field-grid">
            <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" autoComplete="email" type="email" required /></div>
            <div className="field"><label htmlFor="phone">Phone</label><input id="phone" name="phone" autoComplete="tel" type="tel" maxLength={40} required /></div>
          </div>
          {isCamper && (
            <>
              <div className="field"><label htmlFor="address1">Street address</label><input id="address1" name="address1" maxLength={250} autoComplete="street-address" required /></div>
              <div className="field"><label htmlFor="address2">Apt / unit (optional)</label><input id="address2" name="address2" maxLength={120} /></div>
              <div className="field-grid">
                <div className="field"><label htmlFor="city">City</label><input id="city" name="city" autoComplete="address-level2" maxLength={100} required /></div>
                <div className="field"><label htmlFor="state">State</label><input id="state" name="state" autoComplete="address-level1" maxLength={60} required /></div>
              </div>
              <div className="field-grid">
                <div className="field"><label htmlFor="postalCode">ZIP code</label><input id="postalCode" name="postalCode" autoComplete="postal-code" maxLength={20} required /></div>
                <div className="field"><label htmlFor="dateOfBirth">Birthday</label><input id="dateOfBirth" name="dateOfBirth" type="date" required /></div>
              </div>
              <div className="field"><label htmlFor="shirtSize">Shirt size</label>
                <select id="shirtSize" name="shirtSize" required defaultValue=""><option value="" disabled>Choose a size</option>
                  {["XS","S","M","L","XL","2XL","3XL","4XL"].map(x=><option key={x}>{x}</option>)}
                </select>
              </div>
            </>
          )}
          <div className="field"><label htmlFor="season">Preferred camp season</label>
            <select id="season" name="season" defaultValue="" required>
              <option value="" disabled>Choose a season</option>
              <option value="fall">Fall</option><option value="spring">Spring</option>
              <option value={isCamper ? "either":"both"}>{isCamper ? "Either / No preference":"Both"}</option>
            </select>
          </div>
          {!isCamper && (
            <fieldset><legend>Volunteer interests</legend><div className="checks">
              {roles.map(([value,label])=><label key={value}><input type="checkbox" name="roles" value={value}/>{label}</label>)}
            </div></fieldset>
          )}
          <div className="field"><label htmlFor="notes">{isCamper ? "Anything else we should know? (optional)" : "Experience, availability, or notes (optional)"}</label><textarea id="notes" name="notes" maxLength={2000} rows={4}/></div>
        </>
      )}

      <label className="checks" style={{ display: "flex", alignItems:"flex-start", gap: 10 }}>
        <input type="checkbox" name="consent" value="yes" required style={{ marginTop: 4 }} />
        {isContact
          ? "I agree that Camp Rise Again may use my details to respond to this inquiry."
          : "I consent to Camp Rise Again using this information for the application and follow-up purposes described above."}
      </label>
      <div className="notice">
        Submissions are saved in a restricted system. Staff receive a notification without your full form answers.
        This site is not monitored for emergencies: call 911 if you are in immediate danger or call/text 988 in the U.S. for crisis support.
      </div>
      <button className="btn btn-primary" type="submit" disabled={working}>
        {working ? "Submitting…" : isContact ? "Send Message" : "Submit " + config.label}
      </button>
      {status && <p className="status" role="status" aria-live="polite" style={success ? {fontWeight:600}:undefined}>{status}</p>}
      <p className="section-copy" style={{ marginTop: 18 }}>
        Questions before you submit? <Link href={config.faq}>Read the {isCamper ? "camper" : kind === "volunteer" ? "volunteer" : "Camp Rise Again"} FAQs</Link>.
      </p>
    </form>
  );
}
