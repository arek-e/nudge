export interface Env {
  DB: D1Database;
  TRACE_ARTIFACTS: R2Bucket;
  DAILY_DIGEST_WORKFLOW: Workflow;
  USER_AGENT_SESSION: DurableObjectNamespace;
  ENVIRONMENT?: string;
  APP_VERSION?: string;
  LOG_HTTP_REQUESTS?: string;
  BETTER_AUTH_SECRET?: string;
  AGENT_INTERNAL_SECRET?: string;
  BETTER_AUTH_URL?: string;
  BETTER_AUTH_ALLOW_SIGN_UP?: string;
  AUTH_SEED_SECRET?: string;
  AI: Ai;
  THINK_MODEL: string;
  TURBOPUFFER_API_KEY?: string;
  TURBOPUFFER_REGION?: string;
}
