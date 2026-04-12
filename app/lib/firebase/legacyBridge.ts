import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/database";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDrjgoE9ygZ7LDU3A4i8jamjHTLHnzc-n4",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "v2v-v2i-project.firebaseapp.com",
  databaseURL:
    process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ||
    "https://v2v-v2i-project-default-rtdb.firebaseio.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "v2v-v2i-project",
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "v2v-v2i-project.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "7030262076",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:7030262076:web:d94493e1c9411820f43639"
};

const SUPER_ADMIN_EMAIL = process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL || "vishal797577@gmail.com";
let RANGE_V2V = Number(process.env.NEXT_PUBLIC_DEFAULT_RANGE_V2V || 25);
let RANGE_V2I = Number(process.env.NEXT_PUBLIC_DEFAULT_RANGE_V2I || 50);

function ensureInitialized() {
  if (typeof window === "undefined") return false;
  if (window.__v2xBridgeReady) return true;

  const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(firebaseConfig);
  const db = app.database();
  const auth = app.auth();

  db.ref("v4/config").on("value", (snap) => {
    const cfg = snap.val() || {};
    if (cfg.rangeV2V && cfg.rangeV2V >= 5) RANGE_V2V = Number(cfg.rangeV2V);
    if (cfg.rangeV2I && cfg.rangeV2I >= 10) RANGE_V2I = Number(cfg.rangeV2I);
    document.dispatchEvent(
      new CustomEvent("rangesUpdated", {
        detail: { v2v: RANGE_V2V, v2i: RANGE_V2I }
      })
    );
  });

  function setSession(next) {
    const prev = getSession();
    const merged = { ...prev, ...next };
    if (!merged.user) return;
    sessionStorage.setItem("v2x_user", merged.user || "");
    sessionStorage.setItem("v2x_email", merged.email || "");
    sessionStorage.setItem("v2x_uid", merged.uid || "");
    sessionStorage.setItem("v2x_photo", merged.photo || "");
    sessionStorage.setItem("v2x_role", merged.role || "");
    sessionStorage.setItem("v2x_is_admin", merged.isAdmin ? "true" : "false");
    return merged;
  }

  function getSession() {
    const user = sessionStorage.getItem("v2x_user") || "";
    if (!user) return null;
    return {
      user,
      email: sessionStorage.getItem("v2x_email") || "",
      uid: sessionStorage.getItem("v2x_uid") || "",
      photo: sessionStorage.getItem("v2x_photo") || "",
      role: sessionStorage.getItem("v2x_role") || "",
      isAdmin: sessionStorage.getItem("v2x_is_admin") === "true"
    };
  }

  function clearSession() {
    ["v2x_user", "v2x_email", "v2x_uid", "v2x_photo", "v2x_role", "v2x_is_admin"].forEach((k) => {
      sessionStorage.removeItem(k);
    });
  }

  async function checkIsAdmin(uid) {
    if (!uid) return false;
    const s = await db.ref("v4/admins/" + uid).once("value");
    return !!s.val();
  }

  function isAdminSync(uid) {
    if (!uid) return false;
    const s = getSession();
    return !!(s?.isAdmin && s.uid === uid);
  }

  async function registerUser(user) {
    if (!user?.uid) return;
    await db.ref("v4/users/" + user.uid).update({
      email: user.email || "",
      name: user.displayName || user.email?.split("@")[0] || "User",
      photo: user.photoURL || "",
      status: "active",
      lastSeen: new Date().toISOString(),
      joinedAt: firebase.database.ServerValue.TIMESTAMP
    });
  }

  async function seedSuperAdmin(user) {
    if (!user?.uid || user.email !== SUPER_ADMIN_EMAIL) return;
    await db.ref("v4/admins/" + user.uid).set({
      email: user.email,
      name: user.displayName || "Super Admin",
      isSuperAdmin: true,
      addedAt: new Date().toISOString(),
      addedBy: "system"
    });
  }

  async function promoteToAdmin(uid, email, name, addedBy) {
    if (!uid || !email) throw new Error("Missing uid/email");
    return db.ref("v4/admins/" + uid).set({
      email,
      name: name || email.split("@")[0],
      isSuperAdmin: false,
      addedAt: new Date().toISOString(),
      addedBy: addedBy || "admin"
    });
  }

  async function demoteAdmin(uid, email) {
    if (email === SUPER_ADMIN_EMAIL) throw new Error("Cannot demote super admin");
    return db.ref("v4/admins/" + uid).remove();
  }

  async function banUser(uid, email, reason, bannedBy) {
    if (email === SUPER_ADMIN_EMAIL) throw new Error("Cannot ban super admin");
    return Promise.all([
      db.ref("v4/banned/" + uid).set({
        email: email || "",
        reason: reason || "Admin action",
        bannedBy: bannedBy || "admin",
        bannedAt: new Date().toISOString()
      }),
      db.ref("v4/users/" + uid + "/status").set("banned"),
      db.ref("v4/admins/" + uid).remove()
    ]);
  }

  async function unbanUser(uid) {
    return Promise.all([
      db.ref("v4/banned/" + uid).remove(),
      db.ref("v4/users/" + uid + "/status").set("active")
    ]);
  }

  async function removeUser(uid) {
    return db.ref("v4/users/" + uid).remove();
  }

  async function checkAndApplyPendingInvite(user) {
    if (!user?.uid || !user.email) return false;
    const email = String(user.email).toLowerCase();
    const pending = await db.ref("v4/pending_admins").once("value");
    const pendingObj = pending.val() || {};
    const entry = Object.entries(pendingObj as Record<string, any>).find(
      ([, v]) => String(v?.email || "").toLowerCase() === email
    );
    if (!entry) return false;

    const [key] = entry;
    await promoteToAdmin(user.uid, user.email, user.displayName || "", "invite");
    await db.ref("v4/pending_admins/" + key).remove();
    return true;
  }

  async function checkBanned(uid) {
    if (!uid) return false;
    const s = await db.ref("v4/banned/" + uid).once("value");
    return !!s.val();
  }

  function requireAuth() {
    const s = getSession();
    if (!s?.user) {
      window.location.replace("/login");
      return false;
    }
    return true;
  }

  function requireAdmin() {
    const s = getSession();
    if (!s?.user || !s?.isAdmin) {
      window.location.replace("/user-portal");
      return false;
    }
    return true;
  }

  async function logoutSession() {
    clearSession();
    await auth.signOut().catch(() => {});
    window.location.replace("/login");
  }

  function getRoleUrl(role) {
    if (role === "ev" || role === "emergency") return "/emergency";
    if (role === "signal") return "/signal";
    if (role === "vehicle1") return "/vehicle1";
    if (role === "vehicle2") return "/vehicle2";
    return "/user-portal";
  }

  function getRangeConfig() {
    return { v2v: RANGE_V2V, v2i: RANGE_V2I };
  }

  function haversine(lat1, lon1, lat2, lon2) {
    const toRad = (x) => (x * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return Math.round(6371000 * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))));
  }

  function getBearing(lat1, lon1, lat2, lon2) {
    const toRad = (x) => (x * Math.PI) / 180;
    const toDeg = (x) => (x * 180) / Math.PI;
    const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
    const x =
      Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
      Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
  }

  function bearingToDir(bearing) {
    const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    return dirs[Math.round(bearing / 45) % 8];
  }

  function getYieldSide(evLat, evLng, evHeading, vLat, vLng) {
    const b = getBearing(evLat, evLng, vLat, vLng);
    const rel = ((b - evHeading) + 360) % 360;
    if (rel < 180) return "Move Right";
    return "Move Left";
  }

  const w = window as any;

  w.firebase = firebase;
  w.db = db;
  w.auth = auth;
  w.DB = {
    emergency: db.ref("v4/emergency"),
    signal: db.ref("v4/signal"),
    vehicle1: db.ref("v4/vehicle1"),
    vehicle2: db.ref("v4/vehicle2"),
    events: db.ref("v4/events"),
    sessions: db.ref("v4/sessions"),
    config: db.ref("v4/config"),
    admins: db.ref("v4/admins"),
    users: db.ref("v4/users")
  };

  w.checkIsAdmin = checkIsAdmin;
  w.registerUser = registerUser;
  w.seedSuperAdmin = seedSuperAdmin;
  w.promoteToAdmin = promoteToAdmin;
  w.demoteAdmin = demoteAdmin;
  w.banUser = banUser;
  w.unbanUser = unbanUser;
  w.removeUser = removeUser;
  w.checkAndApplyPendingInvite = checkAndApplyPendingInvite;
  w.checkBanned = checkBanned;
  w.isAdminSync = isAdminSync;
  w.getSession = getSession;
  w.setSession = setSession;
  w.clearSession = clearSession;
  w.requireAuth = requireAuth;
  w.requireAdmin = requireAdmin;
  w.logoutSession = logoutSession;
  w.getRoleUrl = getRoleUrl;
  w.getRangeConfig = getRangeConfig;
  w.haversine = haversine;
  w.getBearing = getBearing;
  w.bearingToDir = bearingToDir;
  w.getYieldSide = getYieldSide;

  w.__v2xBridgeReady = true;
  return true;
}

export function bootLegacyBridge() {
  return ensureInitialized();
}
