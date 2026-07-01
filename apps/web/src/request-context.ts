import type { Handler } from "hono";
import type { ObservabilityHonoEnv } from "./observability";
import type { LaresAppService, RunEffect } from "./Services/LaresApp";

export type HonoHandlerContext = Parameters<Handler<ObservabilityHonoEnv>>[0];

export type RequestSession = {
  readonly authMode: "better-auth" | "dev" | "unauthenticated";
  readonly user: {
    readonly id: string;
    readonly displayName: string;
  } | null;
};

export type ResolveRequestApp = (c: HonoHandlerContext) => Promise<{
  readonly appServices: LaresAppService;
  readonly runEffect: RunEffect;
}>;
