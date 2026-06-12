CREATE TABLE `outcomes` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `commitment_id` text NOT NULL,
  `result` text NOT NULL,
  `note` text,
  `recorded_at` text NOT NULL,
  `created_at` text NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`commitment_id`) REFERENCES `commitments`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX `outcomes_user_recorded_idx` ON `outcomes` (`user_id`, `recorded_at`);
CREATE INDEX `outcomes_commitment_idx` ON `outcomes` (`commitment_id`);
