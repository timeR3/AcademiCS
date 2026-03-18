
-- Este script crea la tabla `course_source_files` para almacenar los nombres de los archivos
-- originales utilizados para generar el contenido de un curso en la aplicación IntelliLearn.

-- Asegúrate de que la base de datos (por ejemplo, `intellilearn`) exista
-- y esté seleccionada antes de ejecutar este script.
-- Ejemplo: USE intellilearn;

CREATE TABLE `course_source_files` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `course_id` INT NOT NULL,
  `file_name` VARCHAR(255) NOT NULL,
  `uploaded_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `fk_course_source_files_course_id_idx` (`course_id` ASC),
  CONSTRAINT `fk_course_source_files_course_id`
    FOREIGN KEY (`course_id`)
    REFERENCES `courses` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);
