import type { Handler } from "hono";
import type { ObservabilityHonoEnv } from "./observability";
import type { NudgeAppService, RunEffect } from "./Services/NudgeApp";

export type HonoHandlerContext = Parameters<Handler<ObservabilityHonoEnv>>[0];

export type RequestSession = {
  readonly authMode: "clerk" | "unauthenticated";
  readonly user: {
    readonly id: string;
    readonly displayName: string;
  } | null;
};

export type ResolveRequestApp = (c: HonoHandlerContext) => Promise<{
  readonly appServices: NudgeAppService;
  readonly runEffect: RunEffect;
}>;
