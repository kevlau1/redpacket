"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../app.module.css";
import Shell from "../components/Shell";
import Receipt from "../components/Receipt";
import { errorResult, type ActionResult } from "@/lib/strk20";

export default function ClaimIndexPage() {
  const router = useRouter();
  const [dropId, setDropId] = useState("");
  const [password, setPassword] = useState("");
  const [result, setResult] = useState<ActionResult | null>(null);

  function onContinue() {
    const id = dropId.trim();
    const pw = password.trim();
    if (!id && !pw) {
      setResult(errorResult("Enter a Redpacket ID and a password."));
      return;
    }
    if (!id) {
      setResult(errorResult("Enter a Redpacket ID."));
      return;
    }
    if (!pw) {
      setResult(errorResult("Enter a password."));
      return;
    }
    setResult(null);
    router.push(`/claim/${id}#p=${encodeURIComponent(pw)}`);
  }

  return (
    <Shell>
      <h1 className={styles.h1}>Enter a password to claim</h1>
      <p className={styles.note}>
        If you have a claim link, open it directly. You only need a Redpacket ID here when someone told you the password without a link.
      </p>
      <div className={styles.panel}>
        <label className={styles.label}>Redpacket ID</label>
        <p className={styles.hint}>
          A long 0x… value. Passwords can repeat, so this ID is what selects the right Redpacket.
        </p>
        <input
          className={styles.field}
          value={dropId}
          onChange={(e) => {
            setDropId(e.target.value);
            setResult(null);
          }}
          placeholder="0x…"
        />
        <label className={styles.label}>Password</label>
        <p className={styles.hint}>Set by the sender. Each wallet can claim a given Redpacket once.</p>
        <input
          className={styles.field}
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setResult(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") onContinue();
          }}
        />
        <button className={styles.btnCta} type="button" onClick={onContinue}>
          Continue to claim
        </button>
        {result ? <Receipt r={result} /> : null}
      </div>
    </Shell>
  );
}
