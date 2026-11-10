import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import PastCampsGallery from "@/components/PastCampsGallery";
import { getPublicCampGallery } from "@/lib/camp-gallery";

export const dynamic = "force-dynamic";
export const metadata = {
  title:"Past Camps | Camp Rise Again",
  description:"Approved photos and videos from past Camp Rise Again gatherings.",
};

export default async function PastCamps() {
  const gallery=await getPublicCampGallery();
  return <><SiteHeader/><main className="section">
    <div className="eyebrow">Shared experiences</div>
    <h1>Past Camps</h1>
    <p className="section-copy">
      A look back at the memories, connections, and moments that make Camp Rise Again special.
      Only photos and videos approved for public sharing appear here.
    </p>
    {gallery===null ? <div className="card">
      <h2>Gallery unavailable</h2>
      <p>Our gallery is temporarily unavailable. Please check back shortly.</p>
    </div> : <PastCampsGallery gallery={gallery}/>}
    <div className="actions" style={{marginTop:35}}>
      <Link className="btn btn-primary" href="/apply">Apply to Attend</Link>
      <Link className="btn btn-secondary" href="/volunteer">Volunteer With Us</Link>
    </div>
  </main></>;
}
