CREATE TABLE `brand_milestones` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` text NOT NULL,
	`owner_email` text NOT NULL,
	`source_reading_id` integer,
	`title` text NOT NULL,
	`phase` text NOT NULL,
	`due_date` text NOT NULL,
	`status` text DEFAULT 'planned' NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`deliverable` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `brand_milestones_owner_status_idx` ON `brand_milestones` (`owner_id`,`status`);--> statement-breakpoint
CREATE INDEX `brand_milestones_owner_due_idx` ON `brand_milestones` (`owner_id`,`due_date`);--> statement-breakpoint
CREATE INDEX `brand_milestones_source_reading_idx` ON `brand_milestones` (`source_reading_id`);--> statement-breakpoint
CREATE TABLE `brand_progress` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`current_phase` text DEFAULT '定位' NOT NULL,
	`annual_direction` text DEFAULT '' NOT NULL,
	`monthly_focus` text DEFAULT '' NOT NULL,
	`blocker` text DEFAULT '' NOT NULL,
	`next_action` text DEFAULT '' NOT NULL,
	`updated_at` integer NOT NULL
);
