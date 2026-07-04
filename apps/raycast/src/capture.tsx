import { Action, ActionPanel, Form, Toast, showToast } from "@raycast/api";
import { type ReactElement, useState } from "react";
import { appendRaycastCapture } from "./capture-service";
import { raycastEngineClient } from "./engine-client";

interface CaptureFormValues {
  readonly note: string;
}

export default function Command(): ReactElement {
  const [note, setNote] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function submit(values: CaptureFormValues) {
    const trimmed = values.note.trim();
    if (!trimmed) {
      await showToast({ style: Toast.Style.Failure, title: "Write a note first" });
      return;
    }

    setIsLoading(true);
    try {
      await appendRaycastCapture({ note: trimmed }, () =>
        raycastEngineClient<Preferences.Capture>(),
      );
      setNote("");
      await showToast({ style: Toast.Style.Success, title: "Captured in Nudge" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not capture in Nudge";
      await showToast({ message, style: Toast.Style.Failure, title: "Capture failed" });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Capture in Nudge" onSubmit={submit} />
        </ActionPanel>
      }
    >
      <Form.TextArea
        id="note"
        title="Note"
        placeholder="What should Nudge remember?"
        value={note}
        onChange={setNote}
      />
    </Form>
  );
}
