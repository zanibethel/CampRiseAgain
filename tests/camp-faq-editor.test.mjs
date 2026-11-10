import test from "node:test";
import assert from "node:assert/strict";
import { validFAQ, orderedFAQs, moveFAQ } from "../lib/camp-faq-editor.ts";

test("rejects blank and oversized FAQ content", () => {
  assert.equal(validFAQ("Who can attend?", "Adults seeking peer support."), true);
  assert.equal(validFAQ("Why?", "Helpful answer"), false);
  assert.equal(validFAQ("Who can attend?", ""), false);
  assert.equal(validFAQ("Q".repeat(241), "Answer"), false);
  assert.equal(validFAQ("Who can attend?", "A".repeat(3001)), false);
  assert.equal(validFAQ("  Questions?  ", "  Answers  "), true);
});

test("sorts without changing the input and moves cards in only the requested direction", () => {
  const items=[
    {id:"b",sort_order:30},{id:"a",sort_order:10},{id:"c",sort_order:20}
  ];
  const sorted=orderedFAQs(items);
  assert.deepEqual(sorted.map(x=>x.id), ["a","c","b"]);
  assert.deepEqual(items.map(x=>x.id), ["b","a","c"]);
  assert.deepEqual(moveFAQ(sorted,"c",-1).map(x=>x.id), ["c","a","b"]);
  assert.deepEqual(moveFAQ(sorted,"c",1).map(x=>x.id), ["a","b","c"]);
  assert.strictEqual(moveFAQ(sorted,"a",-1),sorted);
  assert.strictEqual(moveFAQ(sorted,"does-not-exist",1),sorted);
});
