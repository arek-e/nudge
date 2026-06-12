CREATE TABLE `trace_events` (
  `id` text PRIMARY KEY NOT NULL,
  `timestamp` text NOT NULL,
  `event` text NOT NULL,
  `log_kind` text NOT NULL,
  `service` text NOT NULL,
  `environment` text NOT NULL,
  `version` text NOT NULL,
  `request_id` text,
  `route_name` text,
  `method` text,
  `path` text,
  `status` integer,
  `outcome` text,
  `duration_ms` real,
  `sample_reason` text,
  `artifact_key` text,
  `payload` text NOT NULL,
  `created_at` text NOT NULL
);

CREATE INDEX `trace_events_timestamp_idx` ON `trace_events` (`timestamp`);
CREATE INDEX `trace_events_request_id_idx` ON `trace_events` (`request_id`);
CREATE INDEX `trace_events_route_timestamp_idx` ON `trace_events` (`route_name`, `timestamp`);
CREATE INDEX `trace_events_outcome_timestamp_idx` ON `trace_events` (`outcome`, `timestamp`);

CREATE TABLE `agent_runs` (
  `id` text PRIMARY KEY NOT NULL,
  `trace_id` text,
  `user_id` text,
  `agent_name` text NOT NULL,
  `status` text NOT NULL,
  `started_at` text NOT NULL,
  `completed_at` text,
  `summary` text,
  `artifact_key` text,
  `created_at` text NOT NULL,
  FOREIGN KEY (`trace_id`) REFERENCES `trace_events`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE INDEX `agent_runs_started_at_idx` ON `agent_runs` (`started_at`);
CREATE INDEX `agent_runs_user_started_at_idx` ON `agent_runs` (`user_id`, `started_at`);

CREATE TABLE `eval_runs` (
  `id` text PRIMARY KEY NOT NULL,
  `suite_name` text NOT NULL,
  `status` text NOT NULL,
  `started_at` text NOT NULL,
  `completed_at` text,
  `summary` text,
  `artifact_key` text,
  `created_at` text NOT NULL
);

CREATE INDEX `eval_runs_started_at_idx` ON `eval_runs` (`started_at`);

CREATE TABLE `eval_case_results` (
  `id` text PRIMARY KEY NOT NULL,
  `eval_run_id` text NOT NULL,
  `case_id` text NOT NULL,
  `passed` integer NOT NULL,
  `score` real,
  `notes` text,
  `artifact_key` text,
  `created_at` text NOT NULL,
  FOREIGN KEY (`eval_run_id`) REFERENCES `eval_runs`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX `eval_case_results_run_idx` ON `eval_case_results` (`eval_run_id`);
CREATE INDEX `eval_case_results_case_idx` ON `eval_case_results` (`case_id`);
