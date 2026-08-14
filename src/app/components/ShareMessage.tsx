"use client";

import { useEffect, useState } from "react";
import styles from "../app.module.css";

export default function ShareMessage({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator.share === "function");
  }, []);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  async function share() {
    try {
      await navigator.share({ title: "🧧 Redpocket", text });
    } catch (e: unknown) {
      const name = (e as { name?: string })?.name;
      if (name === "AbortError") return;
      await copy();
    }
  }

  return (
    <div className={styles.shareCard}>
      <label className={styles.label}>Share message</label>
      <p className={styles.hint}>
        Copy this message into any chat. It has the password and the claim link. Do not add the refund secret.
      </p>
      <pre className={styles.sharePreview}>{text}</pre>
      <div className={styles.backupActions}>
        <button className={styles.btnCta} type="button" onClick={copy} style={{ marginTop: 0 }}>
          {copied ? "Copied share text" : "Copy share text"}
        </button>
        {canShare ? (
          <button className={styles.btnGhost} type="button" onClick={share}>
            Share…
          </button>
        ) : null}
      </div>
    </div>
  );
}
