-- Paso 1: Crear la nueva tabla para las categorías de los cursos.
CREATE TABLE `course_categories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name_unique` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Paso 2: Insertar algunas categorías por defecto para empezar.
INSERT INTO `course_categories` (`name`) VALUES
('Ventas'),
('Finanzas'),
('Contabilidad'),
('Obra'),
('Recursos Humanos');

-- Paso 3: Añadir la columna para la clave foránea en la tabla de cursos.
-- Permite NULL temporalmente para poder añadirla a tablas con datos existentes.
ALTER TABLE `courses`
ADD COLUMN `category_id` INT NULL AFTER `teacher_id`;

-- Paso 4: Establecer la relación de clave foránea.
-- Esto asegura la integridad de los datos. Un curso solo puede tener una categoría que exista.
ALTER TABLE `courses`
ADD CONSTRAINT `fk_course_category`
FOREIGN KEY (`category_id`)
REFERENCES `course_categories` (`id`)
ON DELETE SET NULL ON UPDATE CASCADE;

-- Opcional: Asignar una categoría por defecto (ej: la primera) a cursos existentes que no tengan una.
-- UPDATE `courses` SET `category_id` = 1 WHERE `category_id` IS NULL;

