"use client";

import Link from "next/link";
import styles from "../app.module.css";
import SelectWallet from "./client/SelectWallet";
import { Strk20Networks } from "@/lib/constants";
import { useFrontendProvider } from "./client/provider/providerContext";

export default function Shell({ children }: { children: React.ReactNode }) {
  const index = useFrontendProvider((s) => s.currentFrontendProviderIndex);
  const net = Strk20Networks[index] ?? "—";

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <nav className={styles.nav}>
          <div className={styles.brand}>
            <Link href="/">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className={styles.brandLogo} src="/strk20-logo.svg" alt="STRK20" width={147} height={20} />
              <span className={styles.brandWord}>Redpocket</span>
            </Link>
            <span>{net}</span>
          </div>
          <div className={styles.navLinks}>
            <Link href="/create" className={styles.navLink}>Send</Link>
            <Link href="/claim" className={styles.navLink}>Claim</Link>
            <Link href="/mine" className={styles.navLink}>Mine</Link>
          </div>
          <div className={styles.navWallet}>
            <SelectWallet />
          </div>
        </nav>
        {children}
        <footer className={styles.footer}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.footerLogo} src="/strk20-logo.svg" alt="STRK20" width={147} height={20} />
          <span>Private Sprint</span>
          <a href="https://github.com/kevlau1/redpocket" target="_blank" rel="noreferrer">
            GitHub
          </a>
          <a href="https://strk20-by-example.org/helpers/privacy-invoke" target="_blank" rel="noreferrer">
            Anonymizer docs
          </a>
          <a href="https://github.com/starkience/strk20-hackathon" target="_blank" rel="noreferrer">
            Hackathon
          </a>
        </footer>
      </div>
    </div>
  );
}
