CREATE TABLE `brand_profile_versions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` text NOT NULL,
	`version` integer NOT NULL,
	`snapshot` text NOT NULL,
	`change_note` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `brand_profile_versions_owner_version_unique` ON `brand_profile_versions` (`owner_id`,`version`);--> statement-breakpoint
CREATE INDEX `brand_profile_versions_owner_idx` ON `brand_profile_versions` (`owner_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `brand_profiles` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`story` text DEFAULT '' NOT NULL,
	`philosophy` text DEFAULT '' NOT NULL,
	`audience` text DEFAULT '' NOT NULL,
	`keywords` text DEFAULT '' NOT NULL,
	`differentiation` text DEFAULT '' NOT NULL,
	`product_direction` text DEFAULT '' NOT NULL,
	`visual_language` text DEFAULT '' NOT NULL,
	`annual_goal` text DEFAULT '' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `knowledge_topics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `knowledge_topics_owner_title_unique` ON `knowledge_topics` (`owner_id`,`title`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_brand_progress` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`current_phase` text DEFAULT '品牌定位' NOT NULL,
	`annual_direction` text DEFAULT '' NOT NULL,
	`monthly_focus` text DEFAULT '' NOT NULL,
	`blocker` text DEFAULT '' NOT NULL,
	`next_action` text DEFAULT '' NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_brand_progress`("owner_id", "current_phase", "annual_direction", "monthly_focus", "blocker", "next_action", "updated_at") SELECT "owner_id", "current_phase", "annual_direction", "monthly_focus", "blocker", "next_action", "updated_at" FROM `brand_progress`;--> statement-breakpoint
DROP TABLE `brand_progress`;--> statement-breakpoint
ALTER TABLE `__new_brand_progress` RENAME TO `brand_progress`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `reading_items` ADD `resource_type` text DEFAULT '图片' NOT NULL;--> statement-breakpoint
ALTER TABLE `reading_items` ADD `primary_category` text DEFAULT '产品设计' NOT NULL;--> statement-breakpoint
ALTER TABLE `reading_items` ADD `workflow_status` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
UPDATE `reading_items` SET `workflow_status` = 'confirmed';--> statement-breakpoint
ALTER TABLE `reading_items` ADD `intended_use` text DEFAULT '暂时研究' NOT NULL;--> statement-breakpoint
ALTER TABLE `reading_items` ADD `content_hash` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `reading_items` ADD `duplicate_of` integer;--> statement-breakpoint
ALTER TABLE `reading_items` ADD `topic` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `reading_items_owner_workflow_idx` ON `reading_items` (`owner_id`,`workflow_status`);--> statement-breakpoint
CREATE INDEX `reading_items_owner_category_idx` ON `reading_items` (`owner_id`,`primary_category`);--> statement-breakpoint
CREATE INDEX `reading_items_owner_hash_idx` ON `reading_items` (`owner_id`,`content_hash`);
