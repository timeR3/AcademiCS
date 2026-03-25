-- Migración para implementar el sistema de múltiples roles.
-- Esta migración asume que tienes usuarios existentes en tu tabla `users`
-- y quieres mantener sus roles actuales.

-- NOTA IMPORTANTE:
-- Antes de ejecutar, haz una copia de seguridad de tu tabla `users`.
-- Este script intenta preservar los roles, pero una copia de seguridad es siempre una buena práctica.

-- Paso 1: Crear la nueva tabla `roles`
-- Esta tabla almacenará los tipos de roles disponibles en la plataforma.
CREATE TABLE `roles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insertamos los roles estándar de la aplicación.
INSERT INTO `roles` (`id`, `name`) VALUES
(1, 'student'),
(2, 'teacher'),
(3, 'admin');

-- Paso 2: Crear la tabla pivote `user_roles`
-- Esta tabla vinculará a los usuarios con sus roles, permitiendo múltiples roles por usuario.
CREATE TABLE `user_roles` (
  `user_id` int NOT NULL,
  `role_id` int NOT NULL,
  PRIMARY KEY (`user_id`,`role_id`),
  KEY `role_id` (`role_id`),
  CONSTRAINT `user_roles_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_roles_ibfk_2` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Paso 3: Migrar los datos de la antigua columna `role` a las nuevas tablas.
-- ¡SOLO EJECUTAR SI TIENES UNA COLUMNA `role` EN TU TABLA `users`!
-- Si tu tabla de usuarios no tiene una columna `role`, puedes saltarte esta parte.

-- Primero, agregamos temporalmente una columna para el ID del rol a la tabla `users`.
ALTER TABLE `users` ADD COLUMN `temp_role_id` INT NULL;

-- Actualizamos esa columna temporal con el ID correspondiente al nombre del rol.
UPDATE `users` u
JOIN `roles` r ON u.role = r.name
SET u.temp_role_id = r.id;

-- Insertamos las relaciones en la nueva tabla `user_roles` basándonos en los datos migrados.
INSERT INTO `user_roles` (user_id, role_id)
SELECT id, temp_role_id
FROM `users`
WHERE temp_role_id IS NOT NULL;

-- Finalmente, eliminamos la columna `role` y la columna temporal `temp_role_id` de la tabla `users`.
ALTER TABLE `users` DROP COLUMN `role`;
ALTER TABLE `users` DROP COLUMN `temp_role_id`;

-- ¡Migración completa!
-- La estructura de la base de datos ahora soporta múltiples roles por usuario.
-- La información de roles existente ha sido migrada.
