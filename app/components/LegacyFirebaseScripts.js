"use client";

import { useState } from "react";
import Script from "next/script";

export default function LegacyFirebaseScripts({ onReady }) {
  const [appReady, setAppReady] = useState(false);

  const handleReady = () => {
    if (appReady) return;
    setAppReady(true);
    if (onReady) onReady();
  };

  return (
    <>
      <Script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js" strategy="afterInteractive" />
      <Script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js" strategy="afterInteractive" />
      <Script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js" strategy="afterInteractive" />
      <Script src="/firebase-config.js" strategy="afterInteractive" onLoad={handleReady} />
    </>
  );
}
