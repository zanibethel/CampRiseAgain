import test from "node:test";
import assert from "node:assert/strict";
import { ENGAGEMENT_COLUMNS, csvCell, buildEngagementCsv, CONTACT_COLUMNS, buildContactsCsv } from "../lib/camp-report-csv.ts";

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

test("contact CSV includes camper and volunteer tags plus private notes",()=>{
  assert.ok(CONTACT_COLUMNS.includes("notes"));
  assert.ok(CONTACT_COLUMNS.includes("tags"));
  const csv=buildContactsCsv([{
    display_name:"Tierra Example",email:"tierra@example.org",
    phone:"555-0101",stage:"follow_up",tags:["camper","volunteer"],
    notes:"Messaged through Instagram, follow up Tuesday",
    source_kinds:["manual"],
  }]);
  assert.ok(csv.includes('"tags","notes"'));
  assert.ok(csv.includes('[""camper"",""volunteer""]'));
  assert.ok(csv.includes("Messaged through Instagram, follow up Tuesday"));
  assert.ok(!csv.includes("date_of_birth"));
});
test("engagement CSV exports joined CRM role tags and notes, not intake notes",()=>{
  const csv=buildEngagementCsv([{
    kind:"volunteer",email:"volunteer@example.org",
    contact_tags:["volunteer"],contact_notes:"Reached out by email",
    notes:"A private field on the original intake form",
  }]);
  assert.ok(ENGAGEMENT_COLUMNS.includes("contact_tags"));
  assert.ok(ENGAGEMENT_COLUMNS.includes("contact_notes"));
  assert.ok(csv.includes("Reached out by email"));
  assert.ok(csv.includes("volunteer"));
  assert.ok(!csv.includes("A private field on the original intake form"));
});
test("private notes are protected from CSV formula injection in all exports",()=>{
  assert.ok(buildContactsCsv([{notes:"=HYPERLINK(\"https://example.org\")"}]).includes("'=HYPERLINK"));
  assert.ok(buildEngagementCsv([{contact_notes:"+cmd"}]).includes("'+cmd"));
});
