-- Scripts para crear la estructura de tablas para la base de datos de IntelliLearn en MySQL.
-- Puedes ejecutar este script completo en tu cliente de MySQL para configurar la base de datos.

-- --- TABLAS ---

-- 1. Tabla de Usuarios (users)
-- Almacena la información de todos los usuarios, tanto profesores como estudiantes.
CREATE TABLE `users` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` ENUM('teacher', 'student') NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email_unique` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 2. Tabla de Cursos (courses)
-- Almacena la información principal de cada curso.
CREATE TABLE `courses` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `title` VARCHAR(255) NOT NULL,
  `teacher_id` INT NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `teacher_id_idx` (`teacher_id`),
  CONSTRAINT `fk_courses_teacher` FOREIGN KEY (`teacher_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 3. Tabla de Módulos de Curso (course_modules)
-- Representa cada módulo o hito dentro de la ruta de aprendizaje de un curso.
CREATE TABLE `course_modules` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `course_id` INT NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `module_order` INT NOT NULL COMMENT 'Orden numérico del módulo dentro del curso (1, 2, 3...).',
  `questions_to_display` INT NOT NULL DEFAULT 10 COMMENT 'Nº de preguntas que se mostrarán en la evaluación.',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `course_id_idx` (`course_id`),
  CONSTRAINT `fk_modules_course` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 4. Tabla de Temario de Módulo (module_syllabus)
-- Almacena las secciones de contenido (el temario) para cada módulo.
CREATE TABLE `module_syllabus` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `module_id` INT NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `content` TEXT NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `module_id_idx` (`module_id`),
  CONSTRAINT `fk_syllabus_module` FOREIGN KEY (`module_id`) REFERENCES `course_modules` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 5. Tabla de Preguntas de Módulo (module_questions)
-- Almacena el banco de preguntas para la evaluación de cada módulo.
CREATE TABLE `module_questions` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `module_id` INT NOT NULL,
  `question_text` TEXT NOT NULL,
  `options` JSON NOT NULL COMMENT 'Array JSON con 4 opciones. Ej: ["Opción A", "Opción B", ...]',
  `correct_option_index` TINYINT NOT NULL COMMENT 'Índice (0-3) de la respuesta correcta en el array JSON `options`.',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `module_id_idx` (`module_id`),
  CONSTRAINT `fk_questions_module` FOREIGN KEY (`module_id`) REFERENCES `course_modules` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 6. Tabla de Inscripciones a Cursos (course_enrollments)
-- Tabla pivote para gestionar la inscripción de muchos estudiantes a muchos cursos.
CREATE TABLE `course_enrollments` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `student_id` INT NOT NULL,
  `course_id` INT NOT NULL,
  `enrolled_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `student_course_unique` (`student_id`, `course_id`),
  KEY `student_id_idx` (`student_id`),
  KEY `course_id_idx` (`course_id`),
  CONSTRAINT `fk_enrollments_student` FOREIGN KEY (`student_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_enrollments_course` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 7. Tabla de Envíos de Evaluaciones (evaluation_submissions)
-- Guarda un registro de cada vez que un estudiante completa una evaluación para un módulo.
CREATE TABLE `evaluation_submissions` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `student_id` INT NOT NULL,
  `module_id` INT NOT NULL,
  `score` DECIMAL(5,2) NOT NULL COMMENT 'Calificación obtenida (Ej: 95.50).',
  `passed` BOOLEAN NOT NULL COMMENT 'TRUE si la calificación fue aprobatoria, FALSE si no.',
  `submitted_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `student_id_idx` (`student_id`),
  KEY `module_id_idx` (`module_id`),
  CONSTRAINT `fk_submissions_student` FOREIGN KEY (`student_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_submissions_module` FOREIGN KEY (`module_id`) REFERENCES `course_modules` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- --- Mensaje de Finalización ---
-- Si has llegado hasta aquí, todas las tablas han sido creadas.
-- ¡Ya tienes la base de datos lista para tu backend!
