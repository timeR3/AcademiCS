-- Adds status and total_chunks columns to the shared_files table
ALTER TABLE `shared_files`
ADD COLUMN `status` ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
ADD COLUMN `total_chunks` INT DEFAULT NULL;

-- Creates the table to store text content from each processed chunk
CREATE TABLE `file_transcript_chunks` (
  `file_hash` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `chunk_index` int NOT NULL,
  `text_content` text COLLATE utf8mb4_unicode_ci,
  `input_tokens` int DEFAULT NULL,
  `output_tokens` int DEFAULT NULL,
  PRIMARY KEY (`file_hash`,`chunk_index`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
