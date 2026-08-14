"use client";

import styles from "../app.module.css";
import { explorerTxUrl, type ActionResult } from "@/lib/strk20";
import { useFrontendProvider } from "./client/provider/providerContext";

export default function Receipt({ r }: { r: ActionResult }) {
  const index = useFrontendProvider((s) => s.currentFrontendProviderIndex);
  const cls =
    r.status === "error"
      ? styles.receiptError
      : r.status === "pending"
        ? styles.receiptPending
        : styles.receiptOk;
  return (
    <div className={`${styles.receipt} ${cls}`}>
      <div className={styles.receiptHead}>{r.title}</div>
      {r.rows?.map((row) => (
        <div key={row.label} className={styles.receiptRow}>
          <span className={styles.receiptLabel}>{row.label}</span>
          {row.hash ? (
            <a className={styles.receiptLink} href={explorerTxUrl(index, row.hash)} target="_blank" rel="noreferrer">
              {row.value}
            </a>
          ) : (
            <span>{row.value}</span>
          )}
        </div>
      ))}
      {r.note ? <pre className={styles.receiptNote}>{r.note}</pre> : null}
    </div>
  );
}
