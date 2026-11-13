import test from "node:test";
import assert from "node:assert/strict";
import { ENGAGEMENT_COLUMNS, csvCell, buildEngagementCsv } from "../lib/camp-report-csv.ts";

test("escapes spreadsheet formulas and CSV delimiters",()=>{
  assert.equal(csvCell("=1+1"),`"'=1+1"`);
  assert.equal(csvCell("  +SUM(A1:A9)"),`"'  +SUM(A1:A9)"`);
  assert.equal(csvCell("a,b\n\"quote\""),`"a,b\n""quote"""`);
  assert.equal(csvCell("Normal"),`"Normal"`);
});

test("exports configured questions without full private application notes or birthdays",()=>{
  assert.ok(!ENGAGEMENT_COLUMNS.includes("date_of_birth"));
  const csv=buildEngagementCsv([{
    kind:"camper",email:"person@example.com",first_name:"Example",
    date_of_birth:"2000-01-01",address_1:"Private street",notes:"Do not export",
    extra_answers:{how_heard:"Friend or family",first_camp:true},
  }]);
  assert.ok(csv.includes("person@example.com"));
  assert.ok(csv.includes("answer:how_heard"));
  assert.ok(csv.includes("Friend or family"));
  assert.ok(csv.includes("true"));
  assert.ok(!csv.includes("Private street"));
  assert.ok(!csv.includes("Do not export"));
  assert.ok(!csv.includes("2000-01-01"));
});
