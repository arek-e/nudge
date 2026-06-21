CREATE TABLE IF NOT EXISTS `daily_notes` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `local_date` text NOT NULL,
  `title` text NOT NULL,
  `body_text` text NOT NULL,
  `body_document` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE no action ON DELETE no action
);

CREATE UNIQUE INDEX IF NOT EXISTS `daily_notes_user_date_idx` ON `daily_notes` (`user_id`, `local_date`);
CREATE INDEX IF NOT EXISTS `daily_notes_user_updated_idx` ON `daily_notes` (`user_id`, `updated_at`);

CREATE TABLE IF NOT EXISTS `note_revisions` (
  `id` text PRIMARY KEY NOT NULL,
  `note_id` text NOT NULL,
  `user_id` text NOT NULL,
  `revision_number` integer NOT NULL,
  `body_text` text NOT NULL,
  `changed_text` text NOT NULL,
  `change_hash` text NOT NULL,
  `created_at` text NOT NULL,
  `processed_at` text,
  FOREIGN KEY (`note_id`) REFERENCES `daily_notes` (`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE no action ON DELETE no action
);

CREATE UNIQUE INDEX IF NOT EXISTS `note_revisions_note_number_idx` ON `note_revisions` (`note_id`, `revision_number`);
CREATE UNIQUE INDEX IF NOT EXISTS `note_revisions_user_change_hash_idx` ON `note_revisions` (`user_id`, `change_hash`);
CREATE INDEX IF NOT EXISTS `note_revisions_user_created_idx` ON `note_revisions` (`user_id`, `created_at`);
CREATE INDEX IF NOT EXISTS `note_revisions_user_processed_idx` ON `note_revisions` (`user_id`, `processed_at`);

CREATE TABLE IF NOT EXISTS `extracted_items` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `source_revision_id` text NOT NULL,
  `source_note_id` text NOT NULL,
  `kind` text NOT NULL,
  `title` text NOT NULL,
  `body` text NOT NULL,
  `status` text NOT NULL,
  `due_at` text,
  `remind_at` text,
  `event_starts_at` text,
  `event_ends_at` text,
  `confidence` real NOT NULL,
  `dedupe_key` text NOT NULL,
  `metadata` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`source_revision_id`) REFERENCES `note_revisions` (`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`source_note_id`) REFERENCES `daily_notes` (`id`) ON UPDATE no action ON DELETE cascade
);

CREATE UNIQUE INDEX IF NOT EXISTS `extracted_items_user_dedupe_idx` ON `extracted_items` (`user_id`, `dedupe_key`);
CREATE INDEX IF NOT EXISTS `extracted_items_user_status_updated_idx` ON `extracted_items` (`user_id`, `status`, `updated_at`);
CREATE INDEX IF NOT EXISTS `extracted_items_user_kind_status_idx` ON `extracted_items` (`user_id`, `kind`, `status`);
CREATE INDEX IF NOT EXISTS `extracted_items_source_revision_idx` ON `extracted_items` (`source_revision_id`);

CREATE TABLE IF NOT EXISTS `item_events` (
  `id` text PRIMARY KEY NOT NULL,
  `item_id` text NOT NULL,
  `user_id` text NOT NULL,
  `event_type` text NOT NULL,
  `payload` text NOT NULL,
  `created_at` text NOT NULL,
  FOREIGN KEY (`item_id`) REFERENCES `extracted_items` (`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE no action ON DELETE no action
);

CREATE INDEX IF NOT EXISTS `item_events_item_created_idx` ON `item_events` (`item_id`, `created_at`);
CREATE INDEX IF NOT EXISTS `item_events_user_created_idx` ON `item_events` (`user_id`, `created_at`);

CREATE TABLE IF NOT EXISTS `summary_documents` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `period_type` text NOT NULL,
  `period_start` text NOT NULL,
  `period_end` text NOT NULL,
  `title` text NOT NULL,
  `body` text NOT NULL,
  `status` text NOT NULL,
  `generated_at` text NOT NULL,
  `source_note_ids` text NOT NULL,
  `source_item_ids` text NOT NULL,
  `metadata` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE no action ON DELETE no action
);

CREATE INDEX IF NOT EXISTS `summary_documents_user_period_idx` ON `summary_documents` (`user_id`, `period_type`, `period_start`);
CREATE INDEX IF NOT EXISTS `summary_documents_user_status_idx` ON `summary_documents` (`user_id`, `status`, `generated_at`);

CREATE TABLE IF NOT EXISTS `daily_agent_runs` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `trigger_type` text NOT NULL,
  `source_type` text NOT NULL,
  `source_id` text NOT NULL,
  `status` text NOT NULL,
  `model` text,
  `started_at` text NOT NULL,
  `completed_at` text,
  `error_code` text,
  `metadata` text NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE no action ON DELETE no action
);

CREATE INDEX IF NOT EXISTS `daily_agent_runs_user_status_started_idx` ON `daily_agent_runs` (`user_id`, `status`, `started_at`);
CREATE INDEX IF NOT EXISTS `daily_agent_runs_user_source_idx` ON `daily_agent_runs` (`user_id`, `source_type`, `source_id`);

CREATE TABLE IF NOT EXISTS `daily_agent_run_outputs` (
  `id` text PRIMARY KEY NOT NULL,
  `run_id` text NOT NULL,
  `output_type` text NOT NULL,
  `output_id` text NOT NULL,
  `created_at` text NOT NULL,
  FOREIGN KEY (`run_id`) REFERENCES `daily_agent_runs` (`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS `daily_agent_run_outputs_run_idx` ON `daily_agent_run_outputs` (`run_id`);
CREATE INDEX IF NOT EXISTS `daily_agent_run_outputs_output_idx` ON `daily_agent_run_outputs` (`output_type`, `output_id`);
