import Link from "next/link";
 import SiteHeader from "@/components/SiteHeader";
 import CampSubmissionForm from "@/components/CampSubmissionForm";
 export const metadata = { title: "Volunteer | Camp Rise Again" };
 export default function VolunteerPage() {
 return <><SiteHeader/><main className="form-wrap">
 <div className="eyebrow">Volunteer</div><h1>Help make camp happen</h1>
 <p className="section-copy">Tell us where you would like to help. Your interest form submits directly to Camp Rise Again, and a team member can follow up about opportunities.</p>
 <p className="section-copy">Questions about volunteering? Visit our <Link href="/faq/volunteers">Volunteer FAQs</Link> before submitting.</p>
 <CampSubmissionForm kind="volunteer"/>
 </main></>;
 }