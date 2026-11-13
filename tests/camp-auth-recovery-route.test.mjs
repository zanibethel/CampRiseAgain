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

function loadRoute({allowed=true,badLink=false,sendFailure=false}={}) {
  const sent=[];const generated=[];const claims=[];let made=0;
  const db={
    rpc:async (_name,params)=>{claims.push(params);return {data:allowed,error:null};},
    auth:{admin:{generateLink:async options=>{
      generated.push(options);
      return {data:{properties:{action_link:badLink?"https://evil.example/reset":goodLink}},error:null};
    }}},
  };
  const dependencies={
    "@supabase/supabase-js":{createClient:()=>{made++;return db;}},
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
  return {post:mod.exports.POST,sent,generated,claims,get made(){return made;}};
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
  SUPABASE_URL:"https://yufptpfiwdbzzrvhkvux.supabase.co",
  SUPABASE_SECRET_KEY:"test-supabase-service-key",
  CAMP_RESEND_API_KEY:"resend-test-key",
};
const original=Object.fromEntries(Object.keys(env).map(k=>[k,process.env[k]]));
for(const [k,v] of Object.entries(env))process.env[k]=v;
test.after(()=>{for(const [k,v] of Object.entries(original)){
  if(v===undefined)delete process.env[k];else process.env[k]=v;
}});

test("authorized request sends only to the intended admin and never returns recovery token",async()=>{
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
  assert.equal(r.generated[0].type,"recovery");
  assert.equal(r.generated[0].options.redirectTo,"https://campriseagain.org/admin/reset-password");
  assert.equal(r.claims.length,2);
  assert.ok(r.claims.every(x=>/^[0-9a-f]{64}$/.test(x.p_fingerprint)));
});

test("foreign origin cannot request a recovery link",async()=>{
  const r=loadRoute();
  const response=await r.post(request("zanibethel@gmail.com","https://malicious.example"));
  assert.equal(response.status,403);
  assert.equal(r.made,0);
  assert.equal(r.sent.length,0);
});

test("unknown emails never generate or send links",async()=>{
  const r=loadRoute();
  const response=await r.post(request("stranger@example.com"));
  assert.equal(response.status,200);
  assert.equal(r.made,0);
  assert.equal(r.sent.length,0);
});

test("exceeded rate limit denies link generation",async()=>{
  const r=loadRoute({allowed:false});
  const response=await r.post(request());
  assert.equal(response.status,429);
  assert.equal(r.generated.length,0);
  assert.equal(r.sent.length,0);
});

test("refuses requests on preview deployments",async()=>{
  const r=loadRoute();
  process.env.VERCEL_ENV="preview";
  try{
    const response=await r.post(request());
    assert.equal(response.status,503);
    assert.equal(r.made,0);
  }finally{process.env.VERCEL_ENV="production";}
});

test("does not send a Supabase link pointing to another host",async()=>{
  const r=loadRoute({badLink:true});
  const response=await r.post(request());
  assert.equal(response.status,503);
  assert.equal(r.sent.length,0);
});
