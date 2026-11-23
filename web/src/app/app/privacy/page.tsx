import PageHeader from "@/components/app/PageHeader";

export const metadata = { title: "Privacy — Doom Market" };

const steps = [
  ["Commit", "Pick YES or NO. Your browser generates a random 32-byte salt and computes keccak256(abi.encode(side, salt, you)). Only that hash and your BNB deposit go on-chain."],
  ["Wait", "While the market is open nobody can see which side you chose — not the creator, not other bettors, not MEV bots. The pool size is public; the split is not."],
  ["Reveal", "After close, you submit your side + salt. The contract re-hashes and checks it matches your commitment. Unrevealed bets are forfeited."],
  ["Claim", "Once the market resolves (survived vs. doomed), winners claim their share. If the token died, the creator bond is added to the NO side and holders."],
];

export default function Page() {
  return (
    <>
      <PageHeader
        eyebrow="Privacy"
        title={
          <>
            How sealed bets work<span className="text-acid">.</span>
          </>
        }
        sub="Commit-reveal keeps your position private until it no longer matters. View keys let you prove it to whoever you choose."
      />
      <div className="grid gap-4 md:grid-cols-2">
        {steps.map(([t, b], i) => (
          <div key={t} className="card p-6">
            <span className="font-mono text-xs text-acid">0{i + 1}</span>
            <h3 className="h-display mt-3 text-2xl">{t}</h3>
            <p className="mt-2 text-sm leading-relaxed text-white/55">{b}</p>
          </div>
        ))}
      </div>

      <div className="card mt-6 overflow-hidden p-6">
        <p className="font-medium">The commitment</p>
        <pre className="mt-4 overflow-x-auto rounded-2xl border border-white/[0.06] bg-black/50 p-4 font-mono text-xs leading-relaxed text-white/70">
{`salt       = crypto.getRandomValues(32 bytes)
commitment = keccak256(
  abi.encode(uint8 side, bytes32 salt, address user)
)
// side: 1 = YES (survives), 0 = NO (doomed)
// stored locally: localStorage["doommarket:commit:<marketId>"]`}
        </pre>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="card p-6">
          <h3 className="h-display text-2xl">Stealth wallets</h3>
          <p className="mt-2 text-sm leading-relaxed text-white/55">
            Bet from a fresh one-time address derived from your main key. Even after reveal, the position can’t be trivially linked back to
            your public wallet.
          </p>
        </div>
        <div className="card relative overflow-hidden p-6">
          <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-acid/20 blur-3xl" />
          <h3 className="h-display text-2xl">View keys</h3>
          <p className="mt-2 text-sm leading-relaxed text-white/55">
            Generate a read-only view key scoped to your bets. Share it with an auditor, exchange or tax tool to prove your history — without
            making it public.
          </p>
          <div className="mt-5 rounded-xl border border-dashed border-white/15 p-4 text-center text-xs text-white/40">View key generation ships with the mainnet contracts.</div>
        </div>
      </div>
    </>
  );
}
