-- Este script limpia las tablas de insignias y las repuebla con un conjunto nuevo y creativo.
-- También asigna todas las nuevas insignias a un usuario específico para demostración.

-- Limpiar datos existentes para evitar duplicados
DELETE FROM `user_badges`;
DELETE FROM `badges`;
ALTER TABLE `badges` AUTO_INCREMENT = 1;

-- Insignias de Iniciación
INSERT INTO `badges` (name, description, icon_id, criteria_type, criteria_value) VALUES 
('Explorador', 'Has dado el primer paso inscribiéndote en un curso. ¡El viaje del conocimiento comienza!', 'first_course', 'FIRST_COURSE', NULL),
('Primeros Pasos', '¡Felicidades! Has aprobado tu primera evaluación.', 'first_pass', 'FIRST_PASS', NULL),
('Velocista', 'Aprobaste una evaluación en tu primer intento. ¡Impresionante!', 'first_try', 'FIRST_TRY', NULL);

-- Insignias de Rendimiento
INSERT INTO `badges` (name, description, icon_id, criteria_type, criteria_value) VALUES 
('Puntuación Perfecta', '¡100%! Has dominado completamente el material de una evaluación.', 'perfect_score', 'SCORE', 100),
('Racha de Genio', 'Tres puntuaciones perfectas seguidas. Estás en otro nivel.', 'perfect_streak', 'PERFECT_STREAK', 3);

-- Insignias de Finalización
INSERT INTO `badges` (name, description, icon_id, criteria_type, criteria_value) VALUES 
('Curso Completado', 'Has completado todos los módulos de un curso. ¡Bien hecho!', 'course_completion', 'COURSE_COMPLETION', NULL),
('Aprendiz Constante', 'Has completado un total de 3 cursos. Tu dedicación es admirable.', 'course_count', 'COURSE_COUNT', 3),
('Sabio de la Tribu', 'Completaste 5 cursos. Te has convertido en un pilar de conocimiento en nuestra comunidad.', 'course_count_pro', 'COURSE_COUNT', 5);


-- Asignar todas las insignias al usuario 'sistemas@thaliavictoria.com.ec' para demostración
-- ATENCIÓN: Asegúrate de que el usuario con este email exista en tu tabla `users`.
SET @userId = (SELECT id FROM `users` WHERE `email` = 'sistemas@thaliavictoria.com.ec' LIMIT 1);

INSERT INTO `user_badges` (user_id, badge_id)
SELECT @userId, id FROM `badges` WHERE @userId IS NOT NULL;

SELECT 'Script de insignias ejecutado correctamente.' AS status;
