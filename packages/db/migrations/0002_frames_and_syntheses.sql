CREATE TABLE `frames` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `key` text NOT NULL,
  `title` text NOT NULL,
  `prompt` text NOT NULL,
  `status` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE UNIQUE INDEX `frames_user_key_idx` ON `frames` (`user_id`, `key`);
CREATE INDEX `frames_user_status_idx` ON `frames` (`user_id`, `status`);

CREATE TABLE `syntheses` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `frame_id` text NOT NULL,
  `summary` text NOT NULL,
  `themes` text NOT NULL,
  `open_questions` text NOT NULL,
  `generated_at` text NOT NULL,
  `created_at` text NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`frame_id`) REFERENCES `frames`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE INDEX `syntheses_user_frame_generated_idx` ON `syntheses` (`user_id`, `frame_id`, `generated_at`);

CREATE TABLE `synthesis_sources` (
  `synthesis_id` text NOT NULL,
  `signal_id` text NOT NULL,
  PRIMARY KEY (`synthesis_id`, `signal_id`),
  FOREIGN KEY (`synthesis_id`) REFERENCES `syntheses`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`signal_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE INDEX `synthesis_sources_signal_idx` ON `synthesis_sources` (`signal_id`);
