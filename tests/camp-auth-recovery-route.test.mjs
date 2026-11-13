import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import * as helper from "../lib/camp-auth-email.ts";

const require=createRequire(import.meta.url);
const source=readFileSync(new URL("../app/api/admin/request-password-reset/route.ts",import.meta.url),"utf8");
const compiled=ts.transpileModule(source,{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,
}}).outputText;
const goodLink="https://yufptpfiwdbzzrvhkvux.supabase.co/auth/v1/verify?"+
  "token=one-time-opaque-token&type=recovery&redirect_to="+
  encodeURIComponent("https://campriseagain.org/admin/reset-password");

function loadRoute({rateLimited=false,badLink=false,sendFailure=false,bridgeUnavailable=false}={}) {
  const sent=[];const bridges=[];
  class MockCampBridgeError extends Error {
    constructor(message,status){super(message);this.status=status;}
  }
  const dependencies={
    "@/lib/camp-supabase-bridge":{
      CampBridgeError:MockCampBridgeError,
      campBridge:async (action,params)=>{
        bridges.push({action,params});
        if(rateLimited)throw new MockCampBridgeError("Too many requests",429);
        if(bridgeUnavailable)throw new MockCampBridgeError("Bridge unavailable",503);
        return {actionLink:badLink?"https://evil.example/reset":goodLink};
      },
    },
    "resend":{Resend:class Resend {
      constructor(key){assert.equal(key,"resend-test-key");this.emails={send:async data=>{
        sent.push(data);return {error:sendFailure?{name:"TestProviderFailure"}:null};
      }};}
    }},
    "@/lib/camp-auth-email":helper,
  };
  const mod={exports:{}};
  const mockRequire=name=>dependencies[name]??require(name);
  new Function("require","module","exports",compiled)(mockRequire,mod,mod.exports);
  return {post:mod.exports.POST,sent,bridges};
}

function request(email="zanibethel@gmail.com",origin="https://campriseagain.org") {
  return new Request("https://campriseagain.org/api/admin/request-password-reset",{
    method:"POST",headers:{"origin":origin,"content-type":"application/json",
      "x-vercel-forwarded-for":"203.0.113.2"},
    body:JSON.stringify({email}),
  });
}
const env={
  VERCEL_ENV:"production",
  CAMP_SUPABASE_BRIDGE_TOKEN:"test-bridge-token",
  CAMP_RESEND_API_KEY:"resend-test-key",
};
const original=Object.fromEntries(Object.keys(env).map(k=>[k,process.env[k]]));
for(const [k,v] of Object.entries(env))process.env[k]=v;
test.after(()=>{for(const [k,v] of Object.entries(original)){
  if(v===undefined)delete process.env[k];else process.env[k]=v;
}});

test("authorized request uses the private Edge bridge, delivers branding, and never leaks recovery token",async()=>{
  const r=loadRoute();
  const response=await r.post(request());const body=await response.json();
  assert.equal(response.status,200);
  assert.equal(body.ok,true);
  assert.equal(r.sent.length,1);
  assert.deepEqual(r.sent[0].to,["zanibethel@gmail.com"]);
  assert.equal(r.sent[0].from,"Camp Rise Again Support <support@campriseagain.org>");
  assert.ok(r.sent[0].text.includes("This inbox is not monitored"));
  assert.ok(r.sent[0].text.includes(goodLink));
  assert.ok(!JSON.stringify(body).includes("token"));
  assert.equal(r.bridges.length,1);
  assert.equal(r.bridges[0].action,"generate_camp_recovery_link");
  assert.equal(r.bridges[0].params.email,"zanibethel@gmail.com");
  assert.match(r.bridges[0].params.ipFingerprint,/^[0-9a-f]{64}$/);
  assert.match(r.bridges[0].params.emailFingerprint,/^[0-9a-f]{64}$/);
  assert.notEqual(r.bridges[0].params.ipFingerprint,r.bridges[0].params.emailFingerprint);
});

test("foreign origin cannot request a recovery link",async()=>{
  const r=loadRoute();
  const response=await r.post(request("zanibethel@gmail.com","https://malicious.example"));
  assert.equal(response.status,403);
  assert.equal(r.bridges.length,0);
});

test("unknown emails never request a recovery link",async()=>{
  const r=loadRoute();
  const response=await r.post(request("stranger@example.com"));
  assert.equal(response.status,200);
  assert.equal(r.bridges.length,0);
  assert.equal(r.sent.length,0);
});

test("Edge rate limit prevents delivery and returns 429",async()=>{
  const r=loadRoute({rateLimited:true});
  const response=await r.post(request());
  assert.equal(response.status,429);
  assert.equal(r.bridges.length,1);
  assert.equal(r.sent.length,0);
});

test("Edge failure does not fall back to unsafe service-key logic",async()=>{
  const r=loadRoute({bridgeUnavailable:true});
  const response=await r.post(request());
  assert.equal(response.status,503);
  assert.equal(r.sent.length,0);
});

test("refuses requests on preview deployments",async()=>{
  const r=loadRoute();
  process.env.VERCEL_ENV="preview";
  try{
    const response=await r.post(request());
    assert.equal(response.status,503);
    assert.equal(r.bridges.length,0);
  }finally{process.env.VERCEL_ENV="production";}
});

test("does not send a Supabase link pointing to another host",async()=>{
  const r=loadRoute({badLink:true});
  const response=await r.post(request());
  assert.equal(response.status,503);
  assert.equal(r.sent.length,0);
});

test("does not claim success if Resend rejects delivery",async()=>{
  const r=loadRoute({sendFailure:true});
  const response=await r.post(request());
  assert.equal(response.status,503);
  assert.equal(r.sent.length,1);
});

test("the private Edge action requires exact Camp admin, SHA fingerprints, and atomic limits",()=>{
  const bridge=readFileSync(new URL("../supabase/functions/camp-email-bridge/index.ts",import.meta.url),"utf8");
  const section=bridge.split('if (action === "generate_camp_recovery_link")')[1]?.split('if (action === "ping")')[0];
  assert.ok(section);
  assert.match(section,/ADMIN_EMAILS\.has\(recipient\)/);
  assert.match(section,/SHA256\.test\(ipFingerprint\)/);
  assert.match(section,/SHA256\.test\(emailFingerprint\)/);
  assert.match(section,/camp_rise_again_claim_form_rate/g);
  assert.match(section,/auth\.admin\.generateLink/);
  assert.match(section,/redirectTo: "https:\/\/campriseagain\.org\/admin\/reset-password"/);
  assert.ok(bridge.indexOf("if (!(await authorized(request)))")<
    bridge.indexOf('if (action === "generate_camp_recovery_link")'));
});
