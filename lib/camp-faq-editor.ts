export type FAQSection = "general" | "campers" | "volunteers";

export function validFAQ(question: string, answer: string) {
  const q=question.trim();
  const a=answer.trim();
  return q.length >= 5 && q.length <= 240 &&
    a.length >= 1 && a.length <= 3000;
}

export function orderedFAQs<T extends { sort_order:number; id:string }>(items: T[]): T[] {
  return [...items].sort((a,b)=>a.sort_order-b.sort_order || a.id.localeCompare(b.id));
}

export function moveFAQ<T extends { id:string }>(
  items: T[], id: string, direction: -1|1,
): T[] {
  const i=items.findIndex(item=>item.id===id);
  const next=i+direction;
  if(i<0 || next<0 || next>=items.length) return items;
  const reordered=[...items];
  [reordered[i],reordered[next]]=[reordered[next],reordered[i]];
  return reordered;
}
