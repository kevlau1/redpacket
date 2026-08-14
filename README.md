# Redpocket

Live demo: [https://redpocket-virid.vercel.app/](https://redpocket-virid.vercel.app/) — Ready wallet, Starknet Mainnet.

Drop a password into a group chat. People race to claim. The money lands in a **shielded** STRK20 balance, not a public transfer. Onlookers can see that the pool paid the helper; they do not see who opened which share.

Two modes — **equal split** and **lucky draw** — are the whole product. Stealth is the default, not a toggle.

## Why bother

This is the feature group chats never stop using. Someone drops 1,000 USDC. Ten people hit Claim. Either everyone walks away with 100 even, or it is a lucky packet: one friend screenshots 186.40, another groans at 41.12, and the thread explodes. Same dopamine. The payout is private the moment it lands.

**Equal.** Fair split for a dinner, a meetup, a team bonus. No spreadsheet, no “please send your address,” no public roster of who got paid.

**Lucky.** The chaotic one. Random shares, one grab per wallet, password never on-chain — so the first claim does not turn the rest into a public loot box. The group argues about luck. Voyager does not get a leaderboard of names.

Claimers need Ready on this network, with private tokens enabled. STRK, USDC, strkBTC, ETH — anything the wallet can Shield.

What stays quiet: who claimed, and the password. What does not: the total that left the pool. Redpocket is honest about that.

Built for the [STRK20 Private Sprint](https://strk20.starknet.io/hackathon): Wallet API + a stateful [`privacy_invoke`](https://strk20-by-example.org/helpers/privacy-invoke) helper. Kin to [IDEA-09](https://github.com/starkience/strk20-hackathon/blob/main/IDEAS.md) (pay by identifier / claim link) and the [escrow helper](https://strk20-by-example.org/helpers/escrow) pattern.

## How it feels

New Year in a 10-person Telegram. You shield 1,000 USDC and seal a packet with password `lucky`.

Equal mode: ten claims, 100 USDC each, done in a minute. Lucky mode: you pick random, send **one** link, and let them fight. A friend on the train claims and hits a fat share. Someone else opens a thinner one. The same wallet cannot grab twice. Unclaimed funds, after expiry, refund to **your** shielded balance with the wallet that sealed the packet.

That is why it spreads. People already know the ritual. Redpocket is that ritual, with the claim itself in stealth.

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
