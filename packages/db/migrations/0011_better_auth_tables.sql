CREATE TABLE `auth_user` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `email` text NOT NULL,
  `email_verified` integer NOT NULL,
  `image` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);

CREATE UNIQUE INDEX `auth_user_email_unique` ON `auth_user` (`email`);

CREATE TABLE `auth_session` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `token` text NOT NULL,
  `expires_at` integer NOT NULL,
  `ip_address` text,
  `user_agent` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `auth_user` (`id`) ON UPDATE no action ON DELETE cascade
);

CREATE UNIQUE INDEX `auth_session_token_unique` ON `auth_session` (`token`);
CREATE INDEX `auth_session_user_idx` ON `auth_session` (`user_id`);

CREATE TABLE `auth_account` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `account_id` text NOT NULL,
  `provider_id` text NOT NULL,
  `access_token` text,
  `refresh_token` text,
  `access_token_expires_at` integer,
  `refresh_token_expires_at` integer,
  `scope` text,
  `id_token` text,
  `password` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `auth_user` (`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX `auth_account_user_idx` ON `auth_account` (`user_id`);

CREATE TABLE `auth_verification` (
  `id` text PRIMARY KEY NOT NULL,
  `identifier` text NOT NULL,
  `value` text NOT NULL,
  `expires_at` integer NOT NULL,
  `created_at` integer,
  `updated_at` integer
);
