export interface Env {
  DB: D1Database;
  OKF_FILES?: R2Bucket;
  TRACE_ARTIFACTS: R2Bucket;
  DAILY_DIGEST_WORKFLOW: Workflow;
  USER_AGENT_SESSION: DurableObjectNamespace;
  OKF_SANDBOX?: DurableObjectNamespace;
  ENVIRONMENT?: string;
  APP_VERSION?: string;
  LOG_HTTP_REQUESTS?: string;
  BRAINTRUST_API_KEY?: string;
  BETTER_AUTH_SECRET?: string;
  AGENT_INTERNAL_SECRET?: string;
  BETTER_AUTH_URL?: string;
  BETTER_AUTH_ALLOW_SIGN_UP?: string;
  AUTH_SEED_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  SEND_EMAIL?: SendEmail;
  AI: Ai;
  THINK_MODEL: string;
  TURBOPUFFER_API_KEY?: string;
  TURBOPUFFER_REGION?: string;
}
