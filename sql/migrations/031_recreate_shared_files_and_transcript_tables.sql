-- Drop existing tables if they exist to ensure a clean slate
DROP TABLE IF EXISTS `course_source_files`;
DROP TABLE IF EXISTS `file_transcripts`;
DROP TABLE IF EXISTS `shared_files`;
DROP TABLE IF EXISTS `file_transcript_chunks`;

-- Create the central repository for all uploaded files
CREATE TABLE `shared_files` (
  `id` int NOT NULL AUTO_INCREMENT,
  `file_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_content` longblob NOT NULL,
  `file_hash` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('pending','processing','completed','failed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `total_chunks` int DEFAULT '0',
  `processed_chunk` int DEFAULT '0',
  `uploaded_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `file_hash` (`file_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create the table to hold temporary text chunks during processing
CREATE TABLE `file_transcript_chunks` (
  `id` int NOT NULL AUTO_INCREMENT,
  `file_hash` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `chunk_index` int NOT NULL,
  `text_content` longtext COLLATE utf8mb4_unicode_ci,
  `input_tokens` int DEFAULT NULL,
  `output_tokens` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `hash_chunk_unique` (`file_hash`,`chunk_index`),
  KEY `file_hash_index` (`file_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create the table for the final, structured transcripts
CREATE TABLE `file_transcripts` (
  `file_hash` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `structured_content` json DEFAULT NULL,
  `input_tokens` int DEFAULT NULL,
  `output_tokens` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`file_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create the link table between courses and shared files
CREATE TABLE `course_source_files` (
  `id` int NOT NULL AUTO_INCREMENT,
  `course_id` int NOT NULL,
  `shared_file_id` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `course_file_unique` (`course_id`,`shared_file_id`),
  KEY `course_id_fk` (`course_id`),
  KEY `shared_file_id_fk` (`shared_file_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
