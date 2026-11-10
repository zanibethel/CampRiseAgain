import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
export const metadata = { title: "Volunteer FAQs | Camp Rise Again" };
export default function VolunteerFAQ() {
const questions = [
["How do I volunteer?", "Submit the online volunteer interest form. It will go directly to the team without requiring your email app to open."],
["What roles are available?", "You can express interest in food and beverages, mentoring support, activities, transportation, setup, and take down. Final assignments depend on camp needs."],
["Can I choose more than one area?", "Yes. Select all the volunteer areas that interest you on the form."],
["Do I need previous experience?", "The form invites you to share any relevant experience. Contact the team if you are unsure which roles may suit you."],
["When and where do volunteers report?", "The team will share confirmed dates, locations, and next steps with volunteers. Submitting the form does not confirm an assignment."],
["How will I hear back?", "Your submission generates an on-screen receipt and a confirmation email when delivery is available. A team member may follow up from volunteer@campriseagain.org."],
["Can I ask about accessibility or accommodations?", "Yes. Use the contact form to ask about volunteer roles and access needs."],
];
return <><SiteHeader/><main className="form-wrap">
<div className="eyebrow">For volunteers</div><h1>Volunteer FAQs</h1>
<p className="section-copy">Here is what to know before submitting your interest in helping Camp Rise Again.</p>
{questions.map(([q,a])=><details className="card" key={q} style={{ margin:"12px 0" }}><summary style={{fontWeight:700,cursor:"pointer"}}>{q}</summary><p style={{marginTop:12}}>{a}</p></details>)}
<div className="actions" style={{marginTop:22}}><Link className="btn btn-primary" href="/volunteer">Volunteer Form</Link><Link className="btn btn-secondary" href="/contact?topic=Volunteering">Ask a Question</Link></div>
<p className="section-copy" style={{marginTop:18}}><Link href="/faq">All FAQs</Link> · <Link href="/faq/campers">Camper FAQs</Link></p>
</main></>;
}