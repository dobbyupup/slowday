CREATE TABLE `reading_canvases` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` text NOT NULL,
	`tag` text NOT NULL,
	`layout` text DEFAULT '{"nodes":[],"edges":[]}' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reading_canvases_owner_tag_unique` ON `reading_canvases` (`owner_id`,`tag`);