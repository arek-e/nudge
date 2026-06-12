export interface Env {
  DB: D1Database;
  TRACE_ARTIFACTS: R2Bucket;
  DAILY_DIGEST_WORKFLOW: Workflow;
  USER_AGENT_SESSION: DurableObjectNamespace;
  ENVIRONMENT?: string;
  APP_VERSION?: string;
  LOG_HTTP_REQUESTS?: string;
}
