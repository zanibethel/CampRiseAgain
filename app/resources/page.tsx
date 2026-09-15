import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

export const metadata = {
  title: "Resources | Camp Rise Again",
  description:
    "Mental health, crisis, treatment, and community support resources from Camp Rise Again.",
};

const resources = [
  {
    title: "988 Suicide & Crisis Lifeline",
    description:
      "If you are in emotional distress, having thoughts of suicide, or need someone to talk with, call or text 988. Support is available 24/7 in the United States.",
    href: "https://988lifeline.org/",
    action: "Visit 988 Lifeline",
  },
  {
    title: "SAMHSA National Helpline",
    description:
      "Free, confidential treatment referral and information for mental health and substance use concerns. Call 1-800-662-HELP (4357), 24 hours a day, 365 days a year.",
    href: "https://www.samhsa.gov/find-help/helplines/national-helpline",
    action: "Visit SAMHSA",
  },
  {
    title: "FindTreatment.gov",
    description:
      "Search for mental health and substance use treatment providers near you using SAMHSA's confidential treatment locator.",
    href: "https://findtreatment.gov/",
    action: "Find Treatment",
  },
  {
    title: "NAMI HelpLine",
    description:
      "Get mental health information, resource referrals, and peer-informed support from the National Alliance on Mental Illness.",
    href: "https://www.nami.org/nami-helpline/",
    action: "Visit NAMI",
  },
  {
    title: "Find Your Local NAMI",
    description:
      "Connect with a NAMI organization near you for local programs, support groups, education, and community resources.",
    href: "https://www.nami.org/find-your-local-nami/",
    action: "Find Local Support",
  },
];

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
          <div className="eyebrow">National resources</div>
          <h2>Places to reach out, learn, and find care.</h2>
          <div className="cards">
            {resources.map((resource) => (
              <article className="card" key={resource.title}>
                <h3>{resource.title}</h3>
                <p className="section-copy">{resource.description}</p>
                <div className="actions">
                  <a
                    className="btn btn-primary"
                    href={resource.href}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {resource.action}
                  </a>
                </div>
              </article>
            ))}
          </div>
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
