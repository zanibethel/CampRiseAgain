import Link from "next/link";
import HomeManagedPanel from "@/components/HomeManagedPanel";
import ManagedLogo from "@/components/ManagedLogo";

export default function SiteHeader() {
  return <><header><div className="nav"><Link className="brand" href="/"><ManagedLogo width={48} height={48} priority /><span>Camp Rise Again</span></Link><nav className="navlinks" aria-label="Primary navigation"><Link href="/#about">About</Link><Link className="resources-link" href="/resources">Resources</Link><Link href="/#contact">Contact</Link><Link className="btn btn-primary" href="/apply">Apply</Link><Link className="btn btn-secondary" href="/volunteer">Volunteer</Link></nav></div></header><HomeManagedPanel /></>;
}
