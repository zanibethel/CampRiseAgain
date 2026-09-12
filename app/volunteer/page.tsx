"use client";

import { FormEvent, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import { downloadFormPdf, openPreparedEmail } from "@/lib/form-pdf";

const RECIPIENT = "Schofieldtierra@gmail.com";
const roles = [["food_beverage", "Food & beverage"],["camp_mentor_support", "Camp mentor support"],["activity_coordinator", "Activity coordinator"],["transportation", "Transportation volunteer"],["setup", "Setup"],["take_down", "Take down"]];

export default function VolunteerPage() {
  const [status, setStatus] = useState("");
  const [working, setWorking] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setWorking(true);
    setStatus("");
    try {
      const fd = new FormData(e.currentTarget);
      const v = (name: string) => String(fd.get(name) || "").trim();
      const firstName = v("firstName");
      const lastName = v("lastName");
      const selectedRoles = fd.getAll("roles").map(String);
      if (selectedRoles.length === 0) {
        setStatus("Choose at least one volunteer area.");
        setWorking(false);
        return;
      }
      const roleLabels = selectedRoles.map((value) => roles.find(([key]) => key === value)?.[1] || value);
      const filename = `Camp-Rise-Again-Volunteer-${firstName}-${lastName}`.replace(/[^a-z0-9-]+/gi, "-") + ".pdf";

      await downloadFormPdf({
        title: "Volunteer Form",
        filename,
        rows: [
          ["Name", `${firstName} ${lastName}`],
          ["Email", v("email")],
          ["Phone", v("phone")],
          ["Preferred season", v("season")],
          ["Volunteer interests", roleLabels.join(", ")],
          ["Experience / availability / notes", v("notes") || "None"],
        ],
      });

      setStatus("Your volunteer PDF downloaded. Your email app is opening. Attach the downloaded PDF, then send it to Tierra.");
      const subject = `Camp Rise Again volunteer - ${firstName} ${lastName}`;
      const body = `Hi Tierra,\n\nI completed the Camp Rise Again volunteer form on the website. Please find my downloaded volunteer PDF attached.\n\nName: ${firstName} ${lastName}\nEmail: ${v("email")}\nPhone: ${v("phone")}\nVolunteer interests: ${roleLabels.join(", ")}\n\nThank you.`;
      setTimeout(() => openPreparedEmail(RECIPIENT, subject, body), 300);
    } catch (error) {
      console.error(error);
      setStatus("We couldn't prepare the volunteer PDF. Please try again.");
    } finally {
      setWorking(false);
    }
  }

  return <><SiteHeader /><main className="form-wrap"><div className="eyebrow">Volunteer</div><h1>Help make camp happen</h1><p className="section-copy">Choose one or more areas where you'd like to serve. When you submit, a PDF will download and your email app will open with Tierra's address and a prepared message.</p><form className="form-card" onSubmit={submit}><div className="field-grid"><div className="field"><label htmlFor="firstName">First name</label><input id="firstName" name="firstName" required /></div><div className="field"><label htmlFor="lastName">Last name</label><input id="lastName" name="lastName" required /></div></div><div className="field-grid"><div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" required /></div><div className="field"><label htmlFor="phone">Phone</label><input id="phone" name="phone" type="tel" required /></div></div><div className="field"><label htmlFor="season">Preferred season</label><select id="season" name="season" required defaultValue=""><option value="" disabled>Select season</option><option value="fall">Fall</option><option value="spring">Spring</option><option value="both">Both</option></select></div><fieldset><legend>Volunteer interests</legend><div className="checks">{roles.map(([value,label]) => <label key={value}><input type="checkbox" name="roles" value={value} />{label}</label>)}</div></fieldset><div className="field"><label htmlFor="notes">Experience, availability, or notes (optional)</label><textarea id="notes" name="notes" /></div><label className="checks" style={{display:"flex"}}><input type="checkbox" name="consent" value="yes" required /> I consent to Camp Rise Again using this information to contact me about volunteering.</label><div className="notice">For privacy, this version prepares the volunteer form on your device. You will attach the downloaded PDF to the email before sending.</div><button className="btn btn-primary" disabled={working}>{working ? "Preparing PDF…" : "Prepare Volunteer Email"}</button>{status && <div className="status" aria-live="polite">{status}</div>}</form></main></>;
}
