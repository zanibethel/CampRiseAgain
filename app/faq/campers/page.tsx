import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
export const metadata = { title: "Camper FAQs | Camp Rise Again" };
export default function CamperFAQ() {
const questions = [
["Who is the camp for?", "Camp Rise Again is designed for adults who may be struggling with depression, isolation, or feeling disconnected. Contact us about any eligibility questions."],
["Does applying guarantee a spot?", "No. The team reviews applications and will contact applicants about next steps. Do not make travel arrangements based only on submitting an application."],
["How do I apply?", "Complete the online camper application. It submits directly to the team and sends you an email receipt with a reference number."],
["What information is needed?", "The application asks for your contact details, birthday, shirt size, season preference, and any information you choose to share for planning."],
["Are dates and locations final?", "Please use the website's published schedule and confirm details with the team. Exact arrival instructions are provided to confirmed participants."],
["Can I ask about accessibility or accommodations?", "Yes. Use the contact form to describe a question or access need so the team can discuss what may be possible. Avoid sending detailed medical records through email."],
["Is this therapy or clinical treatment?", "No. Camp Rise Again provides peer connection and supportive activities, not clinical care or emergency services."],
["What happens after I submit?", "You will see an on-screen reference number and receive an email confirmation when delivery is available. The team reviews your submission and may follow up."],
];
return <><SiteHeader/><main className="form-wrap">
<div className="eyebrow">For prospective campers</div><h1>Camper FAQs</h1>
<p className="section-copy">Find answers before you apply. For a specific question, send a message directly to the Camp Rise Again team.</p>
{questions.map(([q,a])=><details className="card" key={q} style={{ margin:"12px 0" }}><summary style={{fontWeight:700,cursor:"pointer"}}>{q}</summary><p style={{marginTop:12}}>{a}</p></details>)}
<div className="actions" style={{marginTop:22}}><Link className="btn btn-primary" href="/apply">Apply to Attend</Link><Link className="btn btn-secondary" href="/contact?topic=Camper%20application">Ask a Question</Link></div>
<p className="section-copy" style={{marginTop:18}}><Link href="/faq">All FAQs</Link> · <Link href="/resources">Support resources</Link></p>
<div className="notice">Camp Rise Again is not a crisis response service. Call 911 for immediate danger, or call or text 988 in the U.S. for crisis support.</div>
</main></>;
}