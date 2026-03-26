SET @has_processed_chunk := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'shared_files'
    AND COLUMN_NAME = 'processed_chunk'
);
SET @sql_processed_chunk := IF(
  @has_processed_chunk = 0,
  'ALTER TABLE `shared_files` ADD COLUMN `processed_chunk` INT NOT NULL DEFAULT 0 AFTER `total_chunks`',
  'SELECT 1'
);
PREPARE stmt_processed_chunk FROM @sql_processed_chunk;
EXECUTE stmt_processed_chunk;
DEALLOCATE PREPARE stmt_processed_chunk;

SET @has_file_name := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'file_transcripts'
    AND COLUMN_NAME = 'file_name'
);
SET @sql_file_name := IF(
  @has_file_name = 0,
  'ALTER TABLE `file_transcripts` ADD COLUMN `file_name` VARCHAR(255) COLLATE utf8mb4_unicode_ci NULL AFTER `file_hash`',
  'SELECT 1'
);
PREPARE stmt_file_name FROM @sql_file_name;
EXECUTE stmt_file_name;
DEALLOCATE PREPARE stmt_file_name;
