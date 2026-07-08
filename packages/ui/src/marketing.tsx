import { HalftoneDots, type HalftoneDotsProps } from "@paper-design/shaders-react";
import { useState, type CSSProperties, type ReactNode } from "react";

export type MarketingActionVariant = "header" | "nav" | "primary" | "secondary";

export interface MarketingFaqEntry {
  readonly answer: ReactNode;
  readonly question: string;
}

export interface MarketingNoteAction {
  readonly detail: ReactNode;
  readonly label: string;
  readonly source: string;
}

const actionButtonClass =
  "inline-grid min-h-[2.9rem] min-w-[11.5rem] place-items-center rounded-[0.55rem] border border-logo-ink px-5 text-[0.94rem] font-[620] tracking-normal transition-[transform,color,background-color,border-color] duration-[170ms] ease-[cubic-bezier(0.2,0,0,1)] active:scale-[0.96] max-[860px]:flex-[1_1_12rem] max-[560px]:min-h-[2.55rem] max-[560px]:min-w-0 max-[560px]:basis-[9.5rem] max-[560px]:text-[0.86rem] max-[360px]:basis-[8.55rem] max-[360px]:px-3 max-[360px]:text-[0.82rem]";

const marketingActionClassByVariant = {
  header:
    "header-app-link inline-grid min-h-[2.25rem] place-items-center rounded-[0.55rem] border border-logo-ink bg-logo-ink px-[0.9rem] text-[0.78rem] font-[620] tracking-normal text-page transition-[transform,color,background-color,border-color] duration-[170ms] ease-[cubic-bezier(0.2,0,0,1)] hover:border-[#253648] hover:bg-[#253648] hover:text-page active:scale-[0.96]",
  nav: "hero-text-knockout inline-block transition-[transform,color] duration-[170ms] ease-[cubic-bezier(0.2,0,0,1)] hover:text-[#9a3219] active:scale-[0.96]",
  primary: `primary-action ${actionButtonClass} bg-logo-ink text-page hover:border-[#253648] hover:bg-[#253648] hover:text-page`,
  secondary: `secondary-action hero-text-knockout ${actionButtonClass} bg-transparent text-logo-ink hover:border-[rgba(241,79,35,0.58)] hover:text-[#9a3219]`,
} satisfies Record<MarketingActionVariant, string | undefined>;

const loopNodePositionClassByIndex: ReadonlyArray<string> = [
  "top-[3%] left-1/2 -translate-x-1/2",
  "right-[1%] bottom-[19%]",
  "bottom-[19%] left-[1%]",
];
const heroImageSrc = "/images/nudge-hero-open-sky.png";
type MarketingHeroHalftoneSettings = Pick<
  HalftoneDotsProps,
  | "colorBack"
  | "colorFront"
  | "contrast"
  | "fit"
  | "grainMixer"
  | "grainOverlay"
  | "grainSize"
  | "grid"
  | "height"
  | "image"
  | "inverted"
  | "originalColors"
  | "radius"
  | "size"
  | "type"
  | "width"
>;

export const marketingHeroHalftoneSettings = {
  width: 1280,
  height: 720,
  image: heroImageSrc,
  colorBack: "#f2f1e8",
  colorFront: "#8f9695",
  originalColors: false,
  type: "gooey",
  grid: "hex",
  inverted: false,
  size: 0.24,
  radius: 1.39,
  contrast: 0.45,
  grainMixer: 0.2,
  grainOverlay: 0.2,
  grainSize: 0.09,
  fit: "cover",
} satisfies MarketingHeroHalftoneSettings;

const heroReadabilityWashStyle = {
  background:
    "radial-gradient(ellipse 70% 8rem at 50% 100%, rgba(255, 253, 248, 0.94) 0%, rgba(255, 253, 248, 0.94) 38%, rgba(255, 253, 248, 0.62) 62%, rgba(255, 253, 248, 0) 100%)",
  height: "clamp(6.8rem, 16vh, 9rem)",
  pointerEvents: "none",
} satisfies CSSProperties;

export function MarketingBrandMark(props: { readonly href?: string; readonly label?: string }) {
  const label = props.label ?? "nudge";

  return (
    <a
      className="brand-mark inline-flex items-center"
      data-slot="marketing-brand"
      href={props.href ?? "/"}
      aria-label={label}
    >
      <img
        className="h-9 w-auto max-[560px]:h-8"
        data-slot="marketing-brand-logo"
        src="/icons/nudge-logo-lockup-blobby-n-transparent.svg"
        alt={label}
      />
    </a>
  );
}

export function MarketingActionLink(props: {
  readonly children: ReactNode;
  readonly href: string;
  readonly variant: MarketingActionVariant;
}) {
  return (
    <a
      className={marketingActionClassByVariant[props.variant]}
      data-slot="marketing-action"
      data-variant={props.variant}
      href={props.href}
    >
      {props.children}
    </a>
  );
}

export function MarketingHeadline(props: { readonly children: ReactNode; readonly id: string }) {
  return (
    <h1
      className="hero-title text-logo-ink m-0 max-w-[11.8ch] text-[clamp(3.9rem,7.6vw,7.7rem)] leading-[0.9] font-[580] tracking-normal text-balance max-[860px]:text-[clamp(3.1rem,13vw,4.75rem)] max-[760px]:text-[clamp(2.75rem,9.6vw,3.55rem)] max-[560px]:text-[clamp(2.45rem,11.8vw,3.34rem)] [@media(max-width:560px)_and_(max-height:720px)]:max-w-[10.7ch] [@media(max-width:560px)_and_(max-height:720px)]:text-[clamp(2.05rem,10.6vw,2.62rem)]"
      data-slot="marketing-headline"
      id={props.id}
    >
      {props.children}
    </h1>
  );
}

export function MarketingNudgeWord(props: { readonly children: ReactNode }) {
  const [direction, setDirection] = useState<"left" | "right">("left");

  function toggleDirection() {
    setDirection((current) => (current === "left" ? "right" : "left"));
  }

  return (
    <span
      className="nudge-word text-logo-orange inline-block rounded-[0.16em] px-[0.04em]"
      data-slot="marketing-nudge-word"
      data-direction={direction}
      onMouseEnter={toggleDirection}
      onTouchStart={toggleDirection}
    >
      {props.children}
    </span>
  );
}

export function MarketingHeroArtwork() {
  return (
    <div
      className="hero-artwork pointer-events-none absolute inset-0 z-0 overflow-hidden"
      data-slot="marketing-hero-artwork"
      aria-hidden="true"
    >
      <HalftoneDots
        {...marketingHeroHalftoneSettings}
        className="hero-artwork__halftone absolute inset-0"
        data-slot="marketing-hero-halftone-dots"
        data-hero-image={heroImageSrc}
        data-halftone-treatment="visible-hero-dots"
      />
      <span
        className="hero-artwork__readability-wash absolute inset-x-0 bottom-0 z-[4]"
        style={heroReadabilityWashStyle}
      />
    </div>
  );
}

export function MarketingLoopDiagram(props: { readonly items: ReadonlyArray<string> }) {
  return (
    <div
      className="loop-diagram relative aspect-square w-[min(24rem,100%)] max-[860px]:w-[min(18rem,82vw)] max-[560px]:w-[min(12.8rem,62vw)]"
      data-slot="marketing-loop-diagram"
      data-signature="operating-loop"
      role="list"
      aria-label="nudge operating loop stages"
    >
      <span
        className="loop-track absolute inset-[16%] rounded-full border border-[rgba(26,39,53,0.22)]"
        aria-hidden="true"
      />
      <span
        className="loop-pulse bg-logo-orange absolute top-1/2 left-1/2 size-[0.76rem] rounded-full shadow-[0_0_0_0.45rem_rgba(241,79,35,0.13)]"
        aria-hidden="true"
      />
      {props.items.map((item, index) => (
        <span
          className={`loop-node hero-text-knockout absolute grid min-h-[2.2rem] w-[5.8rem] place-items-center rounded-full border border-[rgba(26,39,53,0.16)] bg-[rgba(255,253,248,0.92)] text-[0.74rem] font-[620] tracking-normal text-[rgba(26,39,53,0.78)] uppercase max-[560px]:min-h-[1.9rem] max-[560px]:w-[4.85rem] max-[560px]:text-[0.62rem] ${loopNodePositionClassByIndex[index] ?? ""}`}
          key={item}
          role="listitem"
        >
          <span>{item}</span>
        </span>
      ))}
    </div>
  );
}

export function MarketingNoteActionFlow(props: {
  readonly actions: ReadonlyArray<MarketingNoteAction>;
  readonly note: ReadonlyArray<string>;
}) {
  return (
    <section
      className="note-action-flow hero-text-knockout relative grid w-full max-w-[29rem] gap-[0.95rem] rounded-[1.35rem] bg-[rgba(255,253,248,0.72)] p-[clamp(0.86rem,1.8vw,1.08rem)] shadow-[0_1.1rem_3.2rem_rgba(26,39,53,0.12),0_0_0_1px_rgba(26,39,53,0.08)] backdrop-blur-[2px] max-[860px]:max-w-[27rem] max-[560px]:max-w-[20.5rem] max-[560px]:gap-[0.72rem] max-[560px]:rounded-[1rem] max-[560px]:p-[0.72rem]"
      data-slot="marketing-note-action-flow"
      id="note-action"
      aria-label="Example note transformed into next actions"
    >
      <div className="grid grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] items-stretch gap-[0.78rem] max-[560px]:gap-[0.56rem]">
        <article
          className="sticky-note bg-logo-orange text-page grid content-between rounded-[0.9rem] p-[0.86rem] shadow-[0_0.9rem_1.65rem_rgba(155,57,28,0.18)] max-[560px]:rounded-[0.72rem] max-[560px]:p-[0.66rem]"
          data-slot="marketing-sticky-note"
        >
          <p className="m-0 text-[0.62rem] font-[700] tracking-normal text-[rgba(255,253,248,0.8)] uppercase max-[560px]:text-[0.52rem]">
            quick note
          </p>
          <ul className="m-0 grid gap-[0.42rem] p-0 text-[0.86rem] leading-[1.24] font-[580] max-[560px]:gap-[0.32rem] max-[560px]:text-[0.66rem]">
            {props.note.map((line) => (
              <li className="list-none" key={line}>
                {line}
              </li>
            ))}
          </ul>
        </article>

        <div
          className="action-queue grid content-start gap-[0.5rem] max-[560px]:gap-[0.38rem]"
          data-slot="marketing-action-queue"
          role="list"
          aria-label="Suggested next actions"
        >
          {props.actions.map((action) => (
            <article
              className="action-card grid gap-[0.28rem] rounded-[0.72rem] bg-[rgba(255,253,248,0.9)] px-[0.72rem] py-[0.62rem] shadow-[0_0.45rem_1.2rem_rgba(26,39,53,0.08),0_0_0_1px_rgba(26,39,53,0.07)] max-[560px]:rounded-[0.58rem] max-[560px]:px-[0.54rem] max-[560px]:py-[0.48rem]"
              data-slot="marketing-action-card"
              key={action.label}
              role="listitem"
            >
              <div className="flex items-center justify-between gap-[0.5rem]">
                <p className="text-logo-ink m-0 text-[0.72rem] leading-none font-[720] tracking-normal uppercase max-[560px]:text-[0.54rem]">
                  {action.label}
                </p>
                <span className="rounded-full bg-[rgba(241,79,35,0.12)] px-[0.38rem] py-[0.16rem] text-[0.56rem] leading-none font-[680] text-[#9a3219] max-[560px]:hidden">
                  from note
                </span>
              </div>
              <p className="m-0 text-[0.7rem] leading-[1.25] text-[rgba(26,39,53,0.72)] max-[560px]:text-[0.56rem]">
                {action.detail}
              </p>
              <p className="m-0 truncate text-[0.58rem] leading-none font-[620] text-[rgba(26,39,53,0.54)] max-[560px]:text-[0.5rem]">
                {action.source}
              </p>
            </article>
          ))}
        </div>
      </div>

      <div
        className="action-review-row text-page flex min-h-10 items-center justify-between gap-[0.5rem] rounded-[0.8rem] bg-[rgba(26,39,53,0.9)] px-[0.65rem] shadow-[0_0.65rem_1.4rem_rgba(26,39,53,0.16)] max-[560px]:min-h-8 max-[560px]:rounded-[0.64rem] max-[560px]:px-[0.5rem]"
        data-slot="marketing-action-review"
      >
        <span className="text-[0.64rem] font-[620] text-[rgba(255,253,248,0.7)] max-[560px]:text-[0.52rem]">
          ready for review
        </span>
        <span className="flex items-center gap-[0.35rem] text-[0.62rem] font-[700] max-[560px]:gap-[0.22rem] max-[560px]:text-[0.5rem]">
          <span className="bg-logo-orange text-page rounded-full px-[0.48rem] py-[0.22rem]">
            approve
          </span>
          <span className="rounded-full bg-[rgba(255,253,248,0.12)] px-[0.44rem] py-[0.22rem]">
            edit
          </span>
          <span className="rounded-full bg-[rgba(255,253,248,0.12)] px-[0.44rem] py-[0.22rem]">
            skip
          </span>
        </span>
      </div>
    </section>
  );
}

export function MarketingProofGrid(props: { readonly items: ReadonlyArray<string> }) {
  return (
    <div
      className="proof-grid flex flex-wrap justify-center gap-x-[clamp(0.9rem,3vw,2.2rem)] gap-y-[clamp(0.9rem,3vw,2.2rem)] max-[560px]:gap-x-[0.9rem] max-[560px]:gap-y-[0.55rem]"
      data-slot="marketing-proof-grid"
    >
      {props.items.map((item) => (
        <MarketingProofItem key={item}>{item}</MarketingProofItem>
      ))}
    </div>
  );
}

export function MarketingProofItem(props: { readonly children: ReactNode }) {
  return (
    <article
      className="proof-item inline-flex min-h-0 items-center gap-[0.58rem] p-0"
      data-slot="marketing-proof-item"
    >
      <span className="size-[0.38rem] rounded-full bg-[rgba(241,79,35,0.72)]" aria-hidden="true" />
      <p
        className="hero-text-knockout m-0 text-[0.86rem] leading-[1.2] font-[580] text-[rgba(26,39,53,0.74)] max-[560px]:text-[0.74rem]"
        data-slot="marketing-proof-copy"
      >
        {props.children}
      </p>
    </article>
  );
}

export function MarketingFaqList(props: { readonly items: ReadonlyArray<MarketingFaqEntry> }) {
  return (
    <div
      className="faq-list grid gap-0 border-t border-[rgba(26,39,53,0.16)]"
      data-slot="marketing-faq-list"
    >
      {props.items.map((item) => (
        <article
          className="faq-item grid gap-[0.72rem] border-b border-[rgba(26,39,53,0.16)] py-[1.35rem]"
          data-slot="marketing-faq-item"
          key={item.question}
        >
          <h3 className="text-logo-ink m-0 text-[clamp(1.05rem,1.8vw,1.28rem)] font-normal tracking-normal">
            {item.question}
          </h3>
          <p className="m-0 max-w-[42rem] text-[0.98rem] leading-[1.55] text-pretty text-[rgba(26,39,53,0.76)]">
            {item.answer}
          </p>
        </article>
      ))}
    </div>
  );
}
