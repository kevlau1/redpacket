"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../app.module.css";
import Shell from "../components/Shell";

export default function ClaimIndexPage() {
  const router = useRouter();
  const [dropId, setDropId] = useState("");
  const [password, setPassword] = useState("");

  return (
    <Shell>
      <h1 className={styles.h1}>Enter a password to claim</h1>
      <p className={styles.note}>
        If you have a claim link, open it directly. You only need a Redpocket ID here when someone told you the password without a link.
      </p>
      <div className={styles.panel}>
        <label className={styles.label}>Redpocket ID</label>
        <p className={styles.hint}>
          A long 0x… address. Passwords can repeat (many Redpockets named &quot;lucky&quot;), so the Redpocket ID is what picks the right one.
        </p>
        <input className={styles.field} value={dropId} onChange={(e) => setDropId(e.target.value)} placeholder="0x…" />
        <label className={styles.label}>Password</label>
        <p className={styles.hint}>The passphrase set by the sender. Each Starknet address can claim a Redpocket once.</p>
        <input className={styles.field} value={password} onChange={(e) => setPassword(e.target.value)} />
        <button
          className={styles.btnCta}
          type="button"
          onClick={() => {
            const id = dropId.trim();
            if (!id) return;
            const hash = password.trim() ? `#p=${encodeURIComponent(password.trim())}` : "";
            router.push(`/claim/${id}${hash}`);
          }}
        >
          Continue to claim
        </button>
      </div>
    </Shell>
  );
}
