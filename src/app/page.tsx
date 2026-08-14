"use client";

import Link from "next/link";
import styles from "./app.module.css";
import Shell from "./components/Shell";
import ShieldStrip from "./components/ShieldStrip";

export default function Page() {
  return (
    <Shell>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={styles.heroLogo} src="/strk20-logo.svg" alt="STRK20" width={161} height={22} />
          </p>
          <h1 className={styles.heroTitle}>
            Redpocket
            <em>Claim into stealth</em>
          </h1>
          <p className={styles.heroSub}>
            Set a password, cap the shares, one claim per address. Funds land in your STRK20 shielded balance.
          </p>
        </div>
        <figure className={styles.heroVisual}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/redpocket-hero.jpg" alt="" width={1536} height={1024} />
        </figure>
      </header>

      <div className={styles.choices}>
        <Link className={styles.choice} href="/create">
          <span className={styles.choiceKicker}>Send</span>
          <h2>Seal a Redpocket</h2>
          <p>Set the total, share count, and password. Drop the claim link in a chat. Keep the Redpocket ID and refund secret yourself.</p>
          <span className={styles.choiceGo}>Create Redpocket</span>
        </Link>
        <Link className={styles.choice} href="/claim">
          <span className={styles.choiceKicker}>Claim</span>
          <h2>Enter a password to claim</h2>
          <p>Connect a wallet and enter the password. Funds go to your shielded balance. The same address cannot claim twice.</p>
          <span className={styles.choiceGo}>Claim Redpocket</span>
        </Link>
      </div>

      <div className={styles.shieldWrap}>
        <ShieldStrip />
      </div>
    </Shell>
  );
}
