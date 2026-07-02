import type { Sandbox } from "@cloudflare/sandbox";

export interface Env {
  DB: D1Database;
  MEDIA_FILES?: R2Bucket;
  OKF_FILES?: R2Bucket;
  TRACE_ARTIFACTS: R2Bucket;
  DAILY_DIGEST_WORKFLOW: Workflow;
  USER_AGENT_SESSION: DurableObjectNamespace;
  OKF_SANDBOX?: DurableObjectNamespace<Sandbox>;
  ENVIRONMENT?: string;
  APP_VERSION?: string;
  LOG_HTTP_REQUESTS?: string;
  BRAINTRUST_API_KEY?: string;
  AGENT_INTERNAL_SECRET?: string;
  CLERK_AUTHORIZED_PARTIES?: string;
  CLERK_PUBLISHABLE_KEY?: string;
  CLERK_SECRET_KEY?: string;
  CONVEX_RUNTIME_SECRET?: string;
  CONVEX_URL?: string;
  AI: Ai;
  EXTRACTION_MODEL?: string;
  THINK_MODEL: string;
  TURBOPUFFER_API_KEY?: string;
  TURBOPUFFER_REGION?: string;
}
