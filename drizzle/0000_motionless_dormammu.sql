CREATE TABLE `reviews` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_email` text NOT NULL,
	`date` text NOT NULL,
	`mood` text DEFAULT '◡' NOT NULL,
	`energy` integer DEFAULT 3 NOT NULL,
	`text` text DEFAULT '' NOT NULL,
	`win` text DEFAULT '' NOT NULL,
	`analysis` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reviews_owner_date_unique` ON `reviews` (`owner_email`,`date`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_email` text NOT NULL,
	`date` text NOT NULL,
	`title` text NOT NULL,
	`category` text NOT NULL,
	`done` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `tasks_owner_date_idx` ON `tasks` (`owner_email`,`date`);