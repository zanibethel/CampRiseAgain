import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import ResourcesList from "@/components/ResourcesList";

export const metadata = {
  title: "Resources | Camp Rise Again",
  description:
    "Mental health, crisis, treatment, and community support resources from Camp Rise Again.",
};

export default function ResourcesPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="section">
          <div className="eyebrow">Support beyond camp</div>
          <h1 style={{ fontSize: "clamp(42px, 6vw, 68px)", maxWidth: 850 }}>
            Resources for the moments when you need more support.
          </h1>
          <p className="lead">
            Camp Rise Again is about connection, hope, and taking another step forward. These resources can help you find immediate support, ongoing care, and community outside of camp.
          </p>

          <div className="notice" style={{ marginTop: 28, fontSize: 16, lineHeight: 1.6 }}>
            <strong>If you or someone else is in immediate danger, call 911.</strong>{" "}
            If you are experiencing a mental health or suicide crisis in the U.S., call or text <strong>988</strong> or visit the 988 Lifeline website.
          </div>
        </section>

        <section className="section" style={{ paddingTop: 0 }}>
          <div className="eyebrow">Support resources</div>
          <h2>Places to reach out, learn, and find care.</h2>
          <ResourcesList />
        </section>

        <section className="section">
          <div className="eyebrow">Camp Rise Again</div>
          <h2>Looking for support through the camp?</h2>
          <p className="section-copy">
            If Camp Rise Again feels like a place that could help you reconnect with people and with life, you can apply to attend or contact us with questions.
          </p>
          <div className="actions">
            <Link className="btn btn-primary" href="/apply">Apply to Attend</Link>
            <Link className="btn btn-secondary" href="/contact">Contact Us</Link>
          </div>
        </section>

        <section className="section" style={{ paddingTop: 0 }}>
          <div className="notice">
            Camp Rise Again is not a medical provider, therapy service, or crisis service. The resources listed here are provided as starting points for finding additional support.
          </div>
        </section>
      </main>
      <footer>
        <div className="footer-inner">
          <strong>Camp Rise Again</strong>
          <Link href="/resources">Resources</Link>
        </div>
      </footer>
    </>
  );
}
