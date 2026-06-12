ALTER TABLE `events` ADD `idempotency_key` text;

CREATE UNIQUE INDEX `events_user_idempotency_key_idx` ON `events` (`user_id`, `idempotency_key`);

DELETE FROM `proposals`
WHERE rowid NOT IN (
  SELECT MIN(rowid)
  FROM `proposals`
  GROUP BY `synthesis_id`, `kind`, `title`, `body`
);
CREATE UNIQUE INDEX `proposals_synthesis_kind_title_body_idx` ON `proposals` (
  `synthesis_id`,
  `kind`,
  `title`,
  `body`
);
