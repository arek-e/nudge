CREATE TABLE `trace_spans` (
  `trace_id` text NOT NULL,
  `span_id` text PRIMARY KEY NOT NULL,
  `parent_span_id` text,
  `name` text NOT NULL,
  `kind` text NOT NULL,
  `status` text NOT NULL,
  `started_at` text NOT NULL,
  `ended_at` text,
  `duration_ms` real,
  `service` text NOT NULL,
  `environment` text NOT NULL,
  `version` text NOT NULL,
  `request_id` text,
  `route_name` text,
  `method` text,
  `path` text,
  `http_status` integer,
  `outcome` text,
  `attributes` text NOT NULL,
  `created_at` text NOT NULL
);

CREATE INDEX `trace_spans_trace_started_idx` ON `trace_spans` (`trace_id`, `started_at`);
CREATE INDEX `trace_spans_parent_idx` ON `trace_spans` (`parent_span_id`);
CREATE INDEX `trace_spans_route_started_idx` ON `trace_spans` (`route_name`, `started_at`);
CREATE INDEX `trace_spans_status_started_idx` ON `trace_spans` (`status`, `started_at`);
