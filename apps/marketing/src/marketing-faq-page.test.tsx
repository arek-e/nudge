import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MarketingFaqPage } from "./components/MarketingFaqPage";

describe("MarketingFaqPage", () => {
  test("serves the FAQ on its own marketing page", () => {
    const html = renderToStaticMarkup(<MarketingFaqPage />);

    expect(html).toContain("nudge FAQ");
    expect(html).toContain("What does nudge keep track of?");
    expect(html).toContain("Does nudge act without me?");
    expect(html).toContain("How is this different from a task manager?");
    expect(html).toContain("Open nudge");
    expect(html).toContain('alt="nudge"');
    expect(html).toContain('data-slot="marketing-faq-list"');
    expect(html).toContain('href="/"');
    expect(html).toContain('href="https://app.explorenudge.com"');
    expect(html).not.toContain("tracking-[");
    expect(html).not.toContain("font-[790]");
    expect(html).not.toContain(">Nudge<");
    expect(html).not.toContain("Open Nudge");
    expect(html).not.toContain(">method<");
    expect(html).not.toContain(">Open app<");
  });
});
