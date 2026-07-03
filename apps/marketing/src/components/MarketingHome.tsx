import {
  MarketingActionLink,
  MarketingBrandMark,
  MarketingHeroArtwork,
  MarketingHeadline,
  MarketingNoteActionFlow,
  MarketingNudgeWord,
  MarketingProofGrid,
} from "@nudge/ui/marketing";

const appHref = "https://app.explorenudge.com";

const proofPoints = [
  "sticky note -> reminder",
  "loose thought -> task",
  "nothing sends without approval",
];
const heroCopy =
  "Capture rough thoughts fast. nudge reads them, finds the action, and turns them into reminders, drafts, tasks, and follow-ups you can approve or edit.";
const ctaReassurance = "Drop the note now. Decide what moves later.";
const proofLabel = "messy note in, useful action out";
const noteLines = [
  "follow up with Sam about launch date",
  "ask if invoice is blocked",
  "remind me friday",
];
const noteActions = [
  {
    detail: "Sam gets a draft you can edit first.",
    label: "draft reply",
    source: "from: launch date",
  },
  {
    detail: "Friday reminder waits for approval.",
    label: "create reminder",
    source: "from: remind me friday",
  },
  {
    detail: "Invoice check becomes a follow-up.",
    label: "schedule follow-up",
    source: "from: invoice blocked",
  },
];

export function MarketingHome() {
  return (
    <main className="marketing-page bg-page h-svh overflow-clip">
      <section
        className="relative isolate grid h-full grid-rows-[auto_minmax(0,1fr)_auto] p-[clamp(1.1rem,2.4vw,2rem)] max-[560px]:p-4"
        aria-labelledby="hero-title"
      >
        <MarketingHeroArtwork />
        <header
          className="relative z-[2] flex min-h-11 items-center justify-center max-[560px]:min-h-[2.35rem]"
          aria-label="Site header"
        >
          <div
            className="inline-flex min-h-11 items-center justify-center gap-[clamp(1rem,3vw,1.75rem)] max-[560px]:min-h-[2.35rem] max-[560px]:gap-[0.72rem]"
            data-slot="marketing-header-cluster"
          >
            <MarketingBrandMark />
            <nav
              className="flex items-center gap-[clamp(0.78rem,1.7vw,1.12rem)] text-[0.82rem] font-[650] tracking-normal text-[rgba(26,39,53,0.72)] max-[560px]:gap-[0.62rem]"
              aria-label="Primary"
            >
              <MarketingActionLink href="/faq" variant="nav">
                FAQ
              </MarketingActionLink>
              <MarketingActionLink href={appHref} variant="header">
                Open nudge
              </MarketingActionLink>
            </nav>
          </div>
        </header>

        <div
          className="relative z-[1] mx-auto grid w-[min(76rem,100%)] grid-cols-[minmax(0,1fr)_minmax(18rem,28rem)] items-center gap-[clamp(2.5rem,8vw,7rem)] self-center pt-[clamp(3rem,8vh,5.8rem)] pb-[clamp(2rem,4vh,3rem)] max-[860px]:grid-cols-1 max-[860px]:gap-[2.2rem] max-[860px]:pt-[clamp(2.5rem,7vh,4rem)] max-[860px]:pb-[1.4rem] max-[560px]:gap-[1.2rem] max-[560px]:pt-[1.6rem] max-[560px]:pb-[0.75rem] [@media(max-width:560px)_and_(max-height:720px)]:pt-[0.3rem] [@media(max-width:560px)_and_(max-height:720px)]:pb-[0.35rem] [@media(min-width:561px)_and_(max-width:760px)]:self-start [@media(min-width:561px)_and_(max-width:760px)]:pt-[1.3rem]"
          data-slot="marketing-hero-stack"
        >
          <div className="grid justify-items-start text-left max-[860px]:justify-items-center max-[860px]:text-center">
            <p
              className="hero-text-knockout m-0 mb-[1.1rem] text-[0.72rem] font-[700] tracking-normal text-[#9a3219] uppercase [@media(max-width:560px)_and_(max-height:720px)]:hidden [@media(min-width:561px)_and_(max-width:760px)]:hidden"
              data-slot="marketing-hero-eyebrow"
            >
              Sticky-note capture. AI follow-through.
            </p>
            <MarketingHeadline id="hero-title">
              <MarketingNudgeWord>nudge</MarketingNudgeWord> turns sticky notes into next steps.
            </MarketingHeadline>
            <p
              className="hero-copy hero-text-knockout mt-[1.55rem] mb-0 w-[min(39rem,100%)] text-[clamp(1.05rem,1.55vw,1.25rem)] leading-[1.58] text-pretty text-[rgba(26,39,53,0.82)] max-[560px]:mt-[0.95rem] max-[560px]:text-[0.98rem] max-[560px]:leading-[1.45] [@media(max-width:560px)_and_(max-height:720px)]:mt-[0.7rem] [@media(max-width:560px)_and_(max-height:720px)]:text-[0.9rem] [@media(max-width:560px)_and_(max-height:720px)]:leading-[1.34]"
              data-slot="marketing-hero-copy"
              data-copy={heroCopy}
            >
              {heroCopy}
            </p>
            <div
              className="mt-[1.8rem] flex flex-wrap gap-[0.8rem] max-[860px]:w-full max-[860px]:justify-center max-[560px]:mt-[1.1rem] max-[560px]:gap-[0.6rem] [@media(max-width:560px)_and_(max-height:720px)]:mt-[0.85rem] [@media(max-width:560px)_and_(max-height:720px)]:gap-[0.5rem]"
              data-slot="marketing-hero-actions"
            >
              <MarketingActionLink href={appHref} variant="primary">
                try nudge
              </MarketingActionLink>
              <MarketingActionLink href="#note-action" variant="secondary">
                see note -&gt; action
              </MarketingActionLink>
            </div>
            <p
              className="cta-reassurance hero-text-knockout mt-[0.72rem] mb-0 max-w-[32rem] text-[0.82rem] leading-[1.45] font-[560] text-[rgba(26,39,53,0.78)] max-[860px]:text-center max-[560px]:mt-[0.55rem] max-[560px]:text-[0.74rem] [@media(max-width:560px)_and_(max-height:720px)]:mt-[0.42rem] [@media(max-width:560px)_and_(max-height:720px)]:text-[0.68rem]"
              data-slot="marketing-cta-reassurance"
              data-copy={ctaReassurance}
            >
              {ctaReassurance}
            </p>
          </div>

          <aside
            className="relative grid min-h-[clamp(24rem,45vw,31rem)] content-center justify-items-center border-l border-[rgba(26,39,53,0.16)] pl-[clamp(1.5rem,3vw,2.5rem)] max-[860px]:min-h-64 max-[860px]:border-l-0 max-[860px]:pl-0 max-[560px]:min-h-48 [@media(max-width:560px)_and_(max-height:720px)]:hidden"
            data-slot="marketing-action-proof-panel"
            aria-label="Example note transformed into next actions"
          >
            <p
              className="proof-label-knockout hero-text-knockout m-0 mb-8 self-start justify-self-start text-[0.72rem] font-[650] tracking-normal text-[rgba(26,39,53,0.72)] uppercase max-[860px]:mb-4 max-[860px]:justify-self-center max-[860px]:text-center max-[560px]:mb-[0.7rem] max-[560px]:text-[0.64rem]"
              data-slot="marketing-proof-label"
              data-copy={proofLabel}
            >
              {proofLabel}
            </p>
            <MarketingNoteActionFlow actions={noteActions} note={noteLines} />
          </aside>
        </div>

        <section
          className="relative z-[1] grid justify-items-center gap-[0.9rem] pb-[clamp(0.35rem,1.4vh,0.9rem)] max-[560px]:gap-[0.58rem] max-[560px]:pb-0 [@media(max-width:560px)_and_(max-height:720px)]:gap-[0.42rem]"
          id="loop"
          data-slot="marketing-proof-strip"
          aria-labelledby="loop-title"
        >
          <p
            className="section-kicker hero-text-knockout m-0 text-center text-[0.66rem] font-[650] tracking-normal text-[rgba(26,39,53,0.72)] uppercase max-[560px]:text-[0.58rem]"
            id="loop-title"
          >
            Built for control
          </p>
          <MarketingProofGrid items={proofPoints} />
        </section>
      </section>
    </main>
  );
}
