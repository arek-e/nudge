CREATE TABLE `journal_documents` (
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

CREATE UNIQUE INDEX `journal_documents_user_date_idx` ON `journal_documents` (`user_id`, `local_date`);
CREATE INDEX `journal_documents_user_updated_idx` ON `journal_documents` (`user_id`, `updated_at`);

CREATE TABLE `journal_revisions` (
  `id` text PRIMARY KEY NOT NULL,
  `document_id` text NOT NULL,
  `user_id` text NOT NULL,
  `body_text` text NOT NULL,
  `changed_text` text NOT NULL,
  `diff_summary` text NOT NULL,
  `created_at` text NOT NULL,
  FOREIGN KEY (`document_id`) REFERENCES `journal_documents` (`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE no action ON DELETE no action
);

CREATE INDEX `journal_revisions_document_created_idx` ON `journal_revisions` (`document_id`, `created_at`);
CREATE INDEX `journal_revisions_user_created_idx` ON `journal_revisions` (`user_id`, `created_at`);
