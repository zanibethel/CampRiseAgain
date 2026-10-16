import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import MemorialSection from "@/components/MemorialSection";

export const metadata: Metadata = {
  title: "Michael Alexander Garza's Legacy | Camp Rise Again",
  description: "Learn how Michael Alexander Garza's life and 19½ years of Air Force service inspired Tierra Schofield to establish Camp Rise Again.",
};

export default function MichaelGarzaPage() {
  return <><SiteHeader /><MemorialSection variant="page" /><footer><div className="footer-inner"><strong>Camp Rise Again</strong><span>You don't have to walk through the darkness alone.</span></div></footer></>;
}
