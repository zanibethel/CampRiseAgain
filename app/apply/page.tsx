"use client";

import { FormEvent, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import { openPreparedEmail } from "@/lib/form-pdf";

const RECIPIENT = "Schofieldtierra@gmail.com";

export default function ApplyPage() {
  const [status, setStatus] = useState("");
  const [working, setWorking] = useState(false);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setWorking(true);
    setStatus("");

    try {
      const fd = new FormData(e.currentTarget);
      const v = (name: string) => String(fd.get(name) || "").trim();
      const firstName = v("firstName");
      const lastName = v("lastName");
      const fullName = `${firstName} ${lastName}`.trim();
      const address = [v("address1"), v("address2")].filter(Boolean).join(", ");
      const cityStateZip = `${v("city")}, ${v("state")} ${v("postalCode")}`.trim();
      const seasonLabels: Record<string, string> = {
        fall: "Fall",
        spring: "Spring",
        either: "Either / No preference",
      };
      const season = seasonLabels[v("season")] || v("season");
      const notes = v("notes") || "None";

      const subject = `Camp Rise Again application - ${fullName}`;
      const body = [
        "Hi Tierra,",
        "",
        "I completed the Camp Rise Again camper application on the website. My responses are below:",
        "",
        "CAMPER APPLICATION",
        "------------------",
        `Name: ${fullName}`,
        `Email: ${v("email")}`,
        `Phone: ${v("phone")}`,
        `Address: ${address}`,
        `City / State / ZIP: ${cityStateZip}`,
        `Birthday: ${v("dateOfBirth")}`,
        `Shirt size: ${v("shirtSize")}`,
        `Preferred season: ${season}`,
        "",
        "Anything else we should know?",
        notes,
        "",
        "Consent: Yes — I consent to Camp Rise Again using this information for camp application purposes.",
        "",
        "Thank you.",
      ].join("\n");

      setStatus("Your email app is opening with your completed application already filled into the message. Review it, then send it to Tierra.");
      openPreparedEmail(RECIPIENT, subject, body);
    } catch (error) {
      console.error(error);
      setStatus("We couldn't prepare the application email. Please try again.");
    } finally {
      setWorking(false);
    }
  }

  return <><SiteHeader /><main className="form-wrap"><div className="eyebrow">Camper intake</div><h1>Apply to attend</h1><p className="section-copy">Complete the form below. When you submit, your email app will open with Tierra's address and all of your answers already filled into the email.</p><form className="form-card" onSubmit={submit}><div className="field-grid"><div className="field"><label htmlFor="firstName">First name</label><input id="firstName" name="firstName" required /></div><div className="field"><label htmlFor="lastName">Last name</label><input id="lastName" name="lastName" required /></div></div><div className="field-grid"><div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" required /></div><div className="field"><label htmlFor="phone">Phone</label><input id="phone" name="phone" type="tel" required /></div></div><div className="field"><label htmlFor="address1">Street address</label><input id="address1" name="address1" required /></div><div className="field"><label htmlFor="address2">Apt / Unit (optional)</label><input id="address2" name="address2" /></div><div className="field-grid"><div className="field"><label htmlFor="city">City</label><input id="city" name="city" required /></div><div className="field"><label htmlFor="state">State</label><input id="state" name="state" required /></div></div><div className="field-grid"><div className="field"><label htmlFor="postalCode">ZIP code</label><input id="postalCode" name="postalCode" required /></div><div className="field"><label htmlFor="dateOfBirth">Birthday</label><input id="dateOfBirth" name="dateOfBirth" type="date" required /></div></div><div className="field-grid"><div className="field"><label htmlFor="shirtSize">Shirt size</label><select id="shirtSize" name="shirtSize" required defaultValue=""><option value="" disabled>Select size</option><option>XS</option><option>S</option><option>M</option><option>L</option><option>XL</option><option>2XL</option><option>3XL</option><option>4XL</option></select></div><div className="field"><label htmlFor="season">Preferred season</label><select id="season" name="season" required defaultValue=""><option value="" disabled>Select season</option><option value="fall">Fall</option><option value="spring">Spring</option><option value="either">Either / No preference</option></select></div></div><div className="field"><label htmlFor="notes">Anything else we should know? (optional)</label><textarea id="notes" name="notes" /></div><label className="checks" style={{display:"flex"}}><input type="checkbox" name="consent" value="yes" required /> I consent to Camp Rise Again using this information for camp application purposes.</label><div className="notice">For privacy, your answers stay on your device until your email app opens. Review the prepared email before sending it.</div><button className="btn btn-primary" disabled={working}>{working ? "Opening Email…" : "Prepare Application Email"}</button>{status && <div className="status" aria-live="polite">{status}</div>}</form></main></>;
}
