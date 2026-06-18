CREATE TABLE `memory_documents` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `source_type` text NOT NULL,
  `source_id` text NOT NULL,
  `title` text NOT NULL,
  `body_text` text NOT NULL,
  `local_date` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE no action ON DELETE no action
);

CREATE UNIQUE INDEX `memory_documents_source_idx` ON `memory_documents` (`user_id`, `source_type`, `source_id`);
CREATE INDEX `memory_documents_user_updated_idx` ON `memory_documents` (`user_id`, `updated_at`);

CREATE TABLE `memory_chunks` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `memory_document_id` text NOT NULL,
  `source_type` text NOT NULL,
  `source_id` text NOT NULL,
  `chunk_text` text NOT NULL,
  `chunk_hash` text NOT NULL,
  `chunk_index` integer NOT NULL,
  `indexed_at` text,
  `created_at` text NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`memory_document_id`) REFERENCES `memory_documents` (`id`) ON UPDATE no action ON DELETE cascade
);

CREATE UNIQUE INDEX `memory_chunks_document_index_idx` ON `memory_chunks` (`memory_document_id`, `chunk_index`);
CREATE UNIQUE INDEX `memory_chunks_hash_idx` ON `memory_chunks` (`user_id`, `chunk_hash`);
CREATE INDEX `memory_chunks_user_created_idx` ON `memory_chunks` (`user_id`, `created_at`);

CREATE TABLE `memory_index_jobs` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `memory_chunk_id` text NOT NULL,
  `source_type` text NOT NULL,
  `source_id` text NOT NULL,
  `status` text NOT NULL,
  `error_message` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`memory_chunk_id`) REFERENCES `memory_chunks` (`id`) ON UPDATE no action ON DELETE cascade
);

CREATE UNIQUE INDEX `memory_index_jobs_chunk_idx` ON `memory_index_jobs` (`memory_chunk_id`);
CREATE INDEX `memory_index_jobs_user_status_idx` ON `memory_index_jobs` (`user_id`, `status`, `created_at`);

CREATE TABLE `memory_retrieval_events` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `query` text NOT NULL,
  `result_chunk_ids` text NOT NULL,
  `source` text NOT NULL,
  `created_at` text NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE no action ON DELETE no action
);

CREATE INDEX `memory_retrieval_events_user_created_idx` ON `memory_retrieval_events` (`user_id`, `created_at`);
