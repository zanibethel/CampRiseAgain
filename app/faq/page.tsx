import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import FaqList from "@/components/FaqList";
import { getPublishedFaqs } from "@/lib/camp-faq";
export const metadata = { title: "FAQs | Camp Rise Again", description: "Answers to common questions and links to Camp Rise Again camper and volunteer forms." };
export const dynamic = "force-dynamic";
export default async function FAQ() {
const faqs = await getPublishedFaqs("general");
return <><SiteHeader/><main>
<section className="section"><div className="eyebrow">Frequently asked questions</div><h1>How can we help?</h1>
<p className="section-copy">Find answers and go directly to the right form. If something is unclear, our team can help.</p>
<div className="cards">
<div className="card"><h2>Attending camp</h2><p>Eligibility, applications, and what happens after you apply.</p><Link className="btn btn-primary" href="/faq/campers">Camper FAQs</Link></div>
<div className="card"><h2>Volunteering</h2><p>Ways to help, submitting interest, and next steps.</p><Link className="btn btn-secondary" href="/faq/volunteers">Volunteer FAQs</Link></div>
</div></section>
<section className="section" style={{ paddingTop:0 }}><h2>General questions</h2>
<div className="cards" style={{ display:"block" }}>
<FaqList items={faqs}/>
</div><div className="actions"><Link className="btn btn-primary" href="/contact">Contact Us</Link><Link className="btn btn-secondary" href="/resources">Support Resources</Link></div>
</section></main></>;
}