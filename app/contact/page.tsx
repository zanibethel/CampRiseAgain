import Link from "next/link";
 import SiteHeader from "@/components/SiteHeader";
 import CampSubmissionForm from "@/components/CampSubmissionForm";
 export const metadata = { title: "Contact Us | Camp Rise Again" };
 export default function ContactPage() {
 return <><SiteHeader/><main className="form-wrap">
 <div className="eyebrow">Contact us</div><h1>Have a question?</h1>
 <p className="section-copy">Send your message directly to the Camp Rise Again team. We will email a confirmation and review your inquiry.</p>
 <p className="section-copy">You may find an answer in our <Link href="/faq">Frequently Asked Questions</Link>, <Link href="/faq/campers">Camper FAQs</Link>, or <Link href="/faq/volunteers">Volunteer FAQs</Link>.</p>
 <CampSubmissionForm kind="contact"/>
 </main></>;
 }