CREATE TABLE `users` (
  `id` text PRIMARY KEY NOT NULL,
  `display_name` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);

CREATE TABLE `events` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `type` text NOT NULL,
  `source` text NOT NULL,
  `occurred_at` text NOT NULL,
  `schema_version` text NOT NULL,
  `payload` text NOT NULL,
  `created_at` text NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE INDEX `events_user_occurred_at_idx` ON `events` (`user_id`, `occurred_at`);
CREATE INDEX `events_user_created_at_idx` ON `events` (`user_id`, `created_at`);
