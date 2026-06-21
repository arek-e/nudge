ALTER TABLE `syntheses` ADD `fingerprint` text;

CREATE UNIQUE INDEX `syntheses_user_frame_fingerprint_idx` ON `syntheses` (
  `user_id`,
  `frame_id`,
  `fingerprint`
);
