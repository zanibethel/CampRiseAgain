import test from "node:test";
import assert from "node:assert/strict";
import { orderedCampFields, fieldsFollowing } from "../lib/camp-form-layout.ts";

test("inserts a question immediately after any fixed field", () => {
  const fields = [
    { field_key:"source", after_field:"email",sort_order:10 },
    { field_key:"contact", after_field:"source",sort_order:20 },
    { field_key:"time", after_field:"phone",sort_order:10 },
  ];
  const positions=orderedCampFields("volunteer",fields);
  assert.deepEqual(positions.slice(2,7).map(x=>x.field_key),["email","source","contact","phone","time"]);
  assert.deepEqual(fieldsFollowing(positions,"email").map(x=>x.field_key),["source","contact"]);
});

test("preserves placement among sibling custom questions", () => {
  const fields = [
    {field_key:"second",after_field:"roles",sort_order:20},
    {field_key:"first",after_field:"roles",sort_order:10},
  ];
  assert.deepEqual(fieldsFollowing(orderedCampFields("volunteer",fields),"roles").map(x=>x.field_key),
    ["first","second"]);
});

test("orphan or cyclic questions remain in the editor rather than disappearing", () => {
  const fields=[
    {field_key:"orphan",after_field:"missing",sort_order:3},
    {field_key:"cycle_a",after_field:"cycle_b",sort_order:4},
    {field_key:"cycle_b",after_field:"cycle_a",sort_order:5},
  ];
  const positions=orderedCampFields("camper",fields);
  assert.deepEqual(positions.filter(x=>x.type==="custom").map(x=>x.field_key).sort(),
    ["cycle_a","cycle_b","orphan"]);
  assert.equal(positions.length,13+3);
});

test("does not mutate the original question ordering", () => {
  const fields=[
    {field_key:"b",after_field:"notes",sort_order:50},
    {field_key:"a",after_field:"notes",sort_order:10},
  ];
  orderedCampFields("camper",fields);
  assert.deepEqual(fields.map(x=>x.field_key),["b","a"]);
});
