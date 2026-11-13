import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read=(path)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("newsletter physical address is editable and cannot be hard-coded as a server env variable",()=>{
  const api=read("app/api/admin/crm/route.ts");
  const panel=read("components/CampCRMAdmin.tsx");
  const env=read(".env.example");
  assert.ok(!api.includes("process.env.CAMP_MAILING_POSTAL_ADDRESS"));
  assert.ok(!env.includes("CAMP_MAILING_POSTAL_ADDRESS="));
  assert.match(panel,/Organization Mailing Details/);
  assert.match(panel,/Save Mailing Details/);
  assert.match(panel,/address_confirmed:mailingConfirmed/);
  assert.match(api,/list\.mailing_settings\?\.postal_address/);
  assert.match(api,/!list\.mailing_ready/);
});
test("mailing details are private service-role-only and begin/claim are gated",()=>{
  const migration=read("supabase/migrations/20261112213000_camp_crm_mailing.sql");
  const edge=read("supabase/functions/camp-email-bridge/index.ts");
  assert.match(migration,/create table if not exists public\.camp_rise_again_mailing_settings/);
  assert.match(migration,/enable row level security/);
  assert.match(migration,/camp_rise_again_mailing_settings from public, anon, authenticated/);
  assert.match(edge,/action === "admin_mailing_settings_update"/);
  assert.match(edge,/action === "admin_campaign_begin"/);
  assert.match(edge,/action === "admin_campaign_claim"/);
  assert.ok((edge.match(/!settings\?\.address_confirmed/g)||[]).length>=2);
});
