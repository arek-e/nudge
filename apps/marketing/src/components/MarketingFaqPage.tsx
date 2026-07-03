import { MarketingActionLink, MarketingBrandMark, MarketingFaqList } from "@nudge/ui/marketing";
import { faqItems, marketingSite } from "../marketing-content";

export function MarketingFaqPage() {
  return (
    <main className="faq-page bg-page min-h-screen p-[clamp(1.1rem,2.4vw,2rem)] max-[560px]:p-4">
      <header
        className="relative z-[2] flex min-h-11 items-center justify-between gap-4 max-[560px]:min-h-[2.35rem]"
        aria-label="Site header"
      >
        <MarketingBrandMark />
        <nav
          className="flex items-center gap-[clamp(0.85rem,2vw,1.3rem)] text-[0.82rem] font-[650] tracking-normal text-[rgba(26,39,53,0.72)] max-[560px]:gap-[0.7rem]"
          aria-label="Primary"
        >
          <MarketingActionLink href="/" variant="nav">
            Home
          </MarketingActionLink>
          <MarketingActionLink href={marketingSite.appHref} variant="header">
            Open nudge
          </MarketingActionLink>
        </nav>
      </header>

      <section
        className="mx-auto grid w-[min(76rem,100%)] grid-cols-[minmax(0,0.72fr)_minmax(18rem,1fr)] gap-[clamp(2rem,7vw,6rem)] py-[clamp(4rem,12vh,8rem)] max-[860px]:grid-cols-1 max-[860px]:gap-[2.4rem] max-[860px]:py-14 max-[560px]:pt-12"
        aria-labelledby="faq-title"
      >
        <div className="grid content-start gap-4 max-[860px]:justify-items-center max-[860px]:text-center">
          <p className="section-kicker m-0 text-center text-[0.66rem] font-[650] tracking-normal text-[rgba(26,39,53,0.46)] uppercase max-[560px]:text-[0.58rem]">
            FAQ
          </p>
          <h1
            className="text-logo-ink m-0 max-w-[9ch] text-[clamp(3.4rem,7vw,6.8rem)] leading-[0.9] font-[680] tracking-normal text-balance max-[560px]:text-[clamp(3rem,18vw,4.6rem)]"
            id="faq-title"
          >
            nudge FAQ
          </h1>
          <p className="m-0 max-w-[31rem] text-[clamp(1rem,1.4vw,1.18rem)] leading-[1.55] text-pretty text-[rgba(26,39,53,0.62)]">
            Short answers for how nudge keeps context, review, and follow-through connected.
          </p>
        </div>
        <MarketingFaqList items={faqItems} />
      </section>
    </main>
  );
}
