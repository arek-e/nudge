import {
  MarketingActionLink,
  MarketingBrandMark,
  MarketingHeroArtwork,
  MarketingHeadline,
  MarketingNoteActionFlow,
  MarketingNudgeWord,
  MarketingProofGrid,
} from "@nudge/ui/marketing";
import {
  answerEngineHighlights,
  ctaReassurance,
  heroCopy,
  marketingSite,
  noteActions,
  noteLines,
  productivityUseCases,
  proofLabel,
  proofPoints,
} from "../marketing-content";

export function MarketingHome() {
  return (
    <main className="marketing-page bg-page min-h-svh overflow-x-clip">
      <section
        className="relative isolate grid h-svh grid-rows-[auto_minmax(0,1fr)_auto] overflow-clip p-[clamp(1.1rem,2.4vw,2rem)] max-[560px]:p-4"
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
              <MarketingActionLink href={marketingSite.appHref} variant="header">
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
              <MarketingActionLink href={marketingSite.appHref} variant="primary">
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
      <section
        className="border-t border-[rgba(26,39,53,0.12)] px-[clamp(1.1rem,2.4vw,2rem)] py-[clamp(3.2rem,8vw,6.5rem)]"
        aria-labelledby="answer-title"
        data-slot="marketing-answer-summary"
      >
        <div className="mx-auto grid w-[min(76rem,100%)] gap-[clamp(2rem,5vw,4rem)]">
          <div className="grid max-w-[48rem] gap-4">
            <p className="section-kicker m-0 text-[0.66rem] font-[650] tracking-normal text-[rgba(26,39,53,0.46)] uppercase">
              AI productivity app
            </p>
            <h2
              className="text-logo-ink m-0 text-[clamp(2.1rem,4.4vw,4.2rem)] leading-[0.98] font-[560] tracking-normal text-balance"
              id="answer-title"
            >
              Capture first. Review the next step later.
            </h2>
            <p className="m-0 max-w-[42rem] text-[clamp(1rem,1.45vw,1.18rem)] leading-[1.62] text-pretty text-[rgba(26,39,53,0.72)]">
              nudge is built for the gap between a quick note and the action it implies. It keeps
              the messy source visible, then drafts the next step so you can decide what is worth
              doing.
            </p>
          </div>

          <div
            className="grid grid-cols-3 gap-3 max-[860px]:grid-cols-1"
            data-slot="marketing-answer-cards"
            role="list"
          >
            {answerEngineHighlights.map((item) => (
              <article
                className="grid gap-3 rounded-[0.5rem] border border-[rgba(26,39,53,0.14)] bg-[rgba(255,253,248,0.72)] p-[clamp(1rem,2vw,1.35rem)]"
                data-slot="marketing-answer-card"
                key={item.title}
                role="listitem"
              >
                <h3 className="text-logo-ink m-0 text-[1.04rem] leading-[1.2] font-[620] tracking-normal">
                  {item.title}
                </h3>
                <p className="m-0 text-[0.94rem] leading-[1.58] text-pretty text-[rgba(26,39,53,0.72)]">
                  {item.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section
        className="border-t border-[rgba(26,39,53,0.12)] px-[clamp(1.1rem,2.4vw,2rem)] py-[clamp(2.8rem,7vw,5.8rem)]"
        aria-labelledby="use-cases-title"
        data-slot="marketing-use-cases"
      >
        <div className="mx-auto grid w-[min(76rem,100%)] grid-cols-[minmax(0,0.72fr)_minmax(18rem,1fr)] gap-[clamp(2rem,7vw,6rem)] max-[860px]:grid-cols-1">
          <div className="grid content-start gap-4">
            <p className="section-kicker m-0 text-[0.66rem] font-[650] tracking-normal text-[rgba(26,39,53,0.46)] uppercase">
              Useful for
            </p>
            <h2
              className="text-logo-ink m-0 max-w-[12ch] text-[clamp(2rem,4vw,3.65rem)] leading-[1] font-[560] tracking-normal text-balance"
              id="use-cases-title"
            >
              Notes that should become something.
            </h2>
          </div>
          <ul className="m-0 grid gap-0 border-t border-[rgba(26,39,53,0.16)] p-0">
            {productivityUseCases.map((useCase) => (
              <li
                className="list-none border-b border-[rgba(26,39,53,0.16)] py-[1rem] text-[clamp(1rem,1.5vw,1.18rem)] leading-[1.52] text-pretty text-[rgba(26,39,53,0.76)]"
                key={useCase}
              >
                {useCase}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
