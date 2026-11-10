import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import FaqList from "@/components/FaqList";
import { getPublishedFaqs } from "@/lib/camp-faq";
export const metadata = { title: "Camper FAQs | Camp Rise Again" };
export const dynamic = "force-dynamic";
export default async function CamperFAQ() {
const faqs = await getPublishedFaqs("campers");
return <><SiteHeader/><main className="form-wrap">
<div className="eyebrow">For prospective campers</div><h1>Camper FAQs</h1>
<p className="section-copy">Find answers before you apply. For a specific question, send a message directly to the Camp Rise Again team.</p>
<FaqList items={faqs}/>
<div className="actions" style={{marginTop:22}}><Link className="btn btn-primary" href="/apply">Apply to Attend</Link><Link className="btn btn-secondary" href="/contact?topic=Camper%20application">Ask a Question</Link></div>
<p className="section-copy" style={{marginTop:18}}><Link href="/faq">All FAQs</Link> · <Link href="/resources">Support resources</Link></p>
<div className="notice">Camp Rise Again is not a crisis response service. Call 911 for immediate danger, or call or text 988 in the U.S. for crisis support.</div>
</main></>;
}