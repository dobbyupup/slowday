CREATE TABLE `design_ideas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` text NOT NULL,
	`owner_email` text NOT NULL,
	`reading_item_id` integer,
	`title` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'seed' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `design_ideas_owner_status_idx` ON `design_ideas` (`owner_id`,`status`);--> statement-breakpoint
CREATE INDEX `design_ideas_reading_idx` ON `design_ideas` (`reading_item_id`);--> statement-breakpoint
CREATE TABLE `reading_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` text NOT NULL,
	`owner_email` text NOT NULL,
	`date` text NOT NULL,
	`title` text NOT NULL,
	`source` text DEFAULT '' NOT NULL,
	`url` text DEFAULT '' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `reading_items_owner_date_idx` ON `reading_items` (`owner_id`,`date`);