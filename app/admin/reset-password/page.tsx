"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

const ADMINS = new Set(["schofieldtierra@gmail.com", "zanibethel@gmail.com"]);

export default function CreateAdminPassword() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [checking, setChecking] = useState(true);
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!supabase) {
      setChecking(false);
      setStatus("Authentication is temporarily unavailable.");
      return;
    }

    let active = true;
    const timeout = window.setTimeout(() => {
      if (!active) return;
      setChecking(false);
      setStatus("We could not verify the recovery link. Please request a new password reset email.");
    }, 15000);

    // Supabase-js automatically processes the recovery token returned by
    // Supabase Auth before getUser resolves. Avoid async auth-change callbacks.
    async function checkRecoverySession() {
      try {
        const params = new URLSearchParams(window.location.search);
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        if (params.get("error") || hash.get("error")) {
          if (active) setStatus("This recovery link has expired or was already used. Please request a new one.");
          return;
        }

        const { data, error } = await supabase.auth.getUser();
        if (!active) return;
        const email = data.user?.email?.toLowerCase() || "";
        if (error || !email) {
          setStatus("Open your latest password reset email link to create a password. If it expired, request another link.");
          return;
        }
        if (!ADMINS.has(email)) {
          setStatus("This account is not authorized to manage Camp Rise Again.");
          return;
        }
        setVerifiedEmail(email);
        setStatus("");
      } catch {
        if (active) setStatus("Could not verify the link. Please request another password reset email.");
      } finally {
        if (!active) return;
        window.clearTimeout(timeout);
        setChecking(false);
      }
    }

    void checkRecoverySession();
    return () => { active = false; window.clearTimeout(timeout); };
  }, [supabase]);

  async function saveNewPassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase || !verifiedEmail || saving) return;

    if (password.length < 12) {
      setStatus("Use at least 12 characters for your new password.");
      return;
    }
    if (password !== confirmation) {
      setStatus("The passwords do not match.");
      return;
    }

    setSaving(true);
    setStatus("");
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || userData.user?.email?.toLowerCase() !== verifiedEmail || !ADMINS.has(verifiedEmail)) {
        setStatus("Your recovery session is no longer valid. Request a new password reset link.");
        return;
      }

      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setStatus("Could not save your password. Try a different strong password, or request a new recovery link.");
        return;
      }

      setPassword("");
      setConfirmation("");
      // End the temporary recovery session. The next visit uses the new
      // password or an email sign-in link, with no password ever exposed in URL.
      await supabase.auth.signOut({ scope: "local" });
      setCompleted(true);
      setStatus("Your new password has been saved. You can now sign in to Camp Rise Again Admin.");
    } catch {
      setStatus("Could not complete the password change. Try requesting a new link.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <SiteHeader />
      <main className="form-wrap admin-recovery-page">
        <div className="eyebrow">Secure administration</div>
        <h1>Create New Password</h1>
        <p className="section-copy">Set a password for Camp Rise Again Admin. Email sign-in links will remain available.</p>

        <div className="form-card admin-login-card">
          {checking ? (
            <p className="section-copy" role="status">Verifying your secure link…</p>
          ) : completed ? (
            <div>
              <h2>Password Saved</h2>
              <p className="status" role="status">{status}</p>
              <a className="btn btn-primary" href="/admin">Continue to Admin Sign In →</a>
            </div>
          ) : verifiedEmail ? (
            <form onSubmit={saveNewPassword}>
              <h2>Choose a New Password</h2>
              <p className="section-copy">Creating a password for <strong>{verifiedEmail}</strong>.</p>
              <div className="field">
                <label htmlFor="new-admin-password">New password</label>
                <input id="new-admin-password" type={showPasswords ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={12} required disabled={saving} />
                <small>At least 12 characters. A unique password or passphrase is recommended.</small>
              </div>
              <div className="field">
                <label htmlFor="confirm-admin-password">Confirm new password</label>
                <input id="confirm-admin-password" type={showPasswords ? "text" : "password"} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" minLength={12} required disabled={saving} />
              </div>
              <label className="admin-recovery-show">
                <input type="checkbox" checked={showPasswords} onChange={event => setShowPasswords(event.target.checked)} disabled={saving} />
                Show passwords
              </label>
              <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? "Saving…" : "Save New Password"}</button>
              {status && <p className="status" role="alert">{status}</p>}
            </form>
          ) : (
            <div>
              <h2>Recovery Link Needed</h2>
              <p className="status" role="alert">{status || "The recovery link could not be verified."}</p>
              <a className="btn btn-primary" href="/admin">Return to Admin Sign In</a>
              <p className="section-copy admin-login-hint">Use <strong>Forgot password? / Create one</strong> on the sign-in page to request a fresh email.</p>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
