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
              <div className="eyebrow">Camp Rise Again</div>
              <h1>You don’t have to walk through the darkness alone.</h1>
              <p className="lead">
                Camp Rise Again is an adult camp created for individuals who are currently struggling with depression and may be feeling isolated, overwhelmed, hopeless, or disconnected from life.
              </p>
              <div className="actions">
                <Link className="btn btn-primary" href="/apply">Apply to Attend</Link>
                <Link className="btn btn-secondary" href="/volunteer">Become a Volunteer</Link>
              </div>
            </div>
            <div className="logo-card">
              <Image src="/3426A745-DDB8-4CB7-8BBC-9DC68C16B20A.png" alt="Camp Rise Again mountain and river logo" width={800} height={800} priority />
            </div>
          </div>
        </section>

        <section id="about" className="section">
          <div className="eyebrow">About the camp</div>
          <h2>A safe, supportive place to reconnect with life and with others.</h2>
          <div className="section-copy">
            <p>
              Our goal is to provide a safe, supportive environment where participants can step away from the weight of everyday life, connect with people who understand, and experience moments of joy, laughter, connection, and hope.
            </p>
            <p>
              Through outdoor activities, recreation, group conversations, wellness experiences, and supportive community, Camp Rise Again creates space for people to breathe, be seen, and remember that their lives have value.
            </p>
            <p>
              This isn’t about pretending everything is okay. It’s about creating a space where you don’t have to pretend.
            </p>
            <p>
              Camp Rise Again is a community of people choosing to take another step forward—together.
            </p>
          </div>

          <div className="cards">
            <div className="card">
              <h3>Fall Season</h3>
              <p>Fall camp details, dates, location, and capacity will be added here.</p>
            </div>
            <div className="card">
              <h3>Spring Season</h3>
              <p>Spring camp details, dates, location, and capacity will be added here.</p>
            </div>
            <div className="card">
              <h3>Volunteer With Us</h3>
              <p>Support food service, activities, transportation, camp mentoring, setup, and more.</p>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="eyebrow">Keep going</div>
          <h2>Your story isn’t over.</h2>
          <p className="section-copy">
            There is still hope.<br />
            You can rise again.
          </p>
        </section>

        <section id="contact" className="section">
          <div className="eyebrow">Contact</div>
          <h2>Questions before you apply?</h2>
          <p className="section-copy">Camp contact name, phone number, email address, mailing address, and social links will be added here once provided.</p>
          <p className="section-copy"><strong>Camp Rise Again is not a crisis service.</strong> If you or someone else is in immediate danger, call 911. In the U.S., you can also call or text 988 for the Suicide & Crisis Lifeline.</p>
        </section>
      </main>
      <footer>
        <div className="footer-inner">
          <strong>Camp Rise Again</strong>
          <span>Camp contact information coming soon.</span>
        </div>
      </footer>
    </>
  );
}
