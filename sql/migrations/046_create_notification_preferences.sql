SET @has_notification_preferences := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'notification_preferences'
);

SET @sql_notification_preferences := IF(
  @has_notification_preferences = 0,
  'CREATE TABLE `notification_preferences` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `user_id` INT NOT NULL,
    `notification_type` VARCHAR(100) NOT NULL,
    `enabled` TINYINT(1) NOT NULL DEFAULT 1,
    `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `notification_preferences_user_type_unique` (`user_id`, `notification_type`),
    KEY `notification_preferences_user_id_idx` (`user_id`),
    CONSTRAINT `notification_preferences_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
  'SELECT 1'
);

PREPARE stmt_notification_preferences FROM @sql_notification_preferences;
EXECUTE stmt_notification_preferences;
DEALLOCATE PREPARE stmt_notification_preferences;
