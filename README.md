# Redpocket

Password Redpockets on Starknet [STRK20](https://strk20.starknet.io/hackathon). Claims settle into a shielded balance.

Stealth is the default, not a second product: send and claim both go through the privacy pool. Each address can claim a given Redpocket once.

Built for the [STRK20 Private Sprint](https://strk20.starknet.io/hackathon) as a private dapp: [Starknet Wallet API](https://strk20-by-example.org/wallet-api) plus a stateful [`privacy_invoke`](https://strk20-by-example.org/helpers/privacy-invoke) anonymizer. Closest published prompts: [IDEA-09](https://github.com/starkience/strk20-hackathon/blob/main/IDEAS.md) (pay by identifier / claim link) and the unofficial [escrow helper](https://strk20-by-example.org/helpers/escrow) pattern.

## How it feels

A host sets password `lucky`, 6 STRK (or USDC / ETH, any shieldable token), 6 shares, and drops the link in a group chat. Someone opens it, connects a wallet, enters the password (or the link already has it), and claims. One random share lands in their shielded balance. The same address claiming again is rejected. One Redpocket, one token.

## STRK20 integration

| Leg | What happens |
| --- | --- |
| Shield | Wallet API `deposit` into the live STRK20 pool |
| Create | `withdraw` to the helper, then one `invoke` (`privacy_invoke` Create). Empty open-note span; funds park in the helper |
| Claim / refund | `transfer` `OPEN` + one `invoke`. Helper approves the pool and returns `OpenNoteDeposit` so the payout lands in a shielded note |

The helper is only callable by the pool. Dedup uses `tx_info.account_contract_address`, not an address in calldata. Claimed events log amount and remaining shares, not addresses.

Create stores a password hash only. Claim submits the preimage. After the first claim, on-chain observers can see that preimage (same as an Alipay password packet). Mitigations: share cap, one claim per address, STRK20 registration cost.

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

Ready wallet required. RPC uses `PROVIDER_URL` in `.env.local` (Alchemy key, never `NEXT_PUBLIC_`).

The helper is deployed by the project. Users do not deploy it. Addresses go in `NEXT_PUBLIC_REDPOCKET_MAINNET` / `NEXT_PUBLIC_REDPOCKET_SEPOLIA`.

Cairo:

```bash
cd cairo && scarb build
```

## License

Apache-2.0. See [LICENSE](LICENSE).
