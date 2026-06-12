CREATE TABLE `commitments` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `proposal_id` text NOT NULL,
  `review_id` text NOT NULL,
  `title` text NOT NULL,
  `body` text NOT NULL,
  `status` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`proposal_id`) REFERENCES `proposals`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`review_id`) REFERENCES `reviews`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX `commitments_user_status_created_idx` ON `commitments` (`user_id`, `status`, `created_at`);
CREATE INDEX `commitments_proposal_idx` ON `commitments` (`proposal_id`);
CREATE INDEX `commitments_review_idx` ON `commitments` (`review_id`);
