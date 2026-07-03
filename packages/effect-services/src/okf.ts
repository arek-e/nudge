import type {
  DailyNoteRecord,
  ExtractedItemRecord,
  MemoryDocumentRecord,
  SummaryDocumentRecord,
  UserDataExport,
} from "@nudge/db";

export type OkfProjectionInput = Pick<
  UserDataExport,
  "dailyNotes" | "extractedItems" | "memoryDocuments" | "summaryDocuments" | "user"
>;

export interface OkfProjection {
  readonly files: ReadonlyMap<string, string>;
  readonly userId: string;
}

export interface OkfSearchResult {
  readonly path: string;
  readonly snippet: string;
}

export const buildOkfProjection = (input: OkfProjectionInput): OkfProjection => {
  const files = new Map<string, string>();
  const dailyNotes = [...input.dailyNotes].sort((a, b) => a.localDate.localeCompare(b.localDate));
  const extractedItems = [...input.extractedItems].sort((a, b) => a.title.localeCompare(b.title));
  const memoryDocuments = [...input.memoryDocuments].sort((a, b) => a.title.localeCompare(b.title));
  const summaryDocuments = [...input.summaryDocuments].sort((a, b) =>
    a.periodStart.localeCompare(b.periodStart),
  );

  files.set(
    "/index.md",
    index("Nudge Workspace Knowledge", [
      ["Daily Notes", "daily/", `${dailyNotes.length} daily note${plural(dailyNotes.length)}`],
      [
        "Items",
        "items/",
        `${extractedItems.length} extracted item${plural(extractedItems.length)}`,
      ],
      [
        "Memory",
        "memory/",
        `${memoryDocuments.length} memory document${plural(memoryDocuments.length)}`,
      ],
      [
        "Summaries",
        "summaries/",
        `${summaryDocuments.length} summary document${plural(summaryDocuments.length)}`,
      ],
    ]),
  );

  files.set(
    "/daily/index.md",
    index(
      "Daily Notes",
      dailyNotes.map((note) => [note.title, `${note.localDate}.md`, firstLine(note.bodyText)]),
    ),
  );
  for (const note of dailyNotes) {
    files.set(`/daily/${note.localDate}.md`, dailyNoteFile(note));
  }

  files.set(
    "/items/index.md",
    index(
      "Items",
      extractedItems.map((item) => [`${item.title} (${item.status})`, `${item.id}.md`, item.body]),
    ),
  );
  for (const item of extractedItems) {
    files.set(`/items/${item.id}.md`, itemFile(item));
  }

  const memoryBySourceType = groupBy(memoryDocuments, (document) => document.sourceType);
  files.set(
    "/memory/index.md",
    index(
      "Memory",
      [...memoryBySourceType.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([sourceType, documents]) => [
          titleFromToken(sourceType),
          `${sourceType}/`,
          `${documents.length} document${plural(documents.length)}`,
        ]),
    ),
  );
  for (const [sourceType, documents] of memoryBySourceType.entries()) {
    files.set(
      `/memory/${sourceType}/index.md`,
      index(
        titleFromToken(sourceType),
        documents.map((document) => [
          document.title,
          `${document.id}.md`,
          firstLine(document.bodyText),
        ]),
      ),
    );
  }
  const dailyById = new Map(dailyNotes.map((note) => [note.id, note]));
  for (const document of memoryDocuments) {
    files.set(`/memory/${document.sourceType}/${document.id}.md`, memoryFile(document, dailyById));
  }

  files.set(
    "/summaries/index.md",
    index(
      "Summaries",
      summaryDocuments.map((summary) => [
        summary.title,
        `${summary.periodType}-${summary.periodStart}.md`,
        firstLine(summary.body),
      ]),
    ),
  );
  for (const summary of summaryDocuments) {
    files.set(`/summaries/${summary.periodType}-${summary.periodStart}.md`, summaryFile(summary));
  }

  return { files, userId: input.user.id };
};

export const listOkfDirectory = (projection: OkfProjection, path: string) => {
  const directory = normalizeDirectory(path);
  const prefix = directory === "/" ? "/" : `${directory}/`;
  const entries = new Set<string>();

  for (const filePath of projection.files.keys()) {
    if (!filePath.startsWith(prefix)) continue;
    const rest = filePath.slice(prefix.length);
    if (rest.length === 0) continue;
    entries.add(rest.split("/")[0] ?? rest);
  }

  return [...entries].sort((a, b) => a.localeCompare(b));
};

export const readOkfFile = (projection: OkfProjection, path: string) => {
  const file = projection.files.get(normalizeFile(path));
  if (file === undefined) throw new Error(`OKF file not found: ${path}`);
  return file;
};

export const searchOkfFiles = (
  projection: OkfProjection,
  query: string,
  limit = 10,
): ReadonlyArray<OkfSearchResult> => {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [];
  const results: OkfSearchResult[] = [];
  for (const [path, content] of projection.files.entries()) {
    if (path.endsWith("/index.md") || path === "/index.md") continue;
    const match = findOkfMatch(path, content, normalizedQuery);
    if (!match) continue;
    results.push({ path, snippet: match });
    if (results.length >= limit) break;
  }
  return results;
};

const dailyNoteFile = (note: DailyNoteRecord) =>
  concept(
    [
      ["type", "Daily Note"],
      ["title", note.title],
      ["description", firstLine(note.bodyText)],
      ["resource", `nudge://daily/${note.localDate}`],
      ["timestamp", note.updatedAt],
      ["tags", ["daily"]],
      ["source_id", note.id],
      ["local_date", note.localDate],
    ],
    note.bodyText,
  );

const itemFile = (item: ExtractedItemRecord) =>
  concept(
    [
      ["type", "Extracted Item"],
      ["title", item.title],
      ["description", firstLine(item.body)],
      ["resource", `nudge://items/${item.id}`],
      ["timestamp", item.updatedAt],
      ["tags", ["item", item.kind, item.status]],
      ["source_id", item.id],
      ["status", item.status],
    ],
    item.body,
  );

const memoryFile = (
  document: MemoryDocumentRecord,
  dailyById: ReadonlyMap<string, DailyNoteRecord>,
) => {
  const sourceNote =
    document.sourceType === "daily_note" ? dailyById.get(document.sourceId) : undefined;
  return concept(
    [
      ["type", "Memory Document"],
      ["title", document.title],
      ["description", firstLine(document.bodyText)],
      ["resource", `nudge://memory/${document.sourceType}/${document.id}`],
      ["timestamp", document.updatedAt],
      ["tags", ["memory", document.sourceType]],
      ["source_type", document.sourceType],
      ["source_id", document.sourceId],
      ...optionalLocalDateFrontmatter(document.localDate),
    ],
    `${document.bodyText}${sourceNote ? `\n\n# Source\n\n[${sourceNote.title}](../../daily/${sourceNote.localDate}.md)` : ""}`,
  );
};

const optionalLocalDateFrontmatter = (
  localDate: string | undefined,
): ReadonlyArray<FrontmatterEntry> => (localDate ? [["local_date", localDate]] : []);

const summaryFile = (summary: SummaryDocumentRecord) =>
  concept(
    [
      ["type", "Summary"],
      ["title", summary.title],
      ["description", firstLine(summary.body)],
      ["resource", `nudge://summaries/${summary.periodType}/${summary.periodStart}`],
      ["timestamp", summary.updatedAt],
      ["tags", ["summary", summary.periodType, summary.status]],
      ["period_type", summary.periodType],
      ["period_start", summary.periodStart],
      ["period_end", summary.periodEnd],
      ["status", summary.status],
    ],
    summary.body,
  );

type FrontmatterValue = string | ReadonlyArray<string>;
type FrontmatterEntry = readonly [string, FrontmatterValue];
type IndexEntry = readonly [title: string, href: string, description: string];

const concept = (frontmatter: ReadonlyArray<FrontmatterEntry>, body: string) =>
  `---\n${frontmatter.map(([key, value]) => yamlLine(key, value)).join("\n")}\n---\n\n${body.trim()}\n`;

const index = (title: string, entries: ReadonlyArray<IndexEntry>) => {
  const body = entries.length
    ? entries
        .map(
          ([label, href, description]) =>
            `* [${label}](${href}) - ${description || "No description."}`,
        )
        .join("\n")
    : "No entries yet.";
  return `# ${title}\n\n${body}\n`;
};

const yamlLine = (key: string, value: FrontmatterValue) =>
  Array.isArray(value)
    ? `${key}: [${value.map((item) => JSON.stringify(item)).join(", ")}]`
    : `${key}: ${JSON.stringify(value)}`;

const firstLine = (value: string) => value.trim().split(/\r?\n/, 1)[0]?.trim() ?? "";

const snippetFor = (value: string, matchIndex: number) => {
  const lineStart = value.lastIndexOf("\n", matchIndex) + 1;
  const lineEnd = value.indexOf("\n", matchIndex);
  return value.slice(lineStart, lineEnd === -1 ? undefined : lineEnd).trim();
};

const findOkfMatch = (path: string, content: string, normalizedQuery: string) => {
  const body = content.replace(/^---\n[\s\S]*?\n---\n+/, "");
  for (const haystack of [path, body, content]) {
    const matchIndex = haystack.toLowerCase().indexOf(normalizedQuery);
    if (matchIndex !== -1) return snippetFor(haystack, matchIndex);
  }
  return null;
};

const normalizeDirectory = (path: string) => {
  const normalized = normalizeFile(path);
  return normalized === "/" ? normalized : normalized.replace(/\/$/, "");
};

const normalizeFile = (path: string) => {
  const prefixed = path.startsWith("/") ? path : `/${path}`;
  return prefixed.replace(/\/+/g, "/");
};

const plural = (count: number) => (count === 1 ? "" : "s");

const titleFromToken = (value: string) =>
  value
    .split("_")
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");

const groupBy = <T>(values: ReadonlyArray<T>, keyFor: (value: T) => string) => {
  const groups = new Map<string, T[]>();
  for (const value of values) {
    const key = keyFor(value);
    const group = groups.get(key) ?? [];
    group.push(value);
    groups.set(key, group);
  }
  return groups;
};
