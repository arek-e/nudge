import { describe, expect, test } from "bun:test";
import { Route as RootRoute } from "./__root";
import { Route as FaqRoute } from "./faq";
import { Route as HomeRoute } from "./index";

describe("marketing root head", () => {
  test("keeps global crawling and app metadata available from the document root", () => {
    const head = RootRoute.options.head?.();
    const links = JSON.stringify(head?.links ?? []);
    const meta = JSON.stringify(head?.meta ?? []);

    expect(meta).toContain("index,follow,max-image-preview:large");
    expect(meta).toContain("viewport-fit=cover");
    expect(meta).toContain("#fffdf8");
    expect(meta).toContain("application-name");
    expect(links).toContain("stylesheet");
    expect(links).toContain("/icons/nudge-logo-lockup-blobby-n-transparent.svg");
  });

  test("positions the home page for AI productivity and answer-engine discovery", () => {
    const head = HomeRoute.options.head?.();
    const links = JSON.stringify(head?.links ?? []);
    const meta = JSON.stringify(head?.meta ?? []);

    expect(links).toContain("https://explorenudge.com/");
    expect(links).toContain("canonical");
    expect(meta).toContain("nudge | AI productivity app for sticky notes and follow-through");
    expect(meta).toContain("sticky notes, scattered thoughts, and quick captures");
    expect(meta).toContain("AI productivity app");
    expect(meta).toContain("notes to tasks");
    expect(meta).toContain("og:title");
    expect(meta).toContain("twitter:card");
    expect(meta).toContain("SoftwareApplication");
    expect(meta).toContain("ProductivityApplication");
    expect(meta).toContain("Turn sticky notes into reminders");
    expect(meta).toContain("https://app.explorenudge.com");
    expect(meta).not.toContain("Nudge |");
    expect(meta).not.toContain("Daily operating loop");
    expect(meta).not.toContain("Personal AI teammate");
    expect(meta).not.toContain("right direction");
    expect(meta).not.toContain("source-linked proposals");
    expect(meta).not.toContain("daily operating loop");
    expect(meta).not.toContain("AI layer");
    expect(meta).not.toContain("done work");
  });

  test("adds FAQ-specific canonical metadata and FAQPage structured data", () => {
    const head = FaqRoute.options.head?.();
    const links = JSON.stringify(head?.links ?? []);
    const meta = JSON.stringify(head?.meta ?? []);

    expect(links).toContain("https://explorenudge.com/faq");
    expect(links).toContain("canonical");
    expect(meta).toContain("nudge FAQ | Notes, tasks, reminders, and reviewable AI");
    expect(meta).toContain("reviewable next steps");
    expect(meta).toContain("FAQPage");
    expect(meta).toContain("What does nudge keep track of?");
    expect(meta).toContain("Does nudge act without me?");
    expect(meta).toContain("How is this different from a task manager?");
    expect(meta).toContain("Task managers hold lists.");
  });
});
