"use client";

import { exportData } from "@/lib/store";
import { getContent } from "@/lib/content";

export function Footer() {
  function onDownload() {
    const bundle = { savedAt: new Date().toISOString(), state: exportData(), content: getContent() };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "clpr-offline.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }
  return (
    <footer className="footer">
      <div className="footer-row">
        <span className="gnav-brand"><span className="dot" />clpr</span>
        <button className="footer-export" onClick={onDownload}>download offline</button>
      </div>
    </footer>
  );
}
