import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
 import CampSubmissionForm from "@/components/CampSubmissionForm";
 export const metadata = { title: "Camper Application | Camp Rise Again" };
 export default function ApplyPage() {
 return <><SiteHeader/><main className="form-wrap">
 <div className="eyebrow">Camper intake</div><h1>Apply to attend</h1>
 <p className="section-copy">Camp Rise Again welcomes adults seeking community, encouragement, and shared experiences. Fill in this form to submit your interest directly—no email app required.</p>
 <p className="section-copy"><strong>Before you apply:</strong> This is a peer-support camp, not clinical treatment or crisis care. Submitting a form does not guarantee a place. <Link href="/faq/campers">Camper frequently asked questions</Link>.</p>
 <CampSubmissionForm kind="camper"/>
 </main></>;
 }