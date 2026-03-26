SET @has_difficulty := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'courses'
    AND COLUMN_NAME = 'difficulty'
);
SET @sql_difficulty := IF(
  @has_difficulty = 0,
  'ALTER TABLE `courses` ADD COLUMN `difficulty` ENUM("basic","intermediate","advanced") NOT NULL DEFAULT "intermediate" AFTER `category_id`',
  'SELECT 1'
);
PREPARE stmt_difficulty FROM @sql_difficulty;
EXECUTE stmt_difficulty;
DEALLOCATE PREPARE stmt_difficulty;

SET @has_include_fundamentals := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'courses'
    AND COLUMN_NAME = 'include_fundamentals'
);
SET @sql_include_fundamentals := IF(
  @has_include_fundamentals = 0,
  'ALTER TABLE `courses` ADD COLUMN `include_fundamentals` TINYINT(1) NOT NULL DEFAULT 0 AFTER `difficulty`',
  'SELECT 1'
);
PREPARE stmt_include_fundamentals FROM @sql_include_fundamentals;
EXECUTE stmt_include_fundamentals;
DEALLOCATE PREPARE stmt_include_fundamentals;
