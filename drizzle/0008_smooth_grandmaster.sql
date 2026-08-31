CREATE TABLE `goals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` text NOT NULL,
	`scope` text NOT NULL,
	`period_key` text NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `goals_owner_scope_period_unique` ON `goals` (`owner_id`,`scope`,`period_key`);--> statement-breakpoint
CREATE INDEX `goals_owner_period_idx` ON `goals` (`owner_id`,`period_key`);