# Doom Market

Privacy-first memecoin launchpad on BNB Chain: every token launches with a creator bond and a sealed (commit-reveal) survival prediction market.

| | |
|---|---|
| Website | https://www.doomarket.xyz |
| API | https://api.doomarket.xyz |
| Contract (BSC mainnet) | `0xe3DDdAb89EA126f67eF2cDE2fFa95FCabFfbe6aa` ([Sourcify](https://repo.sourcify.dev/56/0xe3DDdAb89EA126f67eF2cDE2fFa95FCabFfbe6aa)) |
| Company wallet (owner + fees) | `0x0DbFef7e227701671896B9Ef498D7Ce87F4E57e0` |

Fees: 0.1% platform fee on launches, buys, sells and bets (sent to the company wallet), plus a 0.1% creator fee on buys and sells (claimable by the creator).

- `web/` – Next.js frontend (Vercel, root `web`)
- `backend/` – Fastify indexer + REST API + image uploads (Railway, root `/backend`)
- `contracts/` – Foundry contracts and tests
