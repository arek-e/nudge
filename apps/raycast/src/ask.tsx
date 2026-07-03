import { Action, ActionPanel, Detail, Form, Toast, showToast } from "@raycast/api";
import { type ReactElement, useState } from "react";
import { askRaycastNudge } from "./ask-service";
import { raycastEngineClient } from "./engine-client";

interface AskFormValues {
  readonly message: string;
}

export default function Command(): ReactElement {
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function submit(values: AskFormValues) {
    setIsLoading(true);
    try {
      const response = await askRaycastNudge({ message: values.message }, () =>
        raycastEngineClient<Preferences.Ask>(),
      );
      setMessage("");
      setReply(response.reply);
      await showToast({ style: Toast.Style.Success, title: "Nudge replied" });
    } catch (error) {
      await showToast({
        message: error instanceof Error ? error.message : "Could not ask Nudge",
        style: Toast.Style.Failure,
        title: "Ask failed",
      });
    } finally {
      setIsLoading(false);
    }
  }

  if (reply) {
    return (
      <Detail
        isLoading={isLoading}
        markdown={reply}
        actions={
          <ActionPanel>
            <Action title="Ask Another Question" onAction={() => setReply("")} />
          </ActionPanel>
        }
      />
    );
  }

  return (
    <Form
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Ask Nudge" onSubmit={submit} />
        </ActionPanel>
      }
    >
      <Form.TextArea
        id="message"
        title="Question"
        placeholder="What should I do next?"
        value={message}
        onChange={setMessage}
      />
    </Form>
  );
}
