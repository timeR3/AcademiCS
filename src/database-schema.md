# Esquema de Base de Datos para AcademiCS (MySQL)

Este documento describe una posible estructura de tablas para una base de datos MySQL que soporte la aplicación AcademiCS, incluyendo un sistema de múltiples roles.

## Diagrama de Relaciones (Simplificado)

```
[users] 1--< [user_roles] >--1 [roles]
   |
   |
[course_categories] 1--< [courses] >--1 [users] (teacher)
                           |
                           '--< [course_modules] 1--< [module_syllabus]
                           |                 |
                           |                 '--< [module_questions]
                           |
                           '--< [course_source_files] >--1 [shared_files]
                           |
                           '--< [course_bibliography]
                           |
[courses] 1--< [course_enrollments] >--1 [users] (student)
   |
[course_modules] 1--< [evaluation_submissions] >--1 [users] (student)
   |
[users] 1--< [user_badges] >--1 [badges]
   |
[users] 1--< [notifications]

[app_settings]
   |
   '--< [prompt_history] (conceptual)
   |
   '--< [ai_models] (conceptual)

[shared_files] 1--< [file_transcript_chunks]
[shared_files] 1--1 [file_transcripts]
```

---

## Estructura de Tablas

### 1. `users`

Almacena la información de todos los usuarios.

| Columna | Tipo | Descripción |
| :--- | :--- | :--- |
| **`id`** | `INT` (PK, Auto-Increment) | Identificador único del usuario. |
| `name` | `VARCHAR(255)` | Nombre completo del usuario. |
| `email` | `VARCHAR(255)` (Unique) | Correo electrónico del usuario, para login. |
| `password_hash`| `VARCHAR(255)` | Hash de la contraseña del usuario. |
| `status` | `ENUM('active', 'inactive')` (DEFAULT 'active') | Estado del usuario para borrado lógico. |
| `created_at` | `TIMESTAMP` (DEFAULT NOW()) | Fecha y hora de creación. |

---

### 2. `roles`

Almacena los roles disponibles en la plataforma.

| Columna | Tipo | Descripción |
| :--- | :--- | :--- |
| **`id`** | `INT` (PK, Auto-Increment) | Identificador único del rol. |
| `name` | `VARCHAR(50)` (Unique) | Nombre del rol (ej: 'teacher', 'student', 'admin'). |

*Datos de ejemplo:*
`(1, 'student')`, `(2, 'teacher')`, `(3, 'admin')`

---

### 3. `user_roles`

Tabla pivote para asignar múltiples roles a los usuarios.

| Columna | Tipo | Descripción |
| :--- | :--- | :--- |
| **`user_id`** | `INT` (FK -> `users.id`) | ID del usuario. |
| **`role_id`** | `INT` (FK -> `roles.id`) | ID del rol asignado. |
| *Constraint* | `PRIMARY KEY(user_id, role_id)` | Un usuario no puede tener el mismo rol dos veces. |

---

### 4. `course_categories`

Almacena las categorías disponibles para los cursos.

| Columna | Tipo | Descripción |
| :--- | :--- | :--- |
| **`id`** | `INT` (PK, Auto-Increment) | Identificador único de la categoría. |
| `name` | `VARCHAR(100)` (Unique) | Nombre de la categoría (Ej: "Ventas", "Finanzas"). |
| `status` | `ENUM('active', 'inactive')` (DEFAULT 'active') | Estado de la categoría. |


*Datos de ejemplo:*
`(1, 'Ventas')`, `(2, 'Finanzas')`, `(3, 'Contabilidad')`

---

### 5. `courses`

Almacena la información principal de cada curso.

| Columna | Tipo | Descripción |
| :--- | :--- | :--- |
| **`id`** | `INT` (PK, Auto-Increment) | Identificador único del curso. |
| `title` | `VARCHAR(255)` | Título del curso. |
| `teacher_id` | `INT` (FK -> `users.id`) | ID del profesor que creó y gestiona el curso. |
| `category_id`| `INT` (FK -> `course_categories.id`) | ID de la categoría a la que pertenece el curso. |
| `status` | `ENUM('active', 'archived', 'suspended')` (DEFAULT 'active') | Estado del curso. |
| `created_at` | `TIMESTAMP` (DEFAULT NOW()) | Fecha y hora de creación. |

---

### 6. `shared_files`

Almacena una única copia de cada archivo subido en la plataforma para generar contenido.

| Columna | Tipo | Descripción |
| :--- | :--- | :--- |
| **`id`** | `INT` (PK, Auto-Increment) | Identificador único del archivo compartido. |
| `file_name` | `VARCHAR(255)` | Nombre original del archivo. |
| `file_content`| `LONGBLOB` | Contenido binario del archivo para su descarga. |
| `file_hash` | `VARCHAR(64)` (Unique) | Hash SHA-256 del contenido del archivo para deduplicación. |
| `status` | `ENUM('pending', 'processing', 'completed', 'failed')` | Estado del proceso de transcripción. |
| `total_chunks` | `INT` | Número total de fragmentos en los que se dividió el archivo. |
| `processed_chunks`| `INT` | Contador de los fragmentos ya procesados. |
| `processing_step` | `VARCHAR(255)` (DEFAULT NULL) | Texto que describe el paso actual del procesamiento. |
| `error_message`| `TEXT` (DEFAULT NULL) | Mensaje de error si el estado es 'failed'. |
| `uploaded_at` | `TIMESTAMP` (DEFAULT NOW()) | Fecha y hora de subida original. |

```sql
CREATE TABLE `shared_files` (
  `id` int NOT NULL AUTO_INCREMENT,
  `file_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_content` longblob NOT NULL,
  `file_hash` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('pending','processing','completed','failed') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `total_chunks` int DEFAULT NULL,
  `processed_chunks` int DEFAULT '0',
  `processing_step` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `error_message` text COLLATE utf8mb4_unicode_ci,
  `uploaded_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `file_hash` (`file_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```


---

### 7. `file_transcript_chunks`

Almacena el texto extraído de cada fragmento (chunk) de un archivo durante el procesamiento.

| Columna | Tipo | Descripción |
| :--- | :--- | :--- |
| **`file_hash`** | `VARCHAR(64)` (PK) | El hash SHA-256 del archivo. |
| **`chunk_index`** | `INT` (PK) | El índice del fragmento (0, 1, 2...). |
| `text_content`| `TEXT` | El texto extraído de este fragmento. |
| `input_tokens` | `INT` | Tokens de entrada consumidos para este fragmento. |
| `output_tokens` | `INT` | Tokens de salida generados para este fragmento. |

```sql
CREATE TABLE `file_transcript_chunks` (
  `file_hash` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `chunk_index` int NOT NULL,
  `text_content` text COLLATE utf8mb4_unicode_ci,
  `input_tokens` int DEFAULT NULL,
  `output_tokens` int DEFAULT NULL,
  PRIMARY KEY (`file_hash`,`chunk_index`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```


---


### 8. `file_transcripts`

Almacena la transcripción final y estructurada de los archivos.

| Columna | Tipo | Descripción |
| :--- | :--- | :--- |
| **`file_hash`** | `VARCHAR(64)` (PK) | El hash SHA-256 del contenido del archivo original (`shared_files.file_hash`). |
| `file_name` | `VARCHAR(255)` | Nombre original del archivo para facilitar la depuración. |
| `structured_content`| `JSON` | Un array JSON de objetos `{"title": "...", "content": "..."}` que representa el documento. |
| `input_tokens` | `INT` | Número de tokens de entrada consumidos al procesar el archivo. |
| `output_tokens` | `INT` | Número de tokens de salida generados en la transcripción. |
| `created_at` | `TIMESTAMP` (DEFAULT CURRENT_TIMESTAMP) | Fecha y hora en que se creó la transcripción. |

```sql
CREATE TABLE `file_transcripts` (
  `file_hash` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `structured_content` json DEFAULT NULL,
  `input_tokens` int DEFAULT NULL,
  `output_tokens` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`file_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---


### 9. `course_source_files`

Tabla pivote que relaciona un curso con sus archivos fuente de la tabla `shared_files`.

| Columna | Tipo | Descripción |
| :--- | :--- | :--- |
| **`id`** | `INT` (PK, Auto-Increment) | Identificador único de la relación. |
| `course_id` | `INT` (FK -> `courses.id`) | ID del curso al que pertenece este archivo fuente. |
| `shared_file_id` | `INT` (FK -> `shared_files.id`) | ID del archivo en la tabla de archivos compartidos. |

---

### 10. `course_bibliography`

Almacena archivos complementarios o enlaces para un curso, que no se usan para generación de contenido por IA.

| Columna | Tipo | Descripción |
| :--- | :--- | :--- |
| **`id`** | `INT` (PK, Auto-Increment) | Identificador único del ítem. |
| `course_id` | `INT` (FK -> `courses.id`) | ID del curso al que pertenece el ítem. |
| `item_type` | `ENUM('file', 'link')` | Si el ítem es un archivo o un enlace. |
| `item_name` | `VARCHAR(255)` | Nombre del archivo o título del enlace. |
| `url` | `TEXT` (NULL) | La URL del enlace si `item_type` es 'link'. |
| `file_content`| `LONGBLOB` (NULL) | Contenido binario si `item_type` es 'file'. |
| `uploaded_at` | `TIMESTAMP` (DEFAULT NOW()) | Fecha y hora de subida o creación. |

```sql
CREATE TABLE `course_bibliography` (
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
```

---


### 11. `course_modules`

Representa cada módulo o hito dentro de la ruta de aprendizaje de un curso.

| Columna | Tipo | Descripción |
| :--- | :--- | :--- |
| **`id`** | `INT` (PK, Auto-Increment) | Identificador único del módulo. |
| `course_id` | `INT` (FK -> `courses.id`) | ID del curso al que pertenece este módulo. |
| `title` | `VARCHAR(255)` | Título del módulo (Ej: "Módulo 1: Introducción a React"). |
| `introduction` | `TEXT` | Un párrafo introductorio que resume los objetivos del módulo. |
| `module_order`| `INT` | Orden numérico del módulo dentro del curso (1, 2, 3...). |
| `questions_to_display`| `INT` (DEFAULT 10) | Nº de preguntas que se mostrarán en la evaluación. |
| `created_at` | `TIMESTAMP` (DEFAULT NOW()) | Fecha y hora de creación. |

---

### 12. `module_syllabus`

Almacena las secciones de contenido (el temario) para cada módulo.

| Columna | Tipo | Descripción |
| :--- | :--- | :--- |
| **`id`** | `INT` (PK, Auto-Increment) | Identificador único de la sección de contenido. |
| `module_id` | `INT` (FK -> `course_modules.id`)| ID del módulo al que pertenece este contenido. |
| `title` | `VARCHAR(255)` | Título de la sección (Ej: "El Hook useState"). |
| `content` | `TEXT` | El contenido detallado de la sección. |
| `created_at` | `TIMESTAMP` (DEFAULT NOW()) | Fecha y hora de creación. |

---

### 13. `module_questions`

Almacena el banco de preguntas para la evaluación de cada módulo.

| Columna | Tipo | Descripción |
| :--- | :--- | :--- |
| **`id`** | `INT` (PK, Auto-Increment) | Identificador único de la pregunta. |
| `module_id` | `INT` (FK -> `course_modules.id`)| ID del módulo al que pertenece esta pregunta. |
| `question_text` | `TEXT` | El texto de la pregunta. |
| `options` | `JSON` | Un array JSON con las 4 opciones de respuesta. `["Opción A", "Opción B", ...]` |
| `correct_option_index` | `TINYINT` | El índice (0-3) de la respuesta correcta en el array JSON `options`. |
| `created_at` | `TIMESTAMP` (DEFAULT NOW()) | Fecha y hora de creación. |

---

### 14. `course_enrollments`

Tabla que gestiona la inscripción y el progreso de los estudiantes en los cursos.

| Columna | Tipo | Descripción |
| :--- | :--- | :--- |
| **`id`** | `INT` (PK, Auto-Increment) | Identificador único de la inscripción. |
| `student_id` | `INT` (FK -> `users.id`) | ID del estudiante inscrito. |
| `course_id` | `INT` (FK -> `courses.id`) | ID del curso al que se ha inscrito. |
| `enrolled_at` | `TIMESTAMP` (DEFAULT NOW()) | Fecha y hora de inscripción. |
| `due_date` | `DATE` (NULL) | Fecha límite opcional para completar el curso. |
| `status` | `ENUM('in-progress', 'completed')` (DEFAULT 'in-progress')| Estado de progreso del estudiante en el curso. |
| `final_score`| `DECIMAL(5,2)` (NULL) | Calificación final obtenida al completar el curso. |
| *Constraint* | `UNIQUE(student_id, course_id)` | Un estudiante no puede inscribirse dos veces en el mismo curso. |

---

### 15. `evaluation_submissions`

Guarda un registro de cada vez que un estudiante completa una evaluación para un módulo.

| Columna | Tipo | Descripción |
| :--- | :--- | :--- |
| **`id`** | `INT` (PK, Auto-Increment) | Identificador único del envío. |
| `student_id` | `INT` (FK -> `users.id`) | ID del estudiante que realizó la evaluación. |
| `module_id` | `INT` (FK -> `course_modules.id`)| ID del módulo evaluado. |
| `score` | `DECIMAL(5, 2)` | Calificación obtenida (Ej: 95.50). |
| `passed` | `BOOLEAN` | `TRUE` si la calificación fue aprobatoria, `FALSE` si no. |
| `submitted_at`| `TIMESTAMP` (DEFAULT NOW())| Fecha y hora del envío. |

```sql
CREATE TABLE `evaluation_submissions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `student_id` int NOT NULL,
  `module_id` int NOT NULL,
  `score` decimal(5,2) DEFAULT NULL,
  `passed` tinyint(1) DEFAULT NULL,
  `submitted_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `student_id` (`student_id`),
  KEY `module_id` (`module_id`),
  CONSTRAINT `evaluation_submissions_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `evaluation_submissions_ibfk_2` FOREIGN KEY (`module_id`) REFERENCES `course_modules` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```


---

### 16. `app_settings`

Almacena configuraciones globales de la aplicación, como los prompts de la IA activos.

| Columna | Tipo | Descripción |
| :--- | :--- | :--- |
| **`key`** | `VARCHAR(255)` (PK) | La clave única de la configuración (Ej: 'adminSyllabusPrompt'). |
| `value` | `TEXT` | El valor de la configuración. |

`CREATE TABLE app_settings ( `key` varchar(255) NOT NULL, `value` text, PRIMARY KEY (`key`) ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`

---

### 17. `prompt_history`

Guarda un registro histórico de todos los prompts que se han guardado en la aplicación.

| Columna | Tipo | Descripción |
| :--- | :--- | :--- |
| **`id`** | `INT` (PK, Auto-Increment) | Identificador único del registro del historial. |
| `prompt_type` | `ENUM('syllabus', 'questionnaire')` | El tipo de prompt guardado. |
| `content` | `TEXT` | El texto completo del prompt. |
| `saved_at` | `TIMESTAMP` (DEFAULT NOW()) | Fecha y hora en que se guardó el prompt. |

`CREATE TABLE `prompt_history` ( `id` int NOT NULL AUTO_INCREMENT, `prompt_type` enum('syllabus','questionnaire') COLLATE utf8mb4_unicode_ci NOT NULL, `content` text COLLATE utf8mb4_unicode_ci, `saved_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (`id`) ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`
---

### 18. `badges` (Gamificación)

Almacena las definiciones de todas las insignias que se pueden ganar.

| Columna | Tipo | Descripción |
| :--- | :--- | :--- |
| **`id`** | `INT` (PK, Auto-Increment) | Identificador único de la insignia. |
| `name` | `VARCHAR(255)` (NOT NULL) | Nombre de la insignia (Ej: "Puntuación Perfecta"). |
| `description`| `TEXT` | Descripción de cómo ganar la insignia. |
| `icon_id` | `VARCHAR(100)` (NOT NULL) | Identificador del icono para mostrar en el frontend. |
| `criteria_type`| `ENUM(...)` (NOT NULL) | Tipo de criterio: 'SCORE', 'COURSE_COMPLETION', 'FIRST_PASS'. |
| `criteria_value`| `INT` | Valor numérico para el criterio (Ej: 100 para `SCORE`). Opcional. |

`CREATE TABLE `badges` ( `id` int NOT NULL AUTO_INCREMENT, `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL, `description` text COLLATE utf8mb4_unicode_ci, `icon_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL, `criteria_type` enum('SCORE','COURSE_COMPLETION','FIRST_PASS') COLLATE utf8mb4_unicode_ci NOT NULL, `criteria_value` int DEFAULT NULL, PRIMARY KEY (`id`) ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`

*Datos de ejemplo:*
`INSERT INTO `badges` (name, description, icon_id, criteria_type, criteria_value) VALUES ('Primeros Pasos', 'Has aprobado tu primera evaluación.', 'first_pass', 'FIRST_PASS', NULL), ('Puntuación Perfecta', 'Has conseguido un 100% en una evaluación.', 'perfect_score', 'SCORE', 100), ('Curso Completado', 'Has completado todos los módulos de un curso.', 'course_completion', 'COURSE_COMPLETION', NULL);`

---

### 19. `user_badges` (Gamificación)

Tabla pivote que registra qué insignias ha ganado cada usuario.

| Columna | Tipo | Descripción |
| :--- | :--- | :--- |
| **`id`** | `INT` (PK, Auto-Increment) | Identificador único del logro. |
| `user_id` | `INT` (FK -> `users.id`) | ID del usuario que ganó la insignia. |
| `badge_id` | `INT` (FK -> `badges.id`) | ID de la insignia ganada. |
| `earned_at` | `TIMESTAMP` (DEFAULT NOW()) | Fecha y hora en que se ganó la insignia. |
| *Constraint* | `UNIQUE(user_id, badge_id)` | Un usuario no puede ganar la misma insignia dos veces. |

`CREATE TABLE `user_badges` ( `id` int NOT NULL AUTO_INCREMENT, `user_id` int NOT NULL, `badge_id` int NOT NULL, `earned_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (`id`), UNIQUE KEY `user_badge_unique` (`user_id`,`badge_id`), KEY `user_id_fk` (`user_id`), KEY `badge_id_fk` (`badge_id`), CONSTRAINT `user_badges_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE, CONSTRAINT `user_badges_ibfk_2` FOREIGN KEY (`badge_id`) REFERENCES `badges` (`id`) ON DELETE CASCADE ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4_unicode_ci;`

---

### 20. `notifications`

Almacena notificaciones para los usuarios sobre eventos importantes.

| Columna | Tipo | Descripción |
| :--- | :--- | :--- |
| **`id`** | `INT` (PK, Auto-Increment) | Identificador único de la notificación. |
| `user_id` | `INT` (FK -> `users.id`) | ID del usuario al que se le envía la notificación. |
| `title` | `VARCHAR(255)` (NOT NULL) | Título de la notificación (Ej: "Nuevo curso asignado"). |
| `description` | `TEXT` | El cuerpo de la notificación. |
| `link` | `VARCHAR(255)` | Enlace opcional para redirigir al usuario al hacer clic. |
| `is_read` | `BOOLEAN` (NOT NULL, DEFAULT 0) | `TRUE` si el usuario ha leído la notificación. |
| `created_at` | `TIMESTAMP` (DEFAULT NOW()) | Fecha y hora de creación. |

`CREATE TABLE `notifications` ( `id` int NOT NULL AUTO_INCREMENT, `user_id` int NOT NULL, `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL, `description` text COLLATE utf8mb4_unicode_ci, `link` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL, `is_read` tinyint(1) NOT NULL DEFAULT '0', `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (`id`), KEY `user_id` (`user_id`), CONSTRAINT `notifications_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`

---

### 21. `ai_models`

Almacena los modelos de IA disponibles para la generación de contenido.

| Columna | Tipo | Descripción |
| :--- | :--- | :--- |
| **`id`** | `VARCHAR(255)` (PK) | El identificador del modelo usado en la API (ej: 'gpt-4o-mini'). |
| `name` | `VARCHAR(255)` | Nombre para mostrar en la interfaz (ej: 'OpenAI GPT-4o Mini'). |
| `pricing_input` | `VARCHAR(255)` | Texto descriptivo del precio de entrada (ej: '$3.50 / 1M tokens'). |
| `pricing_output` | `VARCHAR(255)` | Texto descriptivo del precio de salida (ej: '$10.50 / 1M tokens'). |
| `status` | `ENUM('active', 'inactive')` (DEFAULT 'active') | Si el modelo está disponible para ser seleccionado. |

---


## Consideraciones Adicionales

*   **Índices:** Deberías añadir índices a todas las columnas de clave foránea (`teacher_id`, `course_id`, `module_id`, `student_id`, `category_id`, `shared_file_id`) para acelerar las consultas.
*   **Seguridad:** Recuerda que las contraseenas nunca deben guardarse como texto plano. Utiliza funciones de hash seguras como `bcrypt`.
*   **Transacciones:** Para operaciones complejas (como inscribir un alumno o crear un curso completo con módulos), es recomendable usar transacciones para asegurar la integridad de los datos.

Espero que esta estructura te sirva como una excelente base para construir tu backend. ¡Es un buen punto de partida para un sistema robusto!

    
  

    
