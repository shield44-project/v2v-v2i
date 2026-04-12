"use client";

import { useEffect, useState } from "react";
import { bootLegacyBridge } from "../lib/firebase/legacyBridge";

export default function LegacyFirebaseScripts({ onReady }) {
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    if (appReady) return;
    const ok = bootLegacyBridge();
    if (!ok) return;
    setAppReady(true);
    if (onReady) onReady();
  }, [appReady, onReady]);

  return null;
}
