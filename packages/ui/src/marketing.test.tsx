import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  MarketingActionLink,
  MarketingBrandMark,
  MarketingHeroArtwork,
  MarketingHeadline,
  MarketingLoopDiagram,
  MarketingNudgeWord,
  MarketingNoteActionFlow,
  MarketingProofGrid,
  marketingHeroHalftoneSettings,
} from "./marketing";

describe("marketing UI primitives", () => {
  test("render the shared brand, actions, headline, operating loop diagram, and proof strip slots", () => {
    const html = renderToStaticMarkup(
      <section>
        <MarketingBrandMark href="/" label="nudge" />
        <MarketingActionLink href="https://app.explorenudge.com" variant="primary">
          Open app
        </MarketingActionLink>
        <MarketingActionLink href="#loop" variant="secondary">
          See the loop
        </MarketingActionLink>
        <MarketingHeadline id="hero-title">
          <MarketingNudgeWord>nudge</MarketingNudgeWord> you in the right direction.
        </MarketingHeadline>
        <MarketingHeroArtwork />
        <MarketingNoteActionFlow
          note={[
            "follow up with Sam about launch date",
            "ask if invoice is blocked",
            "remind me friday",
          ]}
          actions={[
            {
              detail: "Sam gets a draft you can edit first.",
              label: "draft reply",
              source: "launch date",
            },
            {
              detail: "Friday reminder waits in the queue.",
              label: "create reminder",
              source: "remind me friday",
            },
          ]}
        />
        <MarketingLoopDiagram items={["Capture", "Clarify", "Return"]} />
        <MarketingProofGrid
          items={[
            "Capture the loose thread",
            "Let the loop sort it",
            "Review the next useful nudge",
          ]}
        />
      </section>,
    );

    expect(html).toContain('data-slot="marketing-brand"');
    expect(html).toContain('data-slot="marketing-brand-logo"');
    expect(html).toContain('src="/icons/nudge-logo-lockup-blobby-n-transparent.svg"');
    expect(html).toContain('alt="nudge"');
    expect(html).not.toContain('data-slot="marketing-brand-dot"');
    expect(html).toContain('data-slot="marketing-action"');
    expect(html).toContain('data-variant="primary"');
    expect(html).toContain('data-variant="secondary"');
    expect(html).toContain('data-slot="marketing-headline"');
    expect(html).toContain('class="hero-title text-logo-ink');
    expect(html).not.toContain("hero-title hero-text-knockout");
    expect(html).toContain("max-[760px]:text-[clamp(2.75rem,9.6vw,3.55rem)]");
    expect(html).toContain('data-slot="marketing-nudge-word"');
    expect(html).not.toContain('data-slot="marketing-nudge-word-label"');
    expect(html).not.toContain('data-slot="marketing-nudge-word-bleed"');
    expect(html).toContain('data-direction="left"');
    expect(html).not.toContain('type="button"');
    expect(html).not.toContain('role="button"');
    expect(html).toContain('data-slot="marketing-hero-artwork"');
    expect(html).not.toContain("metaball");
    expect(html).toContain('data-slot="marketing-hero-halftone-dots"');
    expect(html).toContain('data-hero-image="/images/nudge-hero-open-sky.png"');
    expect(html).toContain('data-halftone-treatment="visible-hero-dots"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('data-slot="marketing-note-action-flow"');
    expect(html).toContain('aria-label="Example note transformed into next actions"');
    expect(html).toContain('data-slot="marketing-sticky-note"');
    expect(html).toContain("follow up with Sam about launch date");
    expect(html).toContain('data-slot="marketing-action-queue"');
    expect(html).toContain("draft reply");
    expect(html).toContain("approve");
    expect(html).toContain("edit");
    expect(html).toContain("skip");
    expect(html).toContain('data-slot="marketing-loop-diagram"');
    expect(html).toContain('data-signature="operating-loop"');
    expect(html).toContain('role="list"');
    expect(html).toContain('aria-label="nudge operating loop stages"');
    expect(html).toContain('role="listitem"');
    expect(html).toContain("Clarify");
    expect(html).toContain('data-slot="marketing-proof-grid"');
    expect(html).toContain("Review the next useful nudge");
    expect(html).not.toContain("headline-overlay");
    expect(html).not.toContain("lava-map");
    expect(html).not.toContain("signal-aura");
    expect(html).not.toContain('data-slot="marketing-hero-image"');
  });

  test("uses a cool light grey Paper halftone dots hero preset with the nudge hero image", () => {
    expect(marketingHeroHalftoneSettings).toEqual({
      width: 1280,
      height: 720,
      image: "/images/nudge-hero-open-sky.png",
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
    });
  });

  test("does not render a metaball shader layer over the hero artwork", () => {
    const html = renderToStaticMarkup(<MarketingHeroArtwork />);

    expect(html).toContain('data-slot="marketing-hero-halftone-dots"');
    expect(html).not.toContain("metaball");
    expect(html).not.toContain("paper-shader-mount");
  });
});
