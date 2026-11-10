import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
export const metadata = { title: "FAQs | Camp Rise Again", description: "Answers to common questions and links to Camp Rise Again camper and volunteer forms." };
export default function FAQ() {
const questions = [
["What is Camp Rise Again?", "Camp Rise Again is a peer-support camp for adults seeking connection, encouragement, and shared experiences."],
["Is Camp Rise Again a treatment program?", "No. It is not therapy, medical treatment, or a crisis service and does not replace professional care."],
["How do I ask about dates, location or accessibility?", "Send a question through our contact form. Camp details, accessibility considerations, and confirmed arrival information are shared by the team."],
["How can I help?", "You can apply to volunteer, learn about supporting the mission, or get in touch through the contact form."],
["What if I need urgent mental-health support?", "Camp Rise Again does not monitor emergencies. If someone is in immediate danger, call 911. In the United States, call or text 988 for mental-health crisis support."]
];
return <><SiteHeader/><main>
<section className="section"><div className="eyebrow">Frequently asked questions</div><h1>How can we help?</h1>
<p className="section-copy">Find answers and go directly to the right form. If something is unclear, our team can help.</p>
<div className="cards">
<div className="card"><h2>Attending camp</h2><p>Eligibility, applications, and what happens after you apply.</p><Link className="btn btn-primary" href="/faq/campers">Camper FAQs</Link></div>
<div className="card"><h2>Volunteering</h2><p>Ways to help, submitting interest, and next steps.</p><Link className="btn btn-secondary" href="/faq/volunteers">Volunteer FAQs</Link></div>
</div></section>
<section className="section" style={{ paddingTop:0 }}><h2>General questions</h2>
<div className="cards" style={{ display:"block" }}>
{questions.map(([question,answer])=><details className="card" key={question} style={{ marginBottom:12 }}><summary style={{cursor:"pointer",fontWeight:700}}>{question}</summary><p style={{marginTop:12}}>{answer}</p></details>)}
</div><div className="actions"><Link className="btn btn-primary" href="/contact">Contact Us</Link><Link className="btn btn-secondary" href="/resources">Support Resources</Link></div>
</section></main></>;
}