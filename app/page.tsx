import Image from "next/image";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="hero">
          <div className="hero-inner">
            <div>
              <div className="eyebrow">Applications are opening</div>
              <h1>Rise. Reconnect. Begin again.</h1>
              <p className="lead">Camp Rise Again is preparing upcoming fall and spring camp seasons. Apply to attend, or volunteer your time and skills to help make camp possible.</p>
              <div className="actions"><Link className="btn btn-primary" href="/apply">Apply to Attend</Link><Link className="btn btn-secondary" href="/volunteer">Become a Volunteer</Link></div>
            </div>
            <div className="logo-card"><Image src="/camp-rise-again-logo.jpeg" alt="Camp Rise Again mountain and river logo" width={800} height={800} priority /></div>
          </div>
        </section>
        <section id="about" className="section"><div className="eyebrow">About the camp</div><h2>A place built around renewal and community.</h2><p className="section-copy">About Camp Rise Again content will go here. This area is ready for the camp mission, who the program serves, what participants can expect, eligibility details, and the story behind the organization.</p><div className="cards"><div className="card"><h3>Fall Season</h3><p>Fall camp details, dates, location, and capacity will be added here.</p></div><div className="card"><h3>Spring Season</h3><p>Spring camp details, dates, location, and capacity will be added here.</p></div><div className="card"><h3>Volunteer With Us</h3><p>Support food service, activities, transportation, camp mentoring, setup, and more.</p></div></div></section>
        <section id="contact" className="section"><div className="eyebrow">Contact</div><h2>Questions before you apply?</h2><p className="section-copy">Camp contact name, phone number, email address, mailing address, and social links will be added here once provided.</p></section>
      </main>
      <footer><div className="footer-inner"><strong>Camp Rise Again</strong><span>Camp contact information coming soon.</span></div></footer>
    </>
  );
}
