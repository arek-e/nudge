import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { VestaChat } from "@vesta/ui";

describe("VestaChat", () => {
  test("renders a shadcn-style conversation with draft context and composer controls", () => {
    const html = renderToStaticMarkup(
      <VestaChat
        messages={[
          {
            content: "What should I do next?",
            id: "user-1",
            role: "user",
          },
          {
            content: "I drafted a reviewable next step.",
            draftTitle: "Clarify the next step",
            id: "assistant-1",
            memoryCount: 1,
            role: "assistant",
          },
        ]}
        input="Follow up with Michael"
        sending={false}
        onInputChange={() => {}}
        onSubmit={() => {}}
      />,
    );

    expect(html).toContain('aria-label="Vesta chat"');
    expect(html).toContain('data-slot="message-scroller"');
    expect(html).toContain("What should I do next?");
    expect(html).toContain("I drafted a reviewable next step.");
    expect(html.indexOf("What should I do next?")).toBeLessThan(
      html.indexOf("I drafted a reviewable next step."),
    );
    expect(html).toContain("Review draft");
    expect(html).toContain("Clarify the next step");
    expect(html).toContain("1 memory");
    expect(html).toContain('aria-label="Message"');
    expect(html).toContain('aria-label="Send message"');
  });

  test("keeps the transcript chrome quiet when there is no memory context", () => {
    const html = renderToStaticMarkup(
      <VestaChat
        messages={[
          {
            content: "test",
            id: "user-1",
            role: "user",
          },
          {
            content: "I drafted a reviewable next step from your message.",
            draftTitle: "Clarify next attention point",
            id: "assistant-1",
            memoryCount: 0,
            role: "assistant",
          },
        ]}
        input=""
        sending={false}
        onInputChange={() => {}}
        onSubmit={() => {}}
      />,
    );

    expect(html).toContain("Clarify next attention point");
    expect(html).not.toContain("0 memories");
    expect(html).not.toContain('data-slot="message-avatar"');
  });

  test("renders the composer without a top divider", () => {
    const html = renderToStaticMarkup(
      <VestaChat
        messages={[]}
        input=""
        sending={false}
        onInputChange={() => {}}
        onSubmit={() => {}}
      />,
    );

    expect(html).toContain('aria-label="Message Vesta"');
    expect(html).not.toContain("shadow-[0_-1px_0_rgba");
  });

  test("renders only supported composer controls", () => {
    const html = renderToStaticMarkup(
      <VestaChat
        messages={[]}
        input=""
        sending={false}
        onInputChange={() => {}}
        onSubmit={() => {}}
      />,
    );

    expect(html).toContain('data-slot="chat-composer-surface"');
    expect(html).toContain('placeholder="Message Vesta"');
    expect(html).toContain("bg-[#1d1d1d]");
    expect(html).toContain("text-white");
    expect(html).toContain('aria-label="Send message"');
    expect(html).not.toContain("bg-[#f7f7f4]");
    expect(html).not.toContain("text-[#242424]");
    expect(html).not.toContain("Full access");
    expect(html).not.toContain("Extra High");
    expect(html).not.toContain('aria-label="Voice input"');
    expect(html).not.toContain('aria-label="Model 5.5 Extra High"');
  });

  test("renders attachment picker, pending files, and dropzone", () => {
    const html = renderToStaticMarkup(
      <VestaChat
        attachments={[
          { id: "image-1", name: "diagram.png", size: 2048, type: "image/png" },
          { id: "doc-1", name: "brief.pdf", size: 4096, type: "application/pdf" },
        ]}
        messages={[]}
        input=""
        sending={false}
        onAttachmentsAdd={() => {}}
        onAttachmentRemove={() => {}}
        onInputChange={() => {}}
        onSubmit={() => {}}
      />,
    );

    expect(html).toContain('data-slot="chat-composer-dropzone"');
    expect(html).toContain('aria-label="Attach files"');
    expect(html).toContain('accept="image/*,.pdf,.doc,.docx,.txt,.md"');
    expect(html).toContain('data-slot="chat-attachment-list"');
    expect(html).toContain("2 files attached");
    expect(html).toContain("diagram.png");
    expect(html).toContain("brief.pdf");
    expect(html).toContain("2 KB");
    expect(html).toContain("4 KB");
    expect(html).toContain('aria-label="Remove diagram.png"');
    expect(html).toContain('aria-label="Remove brief.pdf"');
  });

  test("uses a sequenced dot-matrix loader for active thinking state", () => {
    const html = renderToStaticMarkup(
      <VestaChat
        messages={[
          {
            content: "What should I do next?",
            id: "user-1",
            role: "user",
          },
        ]}
        input=""
        sending
        onInputChange={() => {}}
        onSubmit={() => {}}
      />,
    );

    expect(html).toContain('data-slot="dot-matrix-loader"');
    expect(html).toContain('data-state="thinking"');
    expect(html).toContain('data-registry-loader="dotm-thinking-sequence"');
    expect(html).toContain('data-slot="dot-matrix-loader-stage"');
    expect(html).toContain('data-registry-loader-stage="dotm-circular-3"');
    expect(html).toContain('data-registry-loader-stage="dotm-circular-8"');
    expect(html).toContain('data-registry-loader-stage="dotm-circular-17"');
    expect(html).toContain('data-tone="cyan"');
    expect(html).toContain("dmx-root");
    expect(html).toContain("dmx-thinking-sequence");
    expect(html).toContain("dmx-tone-cyan");
    expect(html).toContain("Thinking...");
    expect(html).not.toContain("#d6c8ff");
    expect(html).not.toContain("#a7f3d0");
    expect(html.match(/data-slot="dot-matrix-loader-stage"/g)?.length).toBe(3);
  });

  test("keeps dot-matrix loaders out of streaming message text", () => {
    const html = renderToStaticMarkup(
      <VestaChat
        activities={[{ id: "tool-1", kind: "tool", label: "Searching memory" }]}
        messages={[
          {
            content: "I'll draft",
            id: "assistant-1",
            role: "assistant",
            streaming: true,
          },
        ]}
        input=""
        sending
        onInputChange={() => {}}
        onSubmit={() => {}}
      />,
    );

    expect(html).toContain('data-state="tool"');
    expect(html).toContain('data-registry-loader="dotm-square-3"');
    expect(html).toContain('data-tone="amber"');
    expect(html).toContain("dmx-transitioning");
    expect(html).toContain("dmx-tone-amber");
    expect(html).toContain("dmx-spiral-snake");
    expect(html).toContain('data-slot="streaming-cursor"');
    expect(html).not.toContain('data-state="streaming"');
    expect(html).not.toContain("dmx-state-streaming");
  });

  test("groups active tool work into one collapsible step rail", () => {
    const html = renderToStaticMarkup(
      <VestaChat
        activities={[
          { id: "tool-1", kind: "tool", label: "Searching memory" },
          { id: "tool-2", kind: "tool", label: "Drafting proposal" },
        ]}
        messages={[{ content: "What should I do next?", id: "user-1", role: "user" }]}
        input=""
        sending
        onInputChange={() => {}}
        onSubmit={() => {}}
      />,
    );

    expect(html).toContain('data-slot="activity-steps"');
    expect(html).toContain('data-slot="activity-step-rail"');
    expect(html).toContain("Working");
    expect(html).toContain("2 steps");
    expect(html).toContain("Searching memory");
    expect(html).toContain("Drafting proposal");
    expect(html.match(/data-slot="activity-step"/g)?.length).toBe(2);
    expect(html.match(/data-slot="dot-matrix-loader"/g)?.length).toBe(1);
  });

  test("keeps pre-response work ordered and minimized once assistant content follows", () => {
    const html = renderToStaticMarkup(
      <VestaChat
        events={[
          { content: "What should I do next?", id: "user-1", role: "user", type: "message" },
          {
            id: "tool-1",
            kind: "tool",
            label: "Searching memory",
            status: "complete",
            type: "activity",
          },
          {
            id: "tool-2",
            kind: "tool",
            label: "Drafting proposal",
            status: "complete",
            type: "activity",
          },
          {
            content: "I drafted a reviewable next step.",
            id: "assistant-1",
            role: "assistant",
            type: "message",
          },
        ]}
        messages={[]}
        input=""
        sending={false}
        onInputChange={() => {}}
        onSubmit={() => {}}
      />,
    );

    expect(html).toContain('data-minimized="true"');
    expect(html).toContain('data-status="complete"');
    expect(html).not.toContain("No messages yet");
    expect(html).not.toContain('data-slot="dot-matrix-loader"');
    expect(html.indexOf("What should I do next?")).toBeLessThan(
      html.indexOf('data-slot="activity-steps"'),
    );
    expect(html.indexOf('data-slot="activity-steps"')).toBeLessThan(
      html.indexOf("I drafted a reviewable next step."),
    );
  });
});
