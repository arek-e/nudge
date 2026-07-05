import { Action, ActionPanel, Icon, List, Toast, showToast } from "@raycast/api";
import { type ReactElement, useEffect, useState } from "react";
import type { SurfaceActionReviewStatus, SurfaceRefreshContext } from "@nudge/surface";
import { reviewRaycastAction } from "./action-service";
import { refreshRaycastCurrentContext } from "./context-service";
import { buildRaycastContextSections, type RaycastContextItem } from "./context-summary";
import { raycastEngineClient } from "./engine-client";
import { captureRaycastException, initializeRaycastSentry } from "./sentry";

initializeRaycastSentry("current-context");

interface CurrentContextState {
  readonly context?: SurfaceRefreshContext;
  readonly errorMessage?: string;
  readonly isLoading: boolean;
}

export default function Command(): ReactElement {
  const [state, setState] = useState<CurrentContextState>({ isLoading: true });
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadContext() {
      setState((current) => ({ ...current, isLoading: true }));
      try {
        const context = await refreshRaycastCurrentContext(() =>
          raycastEngineClient<Preferences.CurrentContext>(),
        );
        if (!cancelled) setState({ context, isLoading: false });
      } catch (error) {
        await captureRaycastException(error, {
          command: "current-context",
          operation: "refresh",
        });
        const errorMessage =
          error instanceof Error ? error.message : "Could not load Nudge context";
        if (!cancelled) setState({ errorMessage, isLoading: false });
        await showToast({
          message: errorMessage,
          style: Toast.Style.Failure,
          title: "Refresh failed",
        });
      }
    }

    void loadContext();
    return () => {
      cancelled = true;
    };
  }, [reloadCount]);

  const sections = state.context ? buildRaycastContextSections(state.context) : [];
  const refresh = () => setReloadCount((current) => current + 1);
  async function reviewAction(itemId: string, status: SurfaceActionReviewStatus) {
    setState((current) => ({ ...current, isLoading: true }));
    try {
      await reviewRaycastAction({ itemId, status }, () =>
        raycastEngineClient<Preferences.CurrentContext>(),
      );
      await showToast({
        style: Toast.Style.Success,
        title: actionReviewSuccessTitle(status),
      });
      refresh();
    } catch (error) {
      await captureRaycastException(error, {
        command: "current-context",
        operation: "review-action",
      });
      await showToast({
        message: error instanceof Error ? error.message : "Could not update action",
        style: Toast.Style.Failure,
        title: "Action update failed",
      });
      setState((current) => ({ ...current, isLoading: false }));
    }
  }

  return (
    <List isLoading={state.isLoading} searchBarPlaceholder="Search Nudge context">
      {sections.length === 0 ? (
        <List.EmptyView
          icon={Icon.AppWindowList}
          title={state.errorMessage ?? "No Nudge context loaded"}
          description="Refresh to load the latest journal, actions, signals, and AI review status."
          actions={
            <ActionPanel>
              <Action title="Refresh" icon={Icon.ArrowClockwise} onAction={refresh} />
            </ActionPanel>
          }
        />
      ) : (
        sections.map((section) => (
          <List.Section key={section.title} title={section.title}>
            {section.items.map((item) => (
              <List.Item
                key={item.id}
                id={item.id}
                title={item.title}
                subtitle={item.subtitle}
                accessories={item.accessories}
                actions={
                  <ActionPanel>
                    <Action title="Refresh" icon={Icon.ArrowClockwise} onAction={refresh} />
                    <ReviewActions item={item} onReview={reviewAction} />
                  </ActionPanel>
                }
              />
            ))}
          </List.Section>
        ))
      )}
    </List>
  );
}

function ReviewActions(props: {
  readonly item: RaycastContextItem;
  readonly onReview: (itemId: string, status: SurfaceActionReviewStatus) => Promise<void>;
}) {
  if (!props.item.reviewActionId) return null;
  const reviewActionId = props.item.reviewActionId;
  return (
    <>
      <Action
        title="Accept"
        icon={Icon.CheckCircle}
        onAction={() => void props.onReview(reviewActionId, "accepted")}
      />
      <Action
        title="Mark Done"
        icon={Icon.Checkmark}
        onAction={() => void props.onReview(reviewActionId, "completed")}
      />
      <Action
        title="Dismiss"
        icon={Icon.XMarkCircle}
        onAction={() => void props.onReview(reviewActionId, "dismissed")}
      />
    </>
  );
}

function actionReviewSuccessTitle(status: SurfaceActionReviewStatus) {
  switch (status) {
    case "accepted":
      return "Action accepted";
    case "completed":
      return "Action completed";
    case "dismissed":
      return "Action dismissed";
  }
}
