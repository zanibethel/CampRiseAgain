import Image from "next/image";
import Link from "next/link";

export default function SiteHeader() {
  return <header><div className="nav"><Link className="brand" href="/"><Image src="/3426A745-DDB8-4CB7-8BBC-9DC68C16B20A.png" alt="Camp Rise Again" width={48} height={48} priority /><span>Camp Rise Again</span></Link><nav className="navlinks" aria-label="Primary navigation"><Link href="/#about">About</Link><Link href="/#contact">Contact</Link><Link className="btn btn-primary" href="/apply">Apply</Link><Link className="btn btn-secondary" href="/volunteer">Volunteer</Link></nav></div></header>;
}
