import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import DonateButton from "@/components/DonateButton";
import TeamSection from "@/components/TeamSection";
import ManagedLogo from "@/components/ManagedLogo";
import MemorialSection from "@/components/MemorialSection";
import { CAMP_SLOGAN, CAMP_MISSION_STATEMENT, CAMP_HERO_LEAD, CAMP_ABOUT_COPY, CAMP_DONATE_COPY } from "@/lib/camp-mission";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main>
        <section id="hero" data-home-section="hero" className="hero">
          <div className="hero-inner">
            <div>
              <div className="eyebrow">Camp Rise Again</div>
              <h1>You don’t have to walk through the darkness alone.</h1>
              <p className="hero-slogan" data-managed-slogan>{CAMP_SLOGAN}</p>
              <p className="lead">
                {CAMP_HERO_LEAD}
              </p>
              <div className="actions">
                <Link className="btn btn-primary" href="/apply">Apply to Attend</Link>
                <Link className="btn btn-secondary" href="/volunteer">Become a Volunteer</Link>
                <DonateButton label="Donate" className="btn btn-donate" />
              </div>
            </div>
            <div className="logo-card">
              <ManagedLogo width={800} height={800} priority />
            </div>
          </div>
        </section>

        <section id="about" data-home-section="about" className="section">
          <div className="eyebrow">About the camp</div>
          <h2>A safe, supportive place to reconnect with life and with others.</h2>
          <div className="section-copy" data-managed-about-copy>
            {CAMP_ABOUT_COPY.split("\n\n").map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          </div>

          <div className="cards">
            <div className="card"><h3>Fall Season</h3><p>November 6, 2026 · Austin, Texas. Camp Rise Again's peer-support fall gathering will feature planned activities including skydiving, horseback riding, paddleboarding, fishing, relay races, games, and glow-in-the-dark capture the flag. Exact venue and arrival details will be shared privately with confirmed participants. Activities are subject to weather and safety considerations.</p></div>
            <div className="card"><h3>Spring Season</h3><p>Spring camp details, dates, location, and capacity will be added here.</p></div>
            <div className="card"><h3>Volunteer With Us</h3><p>Support food service, activities, transportation, camp mentoring, setup, and more.</p></div>
          </div>
        </section>

        <section id="mission" data-home-section="mission" className="section">
          <div className="eyebrow">Our mission</div>
          <h2>Why we rise again.</h2>
          <p className="section-copy" data-managed-mission>{CAMP_MISSION_STATEMENT}</p>
          <div className="mission-attribution" data-managed-mission-attribution>
            <span className="mission-attribution-name" data-managed-mission-author-name>Tierra Schofield</span>
            <span className="mission-attribution-title" data-managed-mission-author-title>Founder, Camp Rise Again</span>
          </div>
        </section>

        <MemorialSection variant="home" />

        <div data-home-section="team"><TeamSection /></div>

        <section id="keep-going" data-home-section="keep-going" className="section">
          <div className="eyebrow">Keep going</div>
          <h2>Your story isn’t over.</h2>
          <p className="section-copy">There is still hope.<br />You can rise again.</p>
        </section>

        <section id="donate" data-home-section="donate" className="section">
          <div className="eyebrow">Support the mission</div>
          <h2>Help make Camp Rise Again possible.</h2>
          <p className="section-copy">{CAMP_DONATE_COPY}</p>
          <div className="actions"><DonateButton /></div>
        </section>

        <section id="contact" data-home-section="contact" className="section">
          <div className="eyebrow">Contact</div>
          <h2>Questions before you apply?</h2>
          <p className="section-copy" data-managed-contact-copy>Send a question directly to our team using the secure contact form. You can also explore the camper and volunteer FAQs before applying.</p>
          <div className="actions"><Link className="btn btn-primary" href="/contact">Contact Us</Link><Link className="btn btn-secondary" href="/faq">Frequently Asked Questions</Link></div>
          <p className="section-copy"><strong>Camp Rise Again is not a crisis service.</strong> If you or someone else is in immediate danger, call 911. In the U.S., you can also call or text 988 for the Suicide & Crisis Lifeline.</p>
        </section>
      </main>
      <footer><div className="footer-inner"><strong>Camp Rise Again</strong><span>Camp Rise Again</span></div></footer>
    </>
  );
}
