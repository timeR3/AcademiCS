-- Add status to course_categories
ALTER TABLE `course_categories`
ADD COLUMN `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active' AFTER `name`;
