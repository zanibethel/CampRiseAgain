"use client";

import { FormEvent, useState } from "react";
import SiteHeader from "@/components/SiteHeader";

const RECIPIENT = "Schofieldtierra@gmail.com";

export default function ContactPage() {
  const [status, setStatus] = useState("");
  const [working, setWorking] = useState(false);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setWorking(true);
    setStatus("");

    try {
      const fd = new FormData(e.currentTarget);
      const v = (name: string) => String(fd.get(name) || "").trim();
      const name = v("name");
      const email = v("email");
      const phone = v("phone");
      const topic = v("topic");
      const message = v("message");

      const subject = `Camp Rise Again contact - ${topic || "General question"} - ${name}`;
      const body = [
        "Hi Tierra,",
        "",
        "I’m contacting Camp Rise Again through the website.",
        "",
        `Name: ${name}`,
        `Email: ${email}`,
        `Phone: ${phone || "Not provided"}`,
        `Topic: ${topic}`,
        "",
        "Message:",
        message,
        "",
        "Thank you.",
      ].join("\n");

      const mailto = `mailto:${RECIPIENT}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      setStatus("Your email app is opening with your message prepared for Tierra.");
      window.location.href = mailto;
    } catch (error) {
      console.error(error);
      setStatus("We couldn't prepare your email. Please try again.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <>
      <SiteHeader />
      <main className="form-wrap">
        <div className="eyebrow">Contact us</div>
        <h1>Have a question?</h1>
        <p className="section-copy">
          Send us a message below. When you submit, your email app will open with your answers already included so you can review and send it directly.
        </p>

        <form className="form-card" onSubmit={submit}>
          <div className="field-grid">
            <div className="field">
              <label htmlFor="name">Name</label>
              <input id="name" name="name" required />
            </div>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" name="email" type="email" required />
            </div>
          </div>

          <div className="field-grid">
            <div className="field">
              <label htmlFor="phone">Phone (optional)</label>
              <input id="phone" name="phone" type="tel" />
            </div>
            <div className="field">
              <label htmlFor="topic">What can we help with?</label>
              <select id="topic" name="topic" required defaultValue="">
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

          <div className="field">
            <label htmlFor="message">Message</label>
            <textarea id="message" name="message" required />
          </div>

          <div className="notice">
            For privacy, your message is prepared on your device and is not stored by the website before you send it.
          </div>

          <button className="btn btn-primary" disabled={working}>
            {working ? "Preparing Email…" : "Prepare Contact Email"}
          </button>

          {status && <div className="status" aria-live="polite">{status}</div>}
        </form>
      </main>
    </>
  );
}
