# Esquema de Base de Datos para AcademiCS (MySQL)

Este documento describe una posible estructura de tablas para una base de datos MySQL que soporte la aplicación AcademiCS, incluyendo un sistema de múltiples roles.

## Diagrama de Relaciones (Simplificado)

```
[users] 1--< [user_roles] >--1 [roles]
   |
   |
[users] 1--< [courses] 1--< [course_modules] 1--< [module_syllabus]
   |             |                         |
   |             |                         '--< [module_questions]
   |             |
   |             '--< [course_source_files]
   |
[users] 1--< [course_enrollments] >--1 [courses]
   |
[users] 1--< [evaluation_submissions] >--1 [course_modules]
   |
[users] 1--< [user_badges] >--1 [badges]
   |
[users] 1--< [notifications]

[app_settings]
   |
   '--< [prompt_history] (conceptual)

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


### 4. `courses`

Almacena la información principal de cada curso.

| Columna | Tipo | Descripción |
| :--- | :--- | :--- |
| **`id`** | `INT` (PK, Auto-Increment) | Identificador único del curso. |
| `title` | `VARCHAR(255)` | Título del curso. |
| `teacher_id` | `INT` (FK -> `users.id`) | ID del profesor que creó y gestiona el curso. |
| `status` | `ENUM('active', 'archived')` (DEFAULT 'active') | Estado del curso para soft-delete. |
| `created_at` | `TIMESTAMP` (DEFAULT NOW()) | Fecha y hora de creación. |

---

### 5. `course_source_files`

Almacena los nombres de los archivos originales usados para generar el contenido de un curso.

| Columna | Tipo | Descripción |
| :--- | :--- | :--- |
| **`id`** | `INT` (PK, Auto-Increment) | Identificador único del registro del archivo. |
| `course_id` | `INT` (FK -> `courses.id`) | ID del curso al que pertenece este archivo fuente. |
| `file_name` | `VARCHAR(255)` | Nombre original del archivo (Ej: "Introduccion_a_React.pdf"). |
| `uploaded_at` | `TIMESTAMP` (DEFAULT NOW()) | Fecha y hora de subida. |

---

### 6. `course_modules`

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

### 7. `module_syllabus`

Almacena las secciones de contenido (el temario) para cada módulo.

| Columna | Tipo | Descripción |
| :--- | :--- | :--- |
| **`id`** | `INT` (PK, Auto-Increment) | Identificador único de la sección de contenido. |
| `module_id` | `INT` (FK -> `course_modules.id`)| ID del módulo al que pertenece este contenido. |
| `title` | `VARCHAR(255)` | Título de la sección (Ej: "El Hook useState"). |
| `content` | `TEXT` | El contenido detallado de la sección. |
| `created_at` | `TIMESTAMP` (DEFAULT NOW()) | Fecha y hora de creación. |

---

### 8. `module_questions`

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

### 9. `course_enrollments`

Tabla pivote para gestionar la inscripción de muchos estudiantes a muchos cursos.

| Columna | Tipo | Descripción |
| :--- | :--- | :--- |
| **`id`** | `INT` (PK, Auto-Increment) | Identificador único de la inscripción. |
| `student_id` | `INT` (FK -> `users.id`) | ID del estudiante inscrito. |
| `course_id` | `INT` (FK -> `courses.id`) | ID del curso al que se ha inscrito. |
| `enrolled_at` | `TIMESTAMP` (DEFAULT NOW()) | Fecha y hora de inscripción. |
| *Constraint* | `UNIQUE(student_id, course_id)` | Un estudiante no puede inscribirse dos veces en el mismo curso. |

---

### 10. `evaluation_submissions`

Guarda un registro de cada vez que un estudiante completa una evaluación para un módulo.

| Columna | Tipo | Descripción |
| :--- | :--- | :--- |
| **`id`** | `INT` (PK, Auto-Increment) | Identificador único del envío. |
| `student_id` | `INT` (FK -> `users.id`) | ID del estudiante que realizó la evaluación. |
| `module_id` | `INT` (FK -> `course_modules.id`)| ID del módulo evaluado. |
| `score` | `DECIMAL(5, 2)` | Calificación obtenida (Ej: 95.50). |
| `passed` | `BOOLEAN` | `TRUE` si la calificación fue aprobatoria, `FALSE` si no. |
| `submitted_at`| `TIMESTAMP` (DEFAULT NOW())| Fecha y hora del envío. |
| *Constraint* | `UNIQUE(student_id, module_id)` | Un estudiante solo puede tener una última entrega por módulo. |

---

### 11. `app_settings`

Almacena configuraciones globales de la aplicación, como los prompts de la IA activos.

| Columna | Tipo | Descripción |
| :--- | :--- | :--- |
| **`key`** | `VARCHAR(255)` (PK) | La clave única de la configuración (Ej: 'adminSyllabusPrompt'). |
| `value` | `TEXT` | El valor de la configuración. |

`CREATE TABLE app_settings ( \`key\` varchar(255) NOT NULL, \`value\` text, PRIMARY KEY (\`key\`) ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`

---

### 12. `prompt_history`

Guarda un registro histórico de todos los prompts que se han guardado en la aplicación.

| Columna | Tipo | Descripción |
| :--- | :--- | :--- |
| **`id`** | `INT` (PK, Auto-Increment) | Identificador único del registro del historial. |
| `prompt_type` | `ENUM('syllabus', 'questionnaire')` | El tipo de prompt guardado. |
| `content` | `TEXT` | El texto completo del prompt. |
| `saved_at` | `TIMESTAMP` (DEFAULT NOW()) | Fecha y hora en que se guardó el prompt. |

`CREATE TABLE \`prompt_history\` ( \`id\` int NOT NULL AUTO_INCREMENT, \`prompt_type\` enum('syllabus','questionnaire') COLLATE utf8mb4_unicode_ci NOT NULL, \`content\` text COLLATE utf8mb4_unicode_ci, \`saved_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (\`id\`) ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`
---

### 13. `badges` (Gamificación)

Almacena las definiciones de todas las insignias que se pueden ganar.

| Columna | Tipo | Descripción |
| :--- | :--- | :--- |
| **`id`** | `INT` (PK, Auto-Increment) | Identificador único de la insignia. |
| `name` | `VARCHAR(255)` (NOT NULL) | Nombre de la insignia (Ej: "Puntuación Perfecta"). |
| `description`| `TEXT` | Descripción de cómo ganar la insignia. |
| `icon_id` | `VARCHAR(100)` (NOT NULL) | Identificador del icono para mostrar en el frontend. |
| `criteria_type`| `ENUM(...)` (NOT NULL) | Tipo de criterio: 'SCORE', 'COURSE_COMPLETION', 'FIRST_PASS'. |
| `criteria_value`| `INT` | Valor numérico para el criterio (Ej: 100 para `SCORE`). Opcional. |

`CREATE TABLE \`badges\` ( \`id\` int NOT NULL AUTO_INCREMENT, \`name\` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL, \`description\` text COLLATE utf8mb4_unicode_ci, \`icon_id\` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL, \`criteria_type\` enum('SCORE','COURSE_COMPLETION','FIRST_PASS') COLLATE utf8mb4_unicode_ci NOT NULL, \`criteria_value\` int DEFAULT NULL, PRIMARY KEY (\`id\`) ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`

*Datos de ejemplo:*
`INSERT INTO \`badges\` (name, description, icon_id, criteria_type, criteria_value) VALUES ('Primeros Pasos', 'Has aprobado tu primera evaluación.', 'first_pass', 'FIRST_PASS', NULL), ('Puntuación Perfecta', 'Has conseguido un 100% en una evaluación.', 'perfect_score', 'SCORE', 100), ('Curso Completado', 'Has completado todos los módulos de un curso.', 'course_completion', 'COURSE_COMPLETION', NULL);`

---

### 14. `user_badges` (Gamificación)

Tabla pivote que registra qué insignias ha ganado cada usuario.

| Columna | Tipo | Descripción |
| :--- | :--- | :--- |
| **`id`** | `INT` (PK, Auto-Increment) | Identificador único del logro. |
| `user_id` | `INT` (FK -> `users.id`) | ID del usuario que ganó la insignia. |
| `badge_id` | `INT` (FK -> `badges.id`) | ID de la insignia ganada. |
| `earned_at` | `TIMESTAMP` (DEFAULT NOW()) | Fecha y hora en que se ganó la insignia. |
| *Constraint* | `UNIQUE(user_id, badge_id)` | Un usuario no puede ganar la misma insignia dos veces. |

`CREATE TABLE \`user_badges\` ( \`id\` int NOT NULL AUTO_INCREMENT, \`user_id\` int NOT NULL, \`badge_id\` int NOT NULL, \`earned_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (\`id\`), UNIQUE KEY \`user_badge_unique\` (\`user_id\`,\`badge_id\`), KEY \`user_id_fk\` (\`user_id\`), KEY \`badge_id_fk\` (\`badge_id\`), CONSTRAINT \`user_badges_ibfk_1\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE, CONSTRAINT \`user_badges_ibfk_2\` FOREIGN KEY (\`badge_id\`) REFERENCES \`badges\` (\`id\`) ON DELETE CASCADE ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`

---

### 15. `notifications`

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

`CREATE TABLE \`notifications\` ( \`id\` int NOT NULL AUTO_INCREMENT, \`user_id\` int NOT NULL, \`title\` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL, \`description\` text COLLATE utf8mb4_unicode_ci, \`link\` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL, \`is_read\` tinyint(1) NOT NULL DEFAULT '0', \`created_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (\`id\`), KEY \`user_id\` (\`user_id\`), CONSTRAINT \`notifications_ibfk_1\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`

---

## Consideraciones Adicionales

*   **Índices:** Deberías añadir índices a todas las columnas de clave foránea (`teacher_id`, `course_id`, `module_id`, `student_id`) para acelerar las consultas.
*   **Seguridad:** Recuerda que las contraseenas nunca deben guardarse como texto plano. Utiliza funciones de hash seguras como `bcrypt`.
*   **Transacciones:** Para operaciones complejas (como inscribir un alumno o crear un curso completo con módulos), es recomendable usar transacciones para asegurar la integridad de los datos.

Espero que esta estructura te sirva como una excelente base para construir tu backend. ¡Es un buen punto de partida para un sistema robusto!
