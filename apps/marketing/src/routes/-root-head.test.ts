import { describe, expect, test } from "bun:test";
import { Route } from "./__root";

describe("marketing root head", () => {
  test("positions nudge around sticky notes turning into reviewed next steps", () => {
    const head = Route.options.head?.();
    const meta = JSON.stringify(head?.meta ?? []);

    expect(meta).toContain("nudge | Sticky notes that turn into next steps");
    expect(meta).toContain("sticky notes, scraps, and half-formed thoughts");
    expect(meta).toContain("approve or edit");
    expect(meta).not.toContain("Nudge |");
    expect(meta).not.toContain("Daily operating loop");
    expect(meta).not.toContain("Personal AI teammate");
    expect(meta).not.toContain("right direction");
    expect(meta).not.toContain("source-linked proposals");
    expect(meta).not.toContain("daily operating loop");
    expect(meta).not.toContain("AI layer");
    expect(meta).not.toContain("done work");
  });
});
