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
            Shield tokens into STRK20 first. Then set a password, cap the shares, and send one claim link. Funds land in a shielded balance.
          </p>
        </div>
        <figure className={styles.heroVisual}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/redpocket-hero.jpg" alt="" width={1536} height={1024} />
        </figure>
      </header>

      <section className={styles.step}>
        <p className={styles.stepHead}>Step 1 · Shield</p>
        <div className={styles.shieldWrap}>
          <ShieldStrip />
        </div>
      </section>

      <section className={styles.step}>
        <p className={styles.stepHead}>Step 2 · Send or claim</p>
        <div className={styles.choices}>
          <Link className={styles.choice} href="/create">
            <span className={styles.choiceKicker}>Send</span>
            <h2>Seal a Redpocket</h2>
            <p>After shielding, set the total, share count, and password. Send the claim link. Keep the Redpocket ID and refund secret yourself.</p>
            <span className={styles.choiceGo}>Create Redpocket</span>
          </Link>
          <Link className={styles.choice} href="/claim">
            <span className={styles.choiceKicker}>Claim</span>
            <h2>Enter a password to claim</h2>
            <p>Enable private tokens in Ready on this network, then claim into your shielded balance. Each wallet can claim once.</p>
            <span className={styles.choiceGo}>Claim Redpocket</span>
          </Link>
        </div>
      </section>
    </Shell>
  );
}
