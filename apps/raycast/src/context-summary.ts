import { noteTextFromPayload, type SurfaceRefreshContext } from "@nudge/surface";

interface RaycastContextAccessory {
  readonly text: string;
}

export interface RaycastContextItem {
  readonly accessories: RaycastContextAccessory[];
  readonly id: string;
  readonly reviewActionId?: string;
  readonly subtitle: string;
  readonly title: string;
}

export interface RaycastContextSection {
  readonly items: ReadonlyArray<RaycastContextItem>;
  readonly title: string;
}

function compactText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function previewText(value: string, fallback: string) {
  const compact = compactText(value);
  if (!compact) return fallback;
  return compact.length > 120 ? `${compact.slice(0, 117)}...` : compact;
}

function metadataProperty(value: unknown, key: string) {
  return typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined;
}

function metadataString(value: unknown, key: string) {
  const property = metadataProperty(value, key);
  return typeof property === "string" ? property : undefined;
}

function metadataNumber(value: unknown, key: string) {
  const property = metadataProperty(value, key);
  return typeof property === "number" ? property : undefined;
}

function openLoopStatus(status: string) {
  return status === "proposed" || status === "accepted";
}

function itemCountLabel(count: number | undefined) {
  if (count === undefined) return "active";
  return `${count} item${count === 1 ? "" : "s"}`;
}

function latestRunSubtitle(metadata: unknown, status: string) {
  const provider = metadataString(metadata, "provider");
  return provider ? `${status} via ${provider}` : status;
}

export function buildRaycastContextSections(
  context: SurfaceRefreshContext,
): ReadonlyArray<RaycastContextSection> {
  const openActions = context.actions.actions.filter((action) => openLoopStatus(action.status));
  const todayItems: RaycastContextItem[] = [];

  if (context.journal) {
    todayItems.push({
      accessories: [{ text: context.journal.localDate }],
      id: "journal",
      subtitle: previewText(context.journal.bodyText, "No journal text yet"),
      title: context.journal.title || "Journal",
    });
  }

  todayItems.push({
    accessories: [{ text: String(openActions.length) }],
    id: "open-loops",
    subtitle: "Proposed or accepted actions",
    title: "Open loops",
  });

  if (context.actions.latestRun) {
    const latestRun = context.actions.latestRun;
    todayItems.push({
      accessories: [{ text: itemCountLabel(metadataNumber(latestRun.metadata, "itemCount")) }],
      id: "latest-run",
      subtitle: latestRunSubtitle(latestRun.metadata, latestRun.status),
      title: "AI review",
    });
  }

  const sections: RaycastContextSection[] = [{ items: todayItems, title: "Today" }];

  if (openActions.length > 0) {
    sections.push({
      items: openActions.map((action) => ({
        accessories: [{ text: action.status }],
        id: action.id,
        reviewActionId: action.id,
        subtitle: previewText(action.body, action.kind),
        title: action.title,
      })),
      title: "Actions",
    });
  }

  if (context.signals.length > 0) {
    sections.push({
      items: context.signals.slice(0, 8).map((signal) => ({
        accessories: [{ text: signal.source }],
        id: signal.id,
        subtitle: previewText(noteTextFromPayload(signal.payload), signal.occurredAt),
        title: signal.type,
      })),
      title: "Signals",
    });
  }

  return sections;
}
