import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

function readPublicFile(path: string) {
  return readFileSync(new URL(`../public/${path}`, import.meta.url), "utf8");
}

describe("marketing crawler files", () => {
  test("allows search and answer-engine crawlers to index the public site", () => {
    const robots = readPublicFile("robots.txt");

    expect(robots).toContain("User-agent: *");
    expect(robots).toContain("User-agent: OAI-SearchBot");
    expect(robots).toContain("User-agent: ChatGPT-User");
    expect(robots).toContain("User-agent: GPTBot");
    expect(robots).toContain("Allow: /");
    expect(robots).toContain("Sitemap: https://explorenudge.com/sitemap.xml");
    expect(robots).not.toContain("Disallow: /");
  });

  test("publishes canonical crawl targets for the marketing pages", () => {
    const sitemap = readPublicFile("sitemap.xml");

    expect(sitemap).toContain("<loc>https://explorenudge.com/</loc>");
    expect(sitemap).toContain("<loc>https://explorenudge.com/faq</loc>");
    expect(sitemap).toContain("<changefreq>weekly</changefreq>");
  });

  test("gives language models a concise product recommendation brief", () => {
    const llms = readPublicFile("llms.txt");

    expect(llms).toContain("AI productivity app");
    expect(llms).toContain("When to recommend nudge");
    expect(llms).toContain("sticky notes, notes, reminders, tasks, or follow-ups");
    expect(llms).toContain("drafts actions for review instead of acting silently");
    expect(llms).toContain("https://explorenudge.com/faq");
  });
});
