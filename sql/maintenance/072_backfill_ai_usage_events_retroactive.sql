START TRANSACTION;

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

SET @retro_model_id := (
  SELECT NULLIF(TRIM(`value`), '')
  FROM app_settings
  WHERE `key` = 'aiModel'
  LIMIT 1
);

SET @retro_input_rate_per_million := (
  SELECT CASE
    WHEN pricing_input IS NULL OR TRIM(pricing_input) = '' THEN NULL
    ELSE CAST(REPLACE(REPLACE(REPLACE(TRIM(SUBSTRING_INDEX(pricing_input, '/', 1)), '$', ''), ' ', ''), ',', '.') AS DECIMAL(12,6))
  END
  FROM ai_models
  WHERE id = @retro_model_id
  LIMIT 1
);

SET @retro_output_rate_per_million := (
  SELECT CASE
    WHEN pricing_output IS NULL OR TRIM(pricing_output) = '' THEN NULL
    ELSE CAST(REPLACE(REPLACE(REPLACE(TRIM(SUBSTRING_INDEX(pricing_output, '/', 1)), '$', ''), ' ', ''), ',', '.') AS DECIMAL(12,6))
  END
  FROM ai_models
  WHERE id = @retro_model_id
  LIMIT 1
);

INSERT INTO ai_usage_events (
  course_id,
  module_id,
  event_type,
  status,
  model_id,
  input_tokens,
  output_tokens,
  total_tokens,
  input_rate_per_million,
  output_rate_per_million,
  estimated_cost_usd,
  metadata,
  created_at
)
SELECT
  csf.course_id,
  NULL,
  'file_upload',
  CASE WHEN sf.status = 'failed' THEN 'failed' ELSE 'success' END,
  @retro_model_id,
  GREATEST(0, COALESCE(ft.input_tokens, 0)),
  GREATEST(0, COALESCE(ft.output_tokens, 0)),
  GREATEST(0, COALESCE(ft.input_tokens, 0) + COALESCE(ft.output_tokens, 0)),
  @retro_input_rate_per_million,
  @retro_output_rate_per_million,
  (
    (GREATEST(0, COALESCE(ft.input_tokens, 0)) / 1000000) * COALESCE(@retro_input_rate_per_million, 0)
    + (GREATEST(0, COALESCE(ft.output_tokens, 0)) / 1000000) * COALESCE(@retro_output_rate_per_million, 0)
  ),
  JSON_OBJECT(
    'retroactive', true,
    'retroactiveSource', 'course_source_files',
    'sharedFileId', sf.id,
    'fileHash', sf.file_hash,
    'fileName', sf.file_name,
    'sharedFileStatus', sf.status,
    'approximate', true
  ),
  COALESCE(sf.uploaded_at, ft.created_at, NOW())
FROM course_source_files csf
JOIN shared_files sf ON sf.id = csf.shared_file_id
LEFT JOIN file_transcripts ft ON ft.file_hash = sf.file_hash
LEFT JOIN ai_usage_events existing ON existing.course_id = csf.course_id
  AND existing.event_type = 'file_upload'
  AND JSON_UNQUOTE(JSON_EXTRACT(existing.metadata, '$.retroactiveSource')) = 'course_source_files'
  AND CAST(JSON_UNQUOTE(JSON_EXTRACT(existing.metadata, '$.sharedFileId')) AS UNSIGNED) = sf.id
WHERE existing.id IS NULL;

INSERT INTO ai_usage_events (
  course_id,
  module_id,
  event_type,
  status,
  model_id,
  input_tokens,
  output_tokens,
  total_tokens,
  input_rate_per_million,
  output_rate_per_million,
  estimated_cost_usd,
  metadata,
  created_at
)
SELECT
  summary.course_id,
  NULL,
  'syllabus_index_generation',
  'success',
  @retro_model_id,
  0,
  0,
  0,
  @retro_input_rate_per_million,
  @retro_output_rate_per_million,
  0,
  JSON_OBJECT(
    'retroactive', true,
    'retroactiveSource', 'course_modules_index',
    'moduleCount', summary.module_count,
    'approximate', true
  ),
  summary.first_created_at
FROM (
  SELECT
    cm.course_id,
    COUNT(*) AS module_count,
    MIN(cm.created_at) AS first_created_at
  FROM course_modules cm
  GROUP BY cm.course_id
) summary
LEFT JOIN ai_usage_events existing ON existing.course_id = summary.course_id
  AND existing.event_type = 'syllabus_index_generation'
  AND JSON_UNQUOTE(JSON_EXTRACT(existing.metadata, '$.retroactiveSource')) = 'course_modules_index'
WHERE existing.id IS NULL;

INSERT INTO ai_usage_events (
  course_id,
  module_id,
  event_type,
  status,
  model_id,
  input_tokens,
  output_tokens,
  total_tokens,
  input_rate_per_million,
  output_rate_per_million,
  estimated_cost_usd,
  metadata,
  created_at
)
SELECT
  cm.course_id,
  cm.id,
  'syllabus_module_generation',
  'success',
  @retro_model_id,
  0,
  0,
  0,
  @retro_input_rate_per_million,
  @retro_output_rate_per_million,
  0,
  JSON_OBJECT(
    'retroactive', true,
    'retroactiveSource', 'course_modules',
    'moduleTitle', cm.title,
    'approximate', true
  ),
  COALESCE(cm.created_at, NOW())
FROM course_modules cm
LEFT JOIN ai_usage_events existing ON existing.module_id = cm.id
  AND existing.event_type = 'syllabus_module_generation'
  AND JSON_UNQUOTE(JSON_EXTRACT(existing.metadata, '$.retroactiveSource')) = 'course_modules'
WHERE existing.id IS NULL;

INSERT INTO ai_usage_events (
  course_id,
  module_id,
  event_type,
  status,
  model_id,
  input_tokens,
  output_tokens,
  total_tokens,
  input_rate_per_million,
  output_rate_per_million,
  estimated_cost_usd,
  metadata,
  created_at
)
SELECT
  summary.course_id,
  summary.module_id,
  'questionnaire_generation',
  'success',
  @retro_model_id,
  0,
  0,
  0,
  @retro_input_rate_per_million,
  @retro_output_rate_per_million,
  0,
  JSON_OBJECT(
    'retroactive', true,
    'retroactiveSource', 'module_questions',
    'questionCount', summary.question_count,
    'approximate', true
  ),
  summary.first_question_created_at
FROM (
  SELECT
    cm.course_id,
    mq.module_id,
    COUNT(*) AS question_count,
    MIN(mq.created_at) AS first_question_created_at
  FROM module_questions mq
  JOIN course_modules cm ON cm.id = mq.module_id
  GROUP BY cm.course_id, mq.module_id
) summary
LEFT JOIN ai_usage_events existing ON existing.module_id = summary.module_id
  AND existing.event_type = 'questionnaire_generation'
  AND JSON_UNQUOTE(JSON_EXTRACT(existing.metadata, '$.retroactiveSource')) = 'module_questions'
WHERE existing.id IS NULL;

COMMIT;

SELECT
  event_type,
  COUNT(*) AS total_events,
  SUM(total_tokens) AS total_tokens,
  ROUND(SUM(estimated_cost_usd), 6) AS total_estimated_cost_usd
FROM ai_usage_events
WHERE JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.retroactive')) = 'true'
GROUP BY event_type
ORDER BY event_type;
