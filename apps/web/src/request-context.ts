import type { Handler } from "hono";
import type { ObservabilityHonoEnv } from "./observability";
import type { VestaAppService, RunEffect } from "./Services/VestaApp";

export type HonoHandlerContext = Parameters<Handler<ObservabilityHonoEnv>>[0];

export type RequestSession = {
  readonly authMode: "anonymous" | "clerk" | "unauthenticated";
  readonly user: {
    readonly id: string;
    readonly displayName: string;
  } | null;
};

export type ResolveRequestApp = (c: HonoHandlerContext) => Promise<{
  readonly appServices: VestaAppService;
  readonly runEffect: RunEffect;
}>;
