import Link from "next/link";
import type { PublicFaq } from "@/lib/camp-faq";

export default function FaqList({ items }: { items: PublicFaq[] | null }) {
  if (items === null) return (
    <div className="card">
      <p>FAQ answers are temporarily unavailable. You can still contact our team with questions.</p>
      <Link className="btn btn-secondary" href="/contact">Contact Us</Link>
    </div>
  );
  if (!items.length) return (
    <div className="card">
      <p>We're updating these questions. Please contact us if you need assistance.</p>
      <Link className="btn btn-secondary" href="/contact">Ask a Question</Link>
    </div>
  );
  return <div aria-label="Frequently asked questions">
    {items.map(({ id,question,answer }) => (
      <details className="card" key={id} style={{ margin:"12px 0" }}>
        <summary style={{ fontWeight:700,cursor:"pointer" }}>{question}</summary>
        <p style={{ marginTop:12,whiteSpace:"pre-wrap",lineHeight:1.65 }}>{answer}</p>
      </details>
    ))}
  </div>;
}
