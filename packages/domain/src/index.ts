export type UserId = string;

export type ReviewQueueItemType =
  | "memory_proposal"
  | "action_point"
  | "calendar_draft"
  | "relationship_memory_update"
  | "routine_change"
  | "consent_grant";

export interface DevUser {
  id: UserId;
  displayName: string;
}

export type ProposalKind = "clarify" | "follow_up" | "commit" | "ignore";

export interface SignalLike {
  readonly id: string;
  readonly payload: unknown;
  readonly type: string;
}

export interface FrameInput {
  readonly userId: string;
  readonly key: string;
  readonly title: string;
  readonly prompt: string;
}

export interface SynthesisInput {
  readonly userId: string;
  readonly frameId: string;
  readonly summary: string;
  readonly themes: ReadonlyArray<string>;
  readonly openQuestions: ReadonlyArray<string>;
  readonly sourceSignalIds: ReadonlyArray<string>;
}

export interface ProposalInput {
  readonly userId: string;
  readonly synthesisId: string;
  readonly kind: ProposalKind;
  readonly title: string;
  readonly body: string;
  readonly rationale: string;
}

export const defaultFrame = (userId: string, key: string): FrameInput => ({
  userId,
  key,
  title: key === "current_state" ? "What matters now?" : key,
  prompt: "Synthesize recent signals into current context.",
});

export const buildDeterministicSynthesis = (input: {
  readonly userId: string;
  readonly frameId: string;
  readonly signals: ReadonlyArray<SignalLike>;
}): SynthesisInput => {
  const latestNote = noteFromPayload(input.signals[0]?.payload);
  const themes = [...new Set(input.signals.flatMap((signal) => themesFromSignal(signal)))];
  const openQuestions = openQuestionsFromNote(latestNote);

  return {
    userId: input.userId,
    frameId: input.frameId,
    summary:
      input.signals.length === 0
        ? "No recent signals captured."
        : `${input.signals.length} signal${input.signals.length === 1 ? "" : "s"} captured. Latest: ${latestNote}`,
    themes: themes.length > 0 ? themes : ["current-context"],
    openQuestions,
    sourceSignalIds: input.signals.map((signal) => signal.id),
  };
};

export const buildDeterministicProposals = (input: {
  readonly userId: string;
  readonly synthesisId: string;
  readonly openQuestions: ReadonlyArray<string>;
  readonly themes: ReadonlyArray<string>;
}): ReadonlyArray<ProposalInput> => {
  const [firstQuestion] = input.openQuestions;
  const followUp = firstQuestion ? followUpFromQuestion(firstQuestion) : undefined;
  if (followUp) {
    return [
      {
        userId: input.userId,
        synthesisId: input.synthesisId,
        kind: "follow_up",
        title: followUp.title,
        body: followUp.body,
        rationale: "Created from follow-up language in the captured signal.",
      },
    ];
  }

  if (firstQuestion) {
    return [
      {
        userId: input.userId,
        synthesisId: input.synthesisId,
        kind: "clarify",
        title: "Clarify next attention point",
        body: `Answer: ${firstQuestion}`,
        rationale: "Created from an open question in the synthesis.",
      },
    ];
  }

  if (input.themes.includes("travel")) {
    return [
      {
        userId: input.userId,
        synthesisId: input.synthesisId,
        kind: "follow_up",
        title: "Review travel constraints",
        body: "Check whether travel changes what needs attention next.",
        rationale: "Created from a travel theme in the synthesis.",
      },
    ];
  }

  return [
    {
      userId: input.userId,
      synthesisId: input.synthesisId,
      kind: "clarify",
      title: "Capture more context",
      body: "Add another capture so Lares has enough context to help.",
      rationale: "Created because there were no open questions or specific themes.",
    },
  ];
};

const noteFromPayload = (payload: unknown) => {
  if (
    payload &&
    typeof payload === "object" &&
    "note" in payload &&
    typeof payload.note === "string"
  ) {
    return payload.note;
  }

  return "No note available";
};

const themesFromSignal = (signal: SignalLike) => {
  const note = noteFromPayload(signal.payload).toLowerCase();
  const themes = [];
  if (note.includes("travel") || note.includes("traveling")) themes.push("travel");
  if (note.includes("follow up") || note.includes("follow-up")) themes.push("follow-up");
  if (note.includes("work") || signal.type.includes("work")) themes.push("work");
  return themes;
};

const openQuestionsFromNote = (note: string) => {
  if (note === "No note available") return ["What needs attention next?"];
  if (note.toLowerCase().includes("follow up") || note.toLowerCase().includes("follow-up")) {
    return [note];
  }
  return ["What needs attention next?"];
};

const followUpFromQuestion = (question: string) => {
  const match =
    /follow[- ]up with (?<person>[^.]+?) about (?<topic>[^.]+?)(?: before| by| today| tomorrow|\.|$)/i.exec(
      question,
    );
  const personMatch = match?.groups?.person;
  const topicMatch = match?.groups?.topic;
  if (!personMatch || !topicMatch) return undefined;
  const person = personMatch.trim();
  const topic = topicMatch.trim().replace(/^the\s+/i, "");
  return {
    title: `Follow up on ${topic}`,
    body: `Follow up with ${person} about ${topic}.`,
  };
};
