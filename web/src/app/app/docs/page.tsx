import PageHeader from "@/components/app/PageHeader";
import { LAUNCHPAD_ADDRESS, MARKET_ADDRESS, TREASURY_ADDRESS } from "@/lib/contracts";

export const metadata = { title: "Docs — Doom Market" };

const sections: [string, string[]][] = [
  [
    "Overview",
    [
      "Doom Market is a memecoin launchpad on BNB Chain where every token is paired with a prediction market: “Will this token be above $X market cap in N days?”",
      "Creators post a BNB bond at launch. Bettors take YES (survives) or NO (doomed) with sealed, commit-reveal bets.",
    ],
  ],
  [
    "Launching a token",
    [
      "Choose a name, symbol, bond (min 0.1 BNB), target market cap and a duration of 3, 7, 14 or 30 days.",
      "The token trades on a bonding curve from launch. The bond is held by the market contract until resolution.",
    ],
  ],
  [
    "Market lifecycle",
    [
      "Open → bets are committed as hashes. Reveal → after close, bettors reveal side + salt. Resolved → market cap is checked against the target.",
      "Survived: creator gets the bond back and reputation; YES bettors split the NO pool. Doomed: bond is split between holders and NO bettors, plus the YES pool.",
    ],
  ],
  [
    "Reputation",
    ["Each creator handle accrues a score based on survival rate, bond size and streaks. Handles are pseudonymous and never require KYC."],
  ],
  [
    "Fees",
    ["A small protocol fee on launches and winnings goes to the treasury. Fee parameters are set in the contracts and shown before you sign."],
  ],
];

export default function Page() {
  const rows: [string, string][] = [
    ["Treasury", TREASURY_ADDRESS],
    ["Launchpad", LAUNCHPAD_ADDRESS ?? "deploying soon"],
    ["Prediction market", MARKET_ADDRESS ?? "deploying soon"],
  ];
  return (
    <>
      <PageHeader
        eyebrow="Docs"
        title={
          <>
            Protocol docs<span className="text-acid">.</span>
          </>
        }
        sub="Everything you need to launch, bet, reveal and claim."
      />
      <div className="grid gap-8 lg:grid-cols-[200px_1fr]">
        <nav className="hidden space-y-1 text-sm lg:block">
          {sections.map(([t]) => (
            <a key={t} href={`#${t.toLowerCase().replace(/\s+/g, "-")}`} className="block rounded-lg px-3 py-1.5 text-white/50 hover:bg-white/[0.04] hover:text-white">
              {t}
            </a>
          ))}
          <a href="#contracts" className="block rounded-lg px-3 py-1.5 text-white/50 hover:bg-white/[0.04] hover:text-white">
            Contracts
          </a>
        </nav>
        <div className="min-w-0 space-y-4">
          {sections.map(([t, ps]) => (
            <section key={t} id={t.toLowerCase().replace(/\s+/g, "-")} className="card scroll-mt-24 p-6">
              <h2 className="h-display text-2xl">{t}</h2>
              {ps.map((p, i) => (
                <p key={i} className="mt-3 text-sm leading-relaxed text-white/60">
                  {p}
                </p>
              ))}
            </section>
          ))}
          <section id="contracts" className="card scroll-mt-24 p-6">
            <h2 className="h-display text-2xl">Contracts</h2>
            <div className="mt-4 divide-y divide-white/[0.06]">
              {rows.map(([k, v]) => (
                <div key={k} className="flex flex-col gap-1 py-3 sm:flex-row sm:justify-between">
                  <span className="text-sm text-white/50">{k}</span>
                  <span className="break-all font-mono text-xs text-white/80">{v}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-white/35">Networks: BNB Smart Chain (56) and BSC Testnet (97).</p>
          </section>
        </div>
      </div>
    </>
  );
}
