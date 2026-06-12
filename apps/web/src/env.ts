export interface Env {
  DB: D1Database;
  DAILY_DIGEST_WORKFLOW: Workflow;
  USER_AGENT_SESSION: DurableObjectNamespace;
  ENVIRONMENT?: string;
  APP_VERSION?: string;
}
