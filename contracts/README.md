# Doom Market — contracts

Foundry project for the Doom Market launchpad on BNB Chain.

- `src/DoomToken.sol` — fixed-supply ERC20 (1,000,000,000 tokens, minted to the launchpad).
- `src/DoomLaunchpad.sol` — launches, pump-style bonding curve (virtual 30 BNB / 1.073B tokens, 800M sellable),
  mcap TWAP accumulator (TWAP over the last 25% of the launch window), sealed commit-reveal survival market
  (no settlement fee), creator bonds and reputation, on-chain token metadata (image, description, socials). Ownable2Step, Pausable, ReentrancyGuard.
- Treasury (immutable fee receiver and initial owner): `0x0DbFef7e227701671896B9Ef498D7Ce87F4E57e0`.

## Fees

**Platform fee: 0.1% (`FEE_BPS = 10`)** on launch, buy, sell and bet, pushed to the treasury in the same transaction
(`FeePaid(id, kind, payer, amount)`, kind 0=launch, 1=buy, 2=sell, 3=bet):

- launch: 0.1% of the bond (stored bond is net); buy: 0.1% of BNB in; sell: 0.1% of gross BNB out;
- bet (`commit`): 0.1% of the bet; the recorded stake is the net amount.

**Creator fee: 0.1% (`CREATOR_FEE_BPS = 10`)** on every buy (of BNB in) and sell (of gross BNB out), charged on top of the
platform fee (so trades pay 0.2% total). It is **accrued, not pushed**: `creatorFeesOwed(creator)` grows on each trade
(`CreatorFeeAccrued(id, creator, trader, amount)`), `totalCreatorFeesOwed` tracks the sum across creators, and the creator
withdraws everything from all their launches with `claimCreatorFees()` (`CreatorFeesClaimed(creator, amount)`; reverts
`NothingToClaim` when zero). A creator wallet that rejects BNB therefore can never block trading. On the buy that sells out
the curve, the combined 0.2% is computed on the BNB actually used (rounded up) and split evenly between creator and treasury.
`quoteBuy` / `quoteSell` already subtract both fees. No creator fee on launch bonds or bets.

No fee at settlement. Unrevealed stakes and no-winner cases (plus a died bond in that case) are sent to the treasury at `settle`.
Contract balance invariant: curve reserves + unclaimed bonds + market stakes + `totalCreatorFeesOwed`.

## Launching

`createLaunch((name, symbol, imageURI, description, website, twitter, telegram, targetMcap, duration), devBuyWei, devBuyMinOut)`
with `msg.value = bond + devBuyWei`. Gross bond must be >= `minBond`. If `devBuyWei > 0`, the creator buys in the same tx
(0.1% platform + 0.1% creator fee, slippage-checked). Limits: name 1-32 bytes, symbol 1-10, imageURI <= 256, description <= 512, each social <= 128.
Emits `LaunchCreated` then `LaunchMetadata`; metadata is readable via `getMetadata(id)` and `DoomToken.imageURI()`.

## Market lifecycle

| Phase   | Window                         | Action |
|---------|--------------------------------|--------|
| Commit  | `createdAt` → `deadline`       | `commit(id, keccak256(abi.encode(uint8 side, bytes32 salt, address user)))` with BNB (min 0.001) |
| Reveal  | `deadline` → `deadline + 24h`  | `reveal(id, side, salt)` (side 1 = YES survives, 2 = NO dies) |
| Settle  | after `revealEnd`              | `settle(id)` — anyone. Survived iff TWAP mcap over `[deadline - duration/4, deadline]` >= `targetMcap` |
| Claim   | after settle                   | `claim(id)` winners: stake + pro-rata share of (losing pool + unrevealed commits [+ bond if died]) `claimBond(id)` creator if survived |

If nobody revealed on the winning side, revealed stakes are refunded and forfeits (and a died bond) go to the treasury.

## Build & test

```bash
forge build
forge test -vv
```

## Deploy

Put `PRIVATE_KEY` and `BSCSCAN_API_KEY` in your shell env (or a local `.env` you `source`; never commit it).

### BSC testnet (chain 97)

```bash
source .env
forge script script/Deploy.s.sol:Deploy --rpc-url bsc_testnet --broadcast --verify -vvvv
```

### BSC mainnet (chain 56)

```bash
source .env
forge script script/Deploy.s.sol:Deploy --rpc-url bsc --broadcast --verify -vvvv
```

Dry-run (no broadcast): drop `--broadcast --verify`.

## Verify manually (if `--verify` failed)

```bash
# testnet
forge verify-contract <LAUNCHPAD_ADDRESS> src/DoomLaunchpad.sol:DoomLaunchpad \
  --chain 97 --etherscan-api-key $BSCSCAN_API_KEY --watch \
  --constructor-args $(cast abi-encode "constructor(address)" 0x0DbFef7e227701671896B9Ef498D7Ce87F4E57e0)

# mainnet
forge verify-contract <LAUNCHPAD_ADDRESS> src/DoomLaunchpad.sol:DoomLaunchpad \
  --chain 56 --etherscan-api-key $BSCSCAN_API_KEY --watch \
  --constructor-args $(cast abi-encode "constructor(address)" 0x0DbFef7e227701671896B9Ef498D7Ce87F4E57e0)
```

Each launched `DoomToken` is created by the launchpad with constructor `(string name, string symbol, string imageURI)`; verify one with:

```bash
forge verify-contract <TOKEN_ADDRESS> src/DoomToken.sol:DoomToken --chain 56 \
  --etherscan-api-key $BSCSCAN_API_KEY --watch \
  --constructor-args $(cast abi-encode "constructor(string,string,string)" "<NAME>" "<SYMBOL>" "<IMAGE_URI>")
```

## ABIs

After `forge build`, export ABIs for the app:

```bash
for d in ../web/src/abi ../backend/src/abi; do mkdir -p $d
  jq '.abi' out/DoomLaunchpad.sol/DoomLaunchpad.json > $d/DoomLaunchpad.json
  jq '.abi' out/DoomToken.sol/DoomToken.json > $d/DoomToken.json
done
```
