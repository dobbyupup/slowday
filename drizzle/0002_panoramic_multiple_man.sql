CREATE TABLE `api_keys` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` text NOT NULL,
	`owner_email` text NOT NULL,
	`name` text NOT NULL,
	`token_hash` text NOT NULL,
	`token_prefix` text NOT NULL,
	`last_used_at` integer,
	`revoked_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_token_hash_unique` ON `api_keys` (`token_hash`);--> statement-breakpoint
CREATE INDEX `api_keys_owner_idx` ON `api_keys` (`owner_id`);--> statement-breakpoint
CREATE TABLE `api_rate_limits` (
	`identity` text NOT NULL,
	`window_start` integer NOT NULL,
	`count` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_rate_limits_identity_window_unique` ON `api_rate_limits` (`identity`,`window_start`);--> statement-breakpoint
DROP INDEX `reviews_owner_date_unique`;--> statement-breakpoint
ALTER TABLE `reviews` ADD `owner_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `reviews_owner_date_unique` ON `reviews` (`owner_id`,`date`);--> statement-breakpoint
DROP INDEX `tasks_owner_date_idx`;--> statement-breakpoint
ALTER TABLE `tasks` ADD `owner_id` text;--> statement-breakpoint
CREATE INDEX `tasks_owner_date_idx` ON `tasks` (`owner_id`,`date`);--> statement-breakpoint
PRAGMA optimize;
