# Redpocket

Live demo: [https://redpocket-virid.vercel.app/](https://redpocket-virid.vercel.app/) — Ready wallet, Starknet Mainnet.

Drop a password into a group chat. People race to claim. The money lands in a **shielded** STRK20 balance, not a public transfer. Onlookers can see that the pool paid the helper; they do not see who opened which share.

Same ritual as a WeChat red packet. Different ledger: stealth is the default, not a toggle.

## Why bother

**Fun.** Set `lucky`, six shares, a little STRK (or USDC, strkBTC, ETH — anything Ready can Shield). Paste one link. Friends mash Claim. Equal split or random. Each wallet gets **one** grab. The password never hits the chain, so the second share is not a public loot box after the first claim.

**Useful.** Pay a group without publishing a roster. Tip someone in Telegram without a visible “who paid whom.” Run a small office packet or a meetup raffle where the payout is private the moment it lands. Claimers do not need a fresh address; they need Ready, on this network, with private tokens enabled.

What stays quiet: who claimed, and the password. What does not: the total that left the pool. Redpocket is honest about that.

Built for the [STRK20 Private Sprint](https://strk20.starknet.io/hackathon): Wallet API + a stateful [`privacy_invoke`](https://strk20-by-example.org/helpers/privacy-invoke) helper. Kin to [IDEA-09](https://github.com/starkience/strk20-hackathon/blob/main/IDEAS.md) (pay by identifier / claim link) and the [escrow helper](https://strk20-by-example.org/helpers/escrow) pattern.

## How it feels

Saturday night, six people in a chat. You shield 6 STRK, seal a packet with password `lucky`, 6 shares, random. You send **one** claim link — not six secrets.

A-Hua taps it on the train, connects Ready, claims. ~1.4 STRK appears in her shielded balance. The same wallet cannot grab again. A-Qiang tries from his account and gets another share. Nobody in the thread, and nobody scrolling Voyager, gets a neat list of who won what.

You keep the refund secret on your device. After expiry, unclaimed funds come back to **your** shielded balance, same wallet that sealed the packet.

## STRK20 integration

| Leg | What happens |
| --- | --- |
| Shield | Wallet API `deposit` into the live STRK20 pool |
| Create | `withdraw` to the helper, then one `invoke` (`privacy_invoke` Create). Empty open-note span; funds park in the helper |
| Claim / refund | `transfer` `OPEN` + one `invoke`. Helper approves the pool and returns `OpenNoteDeposit` so the payout lands in a shielded note |

The helper is only callable by the pool. Dedup uses `tx_info.account_contract_address`, not an address in calldata. Claimed events log amount and remaining shares, not addresses.

Create stores a Merkle root of **committed** tickets `L_i = poseidon(SEALPACK_COMMIT:V1, T_i)` where `T_i = poseidon(SEALPACK_LEAF:V1, password, index)`. Claim submits one unused `T` plus a proof of `L` — never the password. Proof siblings are `L` values, so seeing a claim does not reveal other tickets. Proof length must match the padded tree height. Each Starknet address can still claim only once.

## Stack

- Next.js 16 + React 19 frontend
- `starknet.js` 10.4 WalletAccountV6 (Privacy Wallet API)
- Cairo anonymizer in `cairo/`
- Ready wallet (MetaMask / Braavos skipped)

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Ready wallet required. RPC uses `PROVIDER_URL` in `.env.local` (Alchemy key, never `NEXT_PUBLIC_`). If it is empty, the app falls back to Cartridge public RPC.

The helper is already deployed. Users do not deploy it. Addresses live in `NEXT_PUBLIC_REDPOCKET_MAINNET` / `NEXT_PUBLIC_REDPOCKET_SEPOLIA` (defaults are the live contracts).

Cairo:

```bash
cd cairo && scarb build
```

## License

Apache-2.0. See [LICENSE](LICENSE).
