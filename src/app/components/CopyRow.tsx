"use client";

import { useState } from "react";
import styles from "../app.module.css";

export default function CopyRow({
  label,
  value,
  hint,
  wrap = false,
}: {
  label: string;
  value: string;
  hint?: string;
  wrap?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div className={styles.copyBlock}>
      <label className={styles.label}>{label}</label>
      {hint ? <p className={styles.hint}>{hint}</p> : null}
      <div className={styles.linkRow}>
        <code className={wrap ? styles.codeWrap : undefined}>{value}</code>
        <button className={styles.copy} type="button" onClick={copy}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
