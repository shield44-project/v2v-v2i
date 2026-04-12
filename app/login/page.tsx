"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import LegacyFirebaseScripts from "../components/LegacyFirebaseScripts";

const SUPER_ADMIN_EMAIL = "vishal797577@gmail.com";

function formatAuthError(err) {
  const code = err?.code || "";
  const host = typeof window !== "undefined" ? window.location.hostname : "this-host";
  if (code === "auth/unauthorized-domain") {
    return (
      "Google sign-in blocked for domain '" +
      host +
      "'. Add this host in Firebase Console -> Authentication -> Settings -> Authorized domains, then reload."
    );
  }
  return err?.message || "Google sign-in failed";
}

export default function LoginPage() {
  const router = useRouter();
  const [scriptsReady, setScriptsReady] = useState(false);
  const [mode, setMode] = useState("admin");
  const [guestName, setGuestName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPass, setAdminPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [alreadyIn, setAlreadyIn] = useState(null);
  const [hostLabel, setHostLabel] = useState("");

  const canUseFirebase = useMemo(() => {
    if (!scriptsReady || typeof window === "undefined") return false;
    return !!(window.auth && window.firebase && window.getSession && window.setSession);
  }, [scriptsReady]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setHostLabel(window.location.hostname || "localhost");
    }
  }, []);

  useEffect(() => {
    if (!canUseFirebase) return;
    const s = window.getSession();
    if (s?.user) {
      setAlreadyIn(s);
      return;
    }

    const unsub = window.auth.onAuthStateChanged((user) => {
      if (!user) return;
      completeGoogleSignIn(user, false);
    });

    return () => unsub?.();
  }, [canUseFirebase]);

  const redirectForSession = (s) => {
    if (!s) return;
    if (s.isAdmin) {
      router.push("/control");
      return;
    }
    if (s.role === "ev") router.push("/emergency");
    else if (s.role === "signal") router.push("/signal");
    else if (s.role === "vehicle1") router.push("/vehicle1");
    else if (s.role === "vehicle2") router.push("/vehicle2");
    else router.push("/user-portal");
  };

  const completeGoogleSignIn = async (user, redirectNow) => {
    const name = user.displayName || user.email?.split("@")[0] || "User";
    const isSuperAdmin = user.email === SUPER_ADMIN_EMAIL;

    window.registerUser?.(user).catch(() => {});
    if (isSuperAdmin) window.seedSuperAdmin?.(user);

    let isAdmin = isSuperAdmin;
    if (!isAdmin && window.checkIsAdmin) {
      isAdmin = await window.checkIsAdmin(user.uid);
    }

    if (!isAdmin && window.checkAndApplyPendingInvite) {
      const promoted = await window.checkAndApplyPendingInvite(user);
      if (promoted) isAdmin = true;
    }

    window.setSession({
      user: name,
      email: user.email || "",
      photo: user.photoURL || "",
      uid: user.uid || "",
      isAdmin,
      role: isAdmin ? "admin" : window.getSession()?.role || ""
    });

    const session = window.getSession();
    setAlreadyIn(session);
    setMessage(isAdmin ? "Signed in as admin" : "Signed in with Google");

    if (redirectNow) {
      setTimeout(() => redirectForSession(session), 350);
    }
  };

  const signInGoogle = async () => {
    if (!canUseFirebase) return;
    setBusy(true);
    setMessage("");
    try {
      const provider = new (window as any).firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const result = await window.auth.signInWithPopup(provider);
      if (result?.user) await completeGoogleSignIn(result.user, true);
    } catch (err) {
      setMessage(formatAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const loginAdmin = async (e) => {
    e.preventDefault();
    if (!canUseFirebase) return;

    setBusy(true);
    setMessage("");

    try {
      if (adminEmail.trim() === "admin" && adminPass === "V2X@2024") {
        window.setSession({
          user: "Admin",
          email: "demo-admin@local",
          isAdmin: true,
          role: "admin"
        });
        router.push("/control");
        return;
      }

      const cred = await window.auth.signInWithEmailAndPassword(adminEmail.trim(), adminPass);
      const user = cred?.user;
      const isAdmin = await window.checkIsAdmin?.(user?.uid);

      if (!isAdmin) {
        await window.auth.signOut().catch(() => {});
        setMessage("Account signed in, but admin access is not granted.");
        return;
      }

      window.setSession({
        user: user.displayName || user.email?.split("@")[0] || "Admin",
        email: user.email || "",
        uid: user.uid || "",
        photo: user.photoURL || "",
        isAdmin: true,
        role: "admin"
      });
      router.push("/control");
    } catch (err) {
      setMessage(err?.message || "Admin login failed");
    } finally {
      setBusy(false);
    }
  };

  const continueGuest = (e) => {
    e.preventDefault();
    if (!guestName.trim()) {
      setMessage("Enter a name for guest mode.");
      return;
    }

    if (typeof window !== "undefined" && window.setSession) {
      window.setSession({ user: guestName.trim(), isAdmin: false, role: "" });
    } else {
      sessionStorage.setItem("v2x_user", guestName.trim());
      sessionStorage.setItem("v2x_is_admin", "false");
      sessionStorage.setItem("v2x_role", "");
    }

    router.push("/user-portal");
  };

  const signOut = async () => {
    if (typeof window !== "undefined") {
      window.clearSession?.();
      await window.auth?.signOut?.().catch(() => {});
    }
    setAlreadyIn(null);
    setMessage("Signed out");
  };

  return (
    <main className="page">
      <LegacyFirebaseScripts onReady={() => setScriptsReady(true)} />
      <div className="card" style={{ maxWidth: 640 }}>
        <h1>V2X Login</h1>
        <p>Native Next.js login page using your existing Firebase and session model.</p>
        {hostLabel && (
          <p style={{ marginTop: 8 }}>
            <strong>Current Host:</strong> {hostLabel}
          </p>
        )}

        {!scriptsReady && <p>Loading Firebase scripts and auth bridge...</p>}

        {alreadyIn && (
          <div className="legacy-header" style={{ marginTop: 16 }}>
            <div>
              <strong>Already signed in:</strong> {alreadyIn.user}
              <p style={{ margin: "6px 0 0" }}>{alreadyIn.isAdmin ? "Admin session" : "User session"}</p>
            </div>
            <div className="legacy-actions">
              <button type="button" onClick={() => redirectForSession(alreadyIn)}>Continue</button>
              <button type="button" onClick={signOut}>Sign Out</button>
            </div>
          </div>
        )}

        <div style={{ marginTop: 16 }} className="legacy-actions">
          <button type="button" onClick={signInGoogle} disabled={!canUseFirebase || busy}>
            {busy ? "Signing in..." : "Continue with Google"}
          </button>
        </div>

        <div style={{ marginTop: 16 }} className="legacy-actions">
          <button type="button" onClick={() => setMode("admin")} aria-pressed={mode === "admin"}>Admin</button>
          <button type="button" onClick={() => setMode("guest")} aria-pressed={mode === "guest"}>Guest</button>
        </div>

        {mode === "admin" ? (
          <form onSubmit={loginAdmin} style={{ marginTop: 16, display: "grid", gap: 10 }}>
            <input
              className="form-inp"
              placeholder="Admin email or demo username 'admin'"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
            />
            <input
              className="form-inp"
              type="password"
              placeholder="Password"
              value={adminPass}
              onChange={(e) => setAdminPass(e.target.value)}
            />
            <button className="submit-btn submit-admin" type="submit" disabled={busy || !scriptsReady}>
              {busy ? "Checking..." : "Access Control Center"}
            </button>
          </form>
        ) : (
          <form onSubmit={continueGuest} style={{ marginTop: 16, display: "grid", gap: 10 }}>
            <input
              className="form-inp"
              placeholder="Your name or call sign"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
            />
            <button className="submit-btn submit-user" type="submit">Continue to Role Selection</button>
          </form>
        )}

        {message && <p style={{ marginTop: 14 }}><strong>Status:</strong> {message}</p>}
      </div>
    </main>
  );
}
