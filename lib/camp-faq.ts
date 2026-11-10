import { campBridge } from "@/lib/camp-supabase-bridge";

export type FaqSection = "general" | "campers" | "volunteers";
export type PublicFaq = { id: string; question: string; answer: string };

export async function getPublishedFaqs(section: FaqSection): Promise<PublicFaq[] | null> {
  try {
    const { faqs } = await campBridge<{ faqs: PublicFaq[] }>("get_public_faqs", { section });
    return faqs;
  } catch (error) {
    console.error("[camp-faq] FAQ lookup failed", error instanceof Error ? error.name : "unknown");
    return null;
  }
}
