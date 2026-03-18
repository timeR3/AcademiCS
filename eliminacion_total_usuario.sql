-- ====================================================================================
-- SCRIPT PARA ELIMINACIÓN COMPLETA DE UN USUARIO Y TODOS SUS DATOS ASOCIADOS
-- Versión 2.0 - Compatible con todos los clientes MySQL
-- ====================================================================================

-- 1. CONFIGURACIÓN:
--    Introduce aquí el email del usuario que deseas eliminar por completo.
SET @user_email = 'sistemas@thaliavictoria.com.ec';

-- ------------------------------------------------------------------------------------
-- No es necesario modificar nada debajo de esta línea.
-- El script buscará el ID del usuario y eliminará todos los datos relacionados.
-- Si el usuario no existe, el script simplemente no hará nada.
-- ------------------------------------------------------------------------------------

START TRANSACTION;

-- Obtener el ID del usuario para usarlo en las siguientes sentencias
SET @user_id = (SELECT id FROM users WHERE email = @user_email);

-- Eliminar cursos creados por el usuario (si es profesor).
-- Gracias a ON DELETE CASCADE, esto también eliminará:
-- - course_modules
-- - module_syllabus
-- - module_questions
-- - course_source_files (la relación, no el archivo compartido si otro curso lo usa)
-- - course_enrollments
DELETE FROM courses WHERE teacher_id = @user_id;

-- Eliminar inscripciones a cursos (si es estudiante)
DELETE FROM course_enrollments WHERE student_id = @user_id;

-- Eliminar envíos de evaluaciones (si es estudiante)
DELETE FROM evaluation_submissions WHERE student_id = @user_id;

-- Eliminar insignias ganadas por el usuario
DELETE FROM user_badges WHERE user_id = @user_id;

-- Eliminar notificaciones del usuario
DELETE FROM notifications WHERE user_id = @user_id;

-- Finalmente, eliminar al usuario principal.
-- Gracias a ON DELETE CASCADE, esto también eliminará las entradas en `user_roles`.
DELETE FROM users WHERE id = @user_id;

COMMIT;

-- Mensaje de finalización para el usuario que ejecuta el script.
SELECT CONCAT('Proceso de eliminación para el usuario ', @user_email, ' completado.') AS status;
