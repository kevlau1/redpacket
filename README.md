# Redpacket

Live demo: [https://redpocket-virid.vercel.app/](https://redpocket-virid.vercel.app/) — Ready wallet, Starknet Mainnet.

Drop a password into a group chat. People race to claim. Each share is paid straight into a **shielded** STRK20 balance, so nothing lands in the claimer's public wallet and what they do with it next stays inside the pool.

Two modes — **equal split** and **lucky draw** — are the whole product. Shielded payout is the default, not a toggle.

## Why bother

This is the feature group chats never stop using. Someone drops 1,000 USDC. Ten people hit Claim. Either everyone walks away with 100 even, or it is a lucky packet: one friend screenshots 186.40, another groans at 41.12, and the thread explodes. Same dopamine, except the money arrives as private balance instead of a public transfer.

**Equal.** Fair split for a dinner, a meetup, a team bonus. No spreadsheet, no “please send your address,” no ten public transfers fanning out of your wallet.

**Lucky.** The chaotic one. Random shares, one grab per wallet, and the password never touches the chain — so the first claim does not hand the remaining tickets to anyone watching. The group argues about luck instead of reading the answer off a block explorer.

## How it feels

New Year in a 10-person Telegram. You shield 1,000 USDC and seal a packet with password `lucky`.

Equal mode: ten claims, 100 USDC each, done in a minute. Lucky mode: you pick random, send **one** link, and let them fight. A friend on the train claims and hits a fat share. Someone else opens a thinner one. The same wallet cannot grab twice. Unclaimed funds, after expiry, refund to **your** shielded balance with the wallet that sealed the packet.

That is why it spreads. People already know the ritual. Redpacket is that ritual, paid out as private balance.

## What it hides, what it does not

Every leg here is a normal Starknet transaction signed by a normal wallet, so be precise about which part is private:

| What | On-chain |
| --- | --- |
| The password | Never on-chain. Only a Merkle root of committed tickets is stored. |
| Unclaimed shares | Hidden. A claim reveals one ticket and its sibling hashes — nothing that lets you derive the others. |
| Where a share lands | A shielded note. No public ERC-20 transfer to the claimer, no bump in their public balance. |
| What the claimer does next | Private. Moving that balance inside the pool hides sender, recipient and amount. |
| Who sealed the packet | **Public.** The seal transaction is signed by the creator's own account. |
| Who claimed | **Public.** Each claim is signed by the claimer's own account. |
| Amounts | **Public.** The sealed total and every payout are plaintext — open notes carry their filled amount in the clear. |

So a block explorer will happily tell you that address `0xed26…` claimed 0.1179 STRK from the demo packet on Mainnet. It cannot tell you the password, which shares are still live, or where that 0.1179 went next. If you want the claim itself unlinkable too, claim from a fresh account — the packet does not care which one, and the payout is still shielded.

Unshielding back to a public address is a public edge again. That is [protocol-level](https://strk20-by-example.org/compliance), not something this app can paper over.

## STRK20 integration

Built for the [STRK20 Private Sprint](https://strk20.starknet.io/hackathon): Wallet API + a stateful [`privacy_invoke`](https://strk20-by-example.org/helpers/privacy-invoke) helper. Kin to [IDEA-09](https://github.com/starkience/strk20-hackathon/blob/main/IDEAS.md) (pay by identifier / claim link) and the [escrow helper](https://strk20-by-example.org/helpers/escrow) pattern.

| Leg | What happens |
| --- | --- |
| Shield | Wallet API `deposit` into the live STRK20 pool |
| Create | `withdraw` to the helper, then one `invoke` (`privacy_invoke` Create). Empty open-note span; funds park in the helper |
| Claim / refund | `transfer` `OPEN` + one `invoke`. Helper approves the pool and returns `OpenNoteDeposit` so the payout lands in a shielded note |

The helper is only callable by the pool. Dedup uses `tx_info.account_contract_address`, so one Starknet address claims at most once — and that address is the public transaction sender, which is exactly why the claim is not anonymous.

## Merkle tickets

Create stores a Merkle root of **committed** tickets `L_i = poseidon(SEALPACK_COMMIT:V1, T_i)` where `T_i = poseidon(SEALPACK_LEAF:V1, password, index)`. Claim submits one unused `T` plus a proof of `L` — never the password. Proof siblings are `L` values, so seeing a claim does not reveal another ticket. Proof length must match the padded tree height, which blocks short-proof forgeries. Each Starknet address can still claim only once.

## Limits worth knowing

- **One claim per address is a speed bump, not Sybil resistance.** Anyone holding the password can take every share from fresh wallets. Treat the password like cash.
- **Lucky amounts are drawn on-chain** from the pack state and capped at twice the current average. A determined claimer can simulate the draw before signing, so lucky mode is a game, not a guaranteed lottery.
- **Equal mode floors.** If the total does not divide evenly, the last claim takes the remainder.
- **Nothing auto-refunds.** After expiry the creator returns leftovers using the same wallet plus the refund secret from the create screen. Back it up; it lives in that browser only. Expiry is capped at 30 days, because refund is the only way back and a typo would park the money for years.
- **Claimers need Ready** on the same network, with private tokens enabled. STRK, USDC, strkBTC, ETH — anything the wallet can Shield.

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

The helper is already deployed. Users do not deploy it. Addresses live in `NEXT_PUBLIC_REDPACKET_MAINNET` / `NEXT_PUBLIC_REDPACKET_SEPOLIA` (defaults are the live contracts).

Cairo:

```bash
cd cairo && scarb build
scarb test
```

## License

Apache-2.0. See [LICENSE](LICENSE).
