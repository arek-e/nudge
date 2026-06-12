CREATE TABLE `proposals` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `synthesis_id` text NOT NULL,
  `kind` text NOT NULL,
  `status` text NOT NULL,
  `title` text NOT NULL,
  `body` text NOT NULL,
  `rationale` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`synthesis_id`) REFERENCES `syntheses`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE INDEX `proposals_user_status_created_idx` ON `proposals` (`user_id`, `status`, `created_at`);
CREATE INDEX `proposals_synthesis_idx` ON `proposals` (`synthesis_id`);

CREATE TABLE `reviews` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `proposal_id` text NOT NULL,
  `decision` text NOT NULL,
  `edited_title` text,
  `edited_body` text,
  `created_at` text NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`proposal_id`) REFERENCES `proposals`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX `reviews_user_created_idx` ON `reviews` (`user_id`, `created_at`);
CREATE INDEX `reviews_proposal_idx` ON `reviews` (`proposal_id`);
