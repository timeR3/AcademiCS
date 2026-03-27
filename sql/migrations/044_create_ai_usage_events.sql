CREATE TABLE IF NOT EXISTS `ai_usage_events` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `course_id` INT NULL,
  `module_id` INT NULL,
  `event_type` VARCHAR(64) NOT NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'success',
  `model_id` VARCHAR(120) DEFAULT NULL,
  `input_tokens` INT UNSIGNED NOT NULL DEFAULT 0,
  `output_tokens` INT UNSIGNED NOT NULL DEFAULT 0,
  `total_tokens` INT UNSIGNED NOT NULL DEFAULT 0,
  `input_rate_per_million` DECIMAL(12,6) DEFAULT NULL,
  `output_rate_per_million` DECIMAL(12,6) DEFAULT NULL,
  `estimated_cost_usd` DECIMAL(14,8) NOT NULL DEFAULT 0,
  `metadata` JSON NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @has_idx_ai_usage_course_event_created := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'ai_usage_events'
    AND INDEX_NAME = 'idx_ai_usage_course_event_created'
);
SET @sql_idx_ai_usage_course_event_created := IF(
  @has_idx_ai_usage_course_event_created = 0,
  'CREATE INDEX `idx_ai_usage_course_event_created` ON `ai_usage_events` (`course_id`, `event_type`, `created_at`)',
  'SELECT 1'
);
PREPARE stmt_idx_ai_usage_course_event_created FROM @sql_idx_ai_usage_course_event_created;
EXECUTE stmt_idx_ai_usage_course_event_created;
DEALLOCATE PREPARE stmt_idx_ai_usage_course_event_created;

SET @has_idx_ai_usage_module_created := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'ai_usage_events'
    AND INDEX_NAME = 'idx_ai_usage_module_created'
);
SET @sql_idx_ai_usage_module_created := IF(
  @has_idx_ai_usage_module_created = 0,
  'CREATE INDEX `idx_ai_usage_module_created` ON `ai_usage_events` (`module_id`, `created_at`)',
  'SELECT 1'
);
PREPARE stmt_idx_ai_usage_module_created FROM @sql_idx_ai_usage_module_created;
EXECUTE stmt_idx_ai_usage_module_created;
DEALLOCATE PREPARE stmt_idx_ai_usage_module_created;
