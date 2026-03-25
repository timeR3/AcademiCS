-- Este script modifica la tabla course_bibliography para soportar enlaces además de archivos.

-- Crear la tabla si no existe (para instalaciones nuevas)
CREATE TABLE IF NOT EXISTS `course_bibliography` (
  `id` int NOT NULL AUTO_INCREMENT,
  `course_id` int NOT NULL,
  `item_type` enum('file','link') COLLATE utf8mb4_unicode_ci NOT NULL,
  `item_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `url` text COLLATE utf8mb4_unicode_ci,
  `file_content` longblob,
  `uploaded_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `course_id` (`course_id`),
  CONSTRAINT `course_bibliography_ibfk_1` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Modificar la tabla existente si ya está creada
-- Añadir la columna item_type si no existe
ALTER TABLE `course_bibliography` ADD COLUMN IF NOT EXISTS `item_type` enum('file','link') NOT NULL DEFAULT 'file' AFTER `course_id`;

-- Renombrar file_name a item_name si existe file_name y no item_name
ALTER TABLE `course_bibliography` CHANGE COLUMN IF EXISTS `file_name` `item_name` VARCHAR(255) COLLATE utf8mb4_unicode_ci NOT NULL;

-- Añadir la columna url si no existe
ALTER TABLE `course_bibliography` ADD COLUMN IF NOT EXISTS `url` text COLLATE utf8mb4_unicode_ci AFTER `item_name`;

-- Cambiar el nombre de la columna 'content' a 'file_content' si existe 'content'
ALTER TABLE `course_bibliography` CHANGE COLUMN IF EXISTS `content` `file_content` LONGBLOB;

-- Establecer el valor por defecto de 'file' para los registros existentes en item_type
UPDATE `course_bibliography` SET `item_type` = 'file' WHERE `item_type` IS NULL OR `item_type` = '';
