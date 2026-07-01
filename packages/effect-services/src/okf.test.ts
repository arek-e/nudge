import { describe, expect, test } from "bun:test";
import type { UserDataExport } from "@vesta/db";
import { buildOkfProjection, listOkfDirectory, readOkfFile, searchOkfFiles } from "./okf";

const exportedUserData = {
  user: { id: "user-1", displayName: "Alex" },
  dailyNotes: [
    {
      id: "note-1",
      userId: "user-1",
      localDate: "2026-06-29",
      title: "June 29",
      bodyText: "Look into OKF as the filesystem shape for Vesta agent memory.",
      createdAt: "2026-06-29T08:00:00.000Z",
      updatedAt: "2026-06-29T09:00:00.000Z",
    },
  ],
  extractedItems: [
    {
      id: "item-1",
      userId: "user-1",
      sourceRevisionId: "revision-1",
      sourceNoteId: "note-1",
      kind: "follow_up",
      title: "Follow up on OKF",
      body: "Decide whether the Cloudflare sandbox gets a mounted OKF tree.",
      status: "proposed",
      confidence: 0.9,
      dedupeKey: "follow-up-okf",
      metadata: {},
      createdAt: "2026-06-29T09:10:00.000Z",
      updatedAt: "2026-06-29T09:11:00.000Z",
    },
  ],
  memoryDocuments: [
    {
      id: "memory-1",
      userId: "user-1",
      sourceType: "daily_note",
      sourceId: "note-1",
      title: "OKF filesystem memory",
      bodyText: "Project workspace knowledge into OKF Markdown for agents.",
      localDate: "2026-06-29",
      createdAt: "2026-06-29T09:05:00.000Z",
      updatedAt: "2026-06-29T09:06:00.000Z",
    },
  ],
  summaryDocuments: [
    {
      id: "summary-1",
      userId: "user-1",
      periodType: "day",
      periodStart: "2026-06-29",
      periodEnd: "2026-06-29",
      title: "June 29 summary",
      body: "OKF should be a projection over workspace data.",
      status: "ready",
      generatedAt: "2026-06-29T18:00:00.000Z",
      sourceNoteIds: ["note-1"],
      sourceItemIds: ["item-1"],
      metadata: {},
      createdAt: "2026-06-29T18:00:00.000Z",
      updatedAt: "2026-06-29T18:01:00.000Z",
    },
  ],
} satisfies Pick<
  UserDataExport,
  "dailyNotes" | "extractedItems" | "memoryDocuments" | "summaryDocuments" | "user"
>;

describe("OKF projection", () => {
  test("renders exported workspace knowledge as discoverable OKF files", () => {
    const projection = buildOkfProjection(exportedUserData);

    expect(listOkfDirectory(projection, "/")).toEqual([
      "daily",
      "index.md",
      "items",
      "memory",
      "summaries",
    ]);
    expect(listOkfDirectory(projection, "/daily")).toEqual(["2026-06-29.md", "index.md"]);

    expect(readOkfFile(projection, "/daily/2026-06-29.md")).toContain(
      'type: "Daily Note"\ntitle: "June 29"',
    );
    expect(readOkfFile(projection, "/daily/2026-06-29.md")).toContain(
      "Look into OKF as the filesystem shape",
    );
    expect(readOkfFile(projection, "/memory/daily_note/memory-1.md")).toContain(
      "[June 29](../../daily/2026-06-29.md)",
    );
    expect(readOkfFile(projection, "/items/item-1.md")).toContain('status: "proposed"');
    expect(readOkfFile(projection, "/summaries/day-2026-06-29.md")).toContain(
      "OKF should be a projection over workspace data.",
    );
  });

  test("renders concept files with OKF-required type and stable resource metadata", () => {
    const projection = buildOkfProjection(exportedUserData);

    for (const [path, content] of projection.files.entries()) {
      if (path.endsWith("/index.md") || path === "/index.md") continue;

      const frontmatter = content.match(/^---\n(?<frontmatter>[\s\S]*?)\n---\n/)?.groups
        ?.frontmatter;
      expect(frontmatter, path).toBeString();
      const metadata = Object.fromEntries(
        frontmatter!.split("\n").map((line) => {
          const separator = line.indexOf(": ");
          expect(separator, `${path} ${line}`).toBeGreaterThan(0);
          return [line.slice(0, separator), line.slice(separator + 2)];
        }),
      );
      expect(metadata.type, path).toBeString();
      expect(metadata.type, path).not.toBe('""');
      expect(metadata.resource, path).toMatch(/^"vesta:\/\/[^"]+"$/);
    }

    expect(readOkfFile(projection, "/daily/2026-06-29.md")).toContain(
      'resource: "vesta://daily/2026-06-29"',
    );
    expect(readOkfFile(projection, "/items/item-1.md")).toContain(
      'resource: "vesta://items/item-1"',
    );
    expect(readOkfFile(projection, "/memory/daily_note/memory-1.md")).toContain(
      'resource: "vesta://memory/daily_note/memory-1"',
    );
    expect(readOkfFile(projection, "/summaries/day-2026-06-29.md")).toContain(
      'resource: "vesta://summaries/day/2026-06-29"',
    );
  });

  test("searches projected OKF files by path and content", () => {
    const projection = buildOkfProjection(exportedUserData);

    expect(searchOkfFiles(projection, "sandbox")).toEqual([
      expect.objectContaining({
        path: "/items/item-1.md",
        snippet: "Decide whether the Cloudflare sandbox gets a mounted OKF tree.",
      }),
    ]);
    expect(searchOkfFiles(projection, "daily_note")).toEqual([
      expect.objectContaining({ path: "/memory/daily_note/memory-1.md" }),
    ]);
    expect(searchOkfFiles(projection, "missing")).toEqual([]);
  });
});
