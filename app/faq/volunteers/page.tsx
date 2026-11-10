import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import FaqList from "@/components/FaqList";
import { getPublishedFaqs } from "@/lib/camp-faq";
export const metadata = { title: "Volunteer FAQs | Camp Rise Again" };
export const dynamic = "force-dynamic";
export default async function VolunteerFAQ() {
const faqs = await getPublishedFaqs("volunteers");
return <><SiteHeader/><main className="form-wrap">
<div className="eyebrow">For volunteers</div><h1>Volunteer FAQs</h1>
<p className="section-copy">Here is what to know before submitting your interest in helping Camp Rise Again.</p>
<FaqList items={faqs}/>
<div className="actions" style={{marginTop:22}}><Link className="btn btn-primary" href="/volunteer">Volunteer Form</Link><Link className="btn btn-secondary" href="/contact?topic=Volunteering">Ask a Question</Link></div>
<p className="section-copy" style={{marginTop:18}}><Link href="/faq">All FAQs</Link> · <Link href="/faq/campers">Camper FAQs</Link></p>
</main></>;
}