# Doom Market — contracts

Foundry project for the Doom Market launchpad on BNB Chain.

- `src/DoomToken.sol` — fixed-supply ERC20 (1,000,000,000 tokens, minted to the launchpad).
- `src/DoomLaunchpad.sol` — launches, pump-style bonding curve (virtual 30 BNB / 1.073B tokens, 800M sellable, 1% fee),
  mcap TWAP accumulator (TWAP over the last 25% of the launch window), sealed commit-reveal survival market
  (2% fee on the losing pool), creator bonds and reputation. Ownable2Step, Pausable, ReentrancyGuard.
- Treasury (immutable fee receiver and initial owner): `0x0DbFef7e227701671896B9Ef498D7Ce87F4E57e0`.

## Market lifecycle

| Phase   | Window                         | Action |
|---------|--------------------------------|--------|
| Commit  | `createdAt` → `deadline`       | `commit(id, keccak256(abi.encode(uint8 side, bytes32 salt, address user)))` with BNB (min 0.001) |
| Reveal  | `deadline` → `deadline + 24h`  | `reveal(id, side, salt)` (side 1 = YES survives, 2 = NO dies) |
| Settle  | after `revealEnd`              | `settle(id)` — anyone. Survived iff TWAP mcap over `[deadline - duration/4, deadline]` >= `targetMcap` |
| Claim   | after settle                   | `claim(id)` winners: stake + pro-rata share of (losing pool + unrevealed commits [+ bond if died]) minus 2% fee. `claimBond(id)` creator if survived |

If nobody revealed on the winning side, revealed stakes are refunded and forfeits (and a died bond) go to the treasury.
Protocol fees accrue in the contract; `withdrawFees()` (anyone) pushes them to the treasury.

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

Each launched `DoomToken` is created by the launchpad with constructor `(string name, string symbol)`; verify one with:

```bash
forge verify-contract <TOKEN_ADDRESS> src/DoomToken.sol:DoomToken --chain 56 \
  --etherscan-api-key $BSCSCAN_API_KEY --watch \
  --constructor-args $(cast abi-encode "constructor(string,string)" "<NAME>" "<SYMBOL>")
```

## ABIs

After `forge build`, export ABIs for the app:

```bash
for d in ../web/src/abi ../backend/src/abi; do mkdir -p $d
  jq '.abi' out/DoomLaunchpad.sol/DoomLaunchpad.json > $d/DoomLaunchpad.json
  jq '.abi' out/DoomToken.sol/DoomToken.json > $d/DoomToken.json
done
```
