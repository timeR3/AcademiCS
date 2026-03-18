-- ----------------------------------------------------------------------------
-- Script para insertar insignias de ejemplo y asignarlas a un usuario
-- ----------------------------------------------------------------------------

-- Paso 1: Insertar las definiciones de las insignias en la tabla `badges`.
-- Se utiliza `INSERT IGNORE` para evitar errores si las insignias ya existen con esos nombres.

INSERT IGNORE INTO `badges` (name, description, icon_id, criteria_type, criteria_value) VALUES 
('Primeros Pasos', 'Has aprobado tu primera evaluación.', 'first_pass', 'FIRST_PASS', NULL),
('Puntuación Perfecta', 'Has conseguido un 100% en una evaluación.', 'perfect_score', 'SCORE', 100),
('Curso Completado', 'Has completado todos los módulos de un curso.', 'course_completion', 'COURSE_COMPLETION', NULL);

-- ----------------------------------------------------------------------------

-- Paso 2: Asignar las insignias al usuario 'sistemas@thaliavictoria.com.ec'.
-- Este bloque de código encuentra el ID del usuario y los IDs de las insignias,
-- y luego las inserta en la tabla `user_badges`.

SET @user_email = 'sistemas@thaliavictoria.com.ec';
SET @user_id = (SELECT id FROM users WHERE email = @user_email LIMIT 1);

-- Si el usuario existe, proceder a asignar las insignias.
IF @user_id IS NOT NULL THEN

    -- Asignar la insignia "Primeros Pasos"
    SET @badge_id_first_pass = (SELECT id FROM badges WHERE name = 'Primeros Pasos' LIMIT 1);
    IF @badge_id_first_pass IS NOT NULL THEN
        INSERT IGNORE INTO user_badges (user_id, badge_id, earned_at) VALUES (@user_id, @badge_id_first_pass, NOW());
    END IF;

    -- Asignar la insignia "Puntuación Perfecta"
    SET @badge_id_perfect_score = (SELECT id FROM badges WHERE name = 'Puntuación Perfecta' LIMIT 1);
    IF @badge_id_perfect_score IS NOT NULL THEN
        INSERT IGNORE INTO user_badges (user_id, badge_id, earned_at) VALUES (@user_id, @badge_id_perfect_score, NOW());
    END IF;

    -- Asignar la insignia "Curso Completado"
    SET @badge_id_course_completion = (SELECT id FROM badges WHERE name = 'Curso Completado' LIMIT 1);
    IF @badge_id_course_completion IS NOT NULL THEN
        INSERT IGNORE INTO user_badges (user_id, badge_id, earned_at) VALUES (@user_id, @badge_id_course_completion, NOW());
    END IF;

    SELECT CONCAT('Insignias asignadas correctamente al usuario con ID: ', @user_id) as 'Resultado';

ELSE
    SELECT 'El usuario con el correo especificado no fue encontrado.' as 'Resultado';
END IF;

-- ----------------------------------------------------------------------------
