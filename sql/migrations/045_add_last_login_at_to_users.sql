SET @has_last_login_at := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'last_login_at'
);

SET @sql_last_login_at := IF(
  @has_last_login_at = 0,
  'ALTER TABLE `users` ADD COLUMN `last_login_at` TIMESTAMP NULL DEFAULT NULL AFTER `created_at`',
  'SELECT 1'
);

PREPARE stmt_last_login_at FROM @sql_last_login_at;
EXECUTE stmt_last_login_at;
DEALLOCATE PREPARE stmt_last_login_at;
