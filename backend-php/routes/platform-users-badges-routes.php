<?php
declare(strict_types=1);

function notificationPreferenceTypes(): array {
    return [
        'course_enrollment',
        'course_due_soon',
        'course_due_expired',
        'inactivity_reminder',
        'course_updated',
        'course_status_change',
        'course_due_date_changed',
        'evaluation_result',
        'module_unlocked',
        'course_completed',
    ];
}

function notificationGlobalSettingKey(string $type): string {
    $map = [
        'course_enrollment' => 'notifGlobalCourseEnrollment',
        'course_due_soon' => 'notifGlobalCourseDueSoon',
        'course_due_expired' => 'notifGlobalCourseDueExpired',
        'inactivity_reminder' => 'notifGlobalInactivityReminder',
        'course_updated' => 'notifGlobalCourseUpdated',
        'course_status_change' => 'notifGlobalCourseStatusChange',
        'course_due_date_changed' => 'notifGlobalCourseDueDateChanged',
        'evaluation_result' => 'notifGlobalEvaluationResult',
        'module_unlocked' => 'notifGlobalModuleUnlocked',
        'course_completed' => 'notifGlobalCourseCompleted',
    ];
    return $map[$type] ?? '';
}

function hasNotificationPreferencesTable(): bool {
    static $exists = null;
    if ($exists !== null) {
        return $exists;
    }
    $exists = (int)(one(
        "SELECT COUNT(*) AS total
         FROM INFORMATION_SCHEMA.TABLES
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'notification_preferences'"
    )['total'] ?? 0) > 0;
    return $exists;
}

function defaultNotificationPreferences(): array {
    $defaults = [];
    foreach (notificationPreferenceTypes() as $type) {
        $defaults[$type] = true;
    }
    return $defaults;
}

function userNotificationPreferences(int $userId): array {
    $preferences = defaultNotificationPreferences();
    if (!hasNotificationPreferencesTable()) {
        return $preferences;
    }
    $rows = many('SELECT notification_type, enabled FROM notification_preferences WHERE user_id = ?', [$userId]);
    foreach ($rows as $row) {
        $type = (string)($row['notification_type'] ?? '');
        if ($type === '' || !array_key_exists($type, $preferences)) {
            continue;
        }
        $preferences[$type] = (int)($row['enabled'] ?? 0) === 1;
    }
    return $preferences;
}

function notificationAllowedForUser(int $userId, string $type): bool {
    $settingKey = notificationGlobalSettingKey($type);
    if ($settingKey !== '') {
        $global = one('SELECT `value` FROM app_settings WHERE `key` = ? LIMIT 1', [$settingKey]);
        if ($global && strtolower(trim((string)$global['value'])) === 'false') {
            return false;
        }
    }
    if (!hasNotificationPreferencesTable()) {
        return true;
    }
    $row = one('SELECT enabled FROM notification_preferences WHERE user_id = ? AND notification_type = ? LIMIT 1', [$userId, $type]);
    if (!$row) {
        return true;
    }
    return (int)($row['enabled'] ?? 0) === 1;
}

function ensureUpcomingCourseDeadlineNotifications(int $userId): void {
    $hasDueDate = (int)(one(
        "SELECT COUNT(*) AS total
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'course_enrollments'
           AND COLUMN_NAME = 'due_date'"
    )['total'] ?? 0) > 0;
    if (!$hasDueDate) {
        return;
    }
    $rows = many(
        'SELECT ce.course_id, ce.due_date, c.title
         FROM course_enrollments ce
         JOIN courses c ON c.id = ce.course_id
         WHERE ce.student_id = ?
           AND ce.due_date IS NOT NULL
           AND ce.due_date > NOW()
           AND ce.due_date <= DATE_ADD(NOW(), INTERVAL 24 HOUR)',
        [$userId]
    );
    foreach ($rows as $row) {
        $courseId = (int)($row['course_id'] ?? 0);
        $courseTitle = (string)($row['title'] ?? 'curso');
        $link = $courseId > 0 ? '/courses/' . $courseId : '/';
        $dueDateRaw = (string)($row['due_date'] ?? '');
        $dueDate = new DateTime($dueDateRaw);
        $dueDateLabel = $dueDate->format('d/m/Y H:i');
        $title = 'Vencimiento próximo de curso';
        $description = 'Tu curso "' . $courseTitle . '" vence el ' . $dueDateLabel . '. Revisa tus módulos pendientes.';
        if (!notificationAllowedForUser($userId, 'course_due_soon')) {
            continue;
        }
        $existing = one(
            'SELECT id
             FROM notifications
             WHERE user_id = ? AND title = ? AND link = ? AND description = ? AND is_read = 0
             LIMIT 1',
            [$userId, $title, $link, $description]
        );
        if ($existing) {
            continue;
        }
        execSql(
            'INSERT INTO notifications (user_id, title, description, link) VALUES (?, ?, ?, ?)',
            [$userId, $title, $description, $link]
        );
    }
}

function ensureExpiredCourseDeadlineNotifications(int $userId): void {
    $hasDueDate = (int)(one(
        "SELECT COUNT(*) AS total
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'course_enrollments'
           AND COLUMN_NAME = 'due_date'"
    )['total'] ?? 0) > 0;
    if (!$hasDueDate) {
        return;
    }
    $rows = many(
        'SELECT ce.course_id, ce.due_date, c.title
         FROM course_enrollments ce
         JOIN courses c ON c.id = ce.course_id
         WHERE ce.student_id = ?
           AND ce.due_date IS NOT NULL
           AND ce.due_date <= NOW()
           AND ce.due_date >= DATE_SUB(NOW(), INTERVAL 24 HOUR)',
        [$userId]
    );
    foreach ($rows as $row) {
        $courseId = (int)($row['course_id'] ?? 0);
        $courseTitle = (string)($row['title'] ?? 'curso');
        $link = $courseId > 0 ? '/courses/' . $courseId : '/';
        $dueDateRaw = (string)($row['due_date'] ?? '');
        $dueDate = new DateTime($dueDateRaw);
        $dueDateLabel = $dueDate->format('d/m/Y H:i');
        $title = 'Curso vencido';
        $description = 'El curso "' . $courseTitle . '" venció el ' . $dueDateLabel . '. Revisa tu progreso y solicita una prórroga si aplica.';
        if (!notificationAllowedForUser($userId, 'course_due_expired')) {
            continue;
        }
        $existing = one(
            'SELECT id
             FROM notifications
             WHERE user_id = ? AND title = ? AND link = ? AND description = ?
             LIMIT 1',
            [$userId, $title, $link, $description]
        );
        if ($existing) {
            continue;
        }
        execSql(
            'INSERT INTO notifications (user_id, title, description, link) VALUES (?, ?, ?, ?)',
            [$userId, $title, $description, $link]
        );
    }
}

function ensureInactivityNotifications(int $userId): void {
    if (!notificationAllowedForUser($userId, 'inactivity_reminder')) {
        return;
    }
    $hasLastLoginAt = (int)(one(
        "SELECT COUNT(*) AS total
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'users'
           AND COLUMN_NAME = 'last_login_at'"
    )['total'] ?? 0) > 0;
    $activityQuery = $hasLastLoginAt
        ? 'SELECT MAX(activity_at) AS last_activity_at
           FROM (
              SELECT u.last_login_at AS activity_at
              FROM users u
              WHERE u.id = ?
              UNION ALL
              SELECT es.submitted_at AS activity_at
              FROM evaluation_submissions es
              WHERE es.student_id = ?
           ) activity'
        : 'SELECT MAX(activity_at) AS last_activity_at
           FROM (
              SELECT es.submitted_at AS activity_at
              FROM evaluation_submissions es
              WHERE es.student_id = ?
           ) activity';
    $activityRow = $hasLastLoginAt ? one($activityQuery, [$userId, $userId]) : one($activityQuery, [$userId]);
    $lastActivityRaw = isset($activityRow['last_activity_at']) ? (string)$activityRow['last_activity_at'] : '';
    if ($lastActivityRaw === '') {
        return;
    }
    $hasActiveEnrollments = (int)(one(
        'SELECT COUNT(*) AS total
         FROM course_enrollments
         WHERE student_id = ?',
        [$userId]
    )['total'] ?? 0) > 0;
    if (!$hasActiveEnrollments) {
        return;
    }
    $lastActivity = new DateTime($lastActivityRaw);
    $now = new DateTime('now');
    $secondsDiff = $now->getTimestamp() - $lastActivity->getTimestamp();
    if ($secondsDiff < 3 * 24 * 60 * 60) {
        return;
    }
    $title = 'Recordatorio de actividad';
    $description = 'Han pasado varios días sin actividad en tus cursos. Continúa con tu ruta para mantener el progreso.';
    $existing = one(
        'SELECT id
         FROM notifications
         WHERE user_id = ?
           AND title = ?
           AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
         LIMIT 1',
        [$userId, $title]
    );
    if ($existing) {
        return;
    }
    execSql(
        'INSERT INTO notifications (user_id, title, description, link) VALUES (?, ?, ?, ?)',
        [$userId, $title, $description, '/']
    );
}

function handlePlatformUsersBadgesRoutes(string $method, string $path): void {
    if ($method === 'GET' && $path === '/api/badges') {
        $rows = many('SELECT id, name, description, icon_id, criteria_type, criteria_value FROM badges');
        $data = array_map(fn(array $row): array => [
            'id' => (string)$row['id'],
            'name' => $row['name'],
            'description' => $row['description'],
            'iconId' => $row['icon_id'],
            'criteriaType' => $row['criteria_type'],
            'criteriaValue' => $row['criteria_value'] !== null ? (float)$row['criteria_value'] : null,
        ], $rows);
        jsonResponse(200, ['data' => $data]);
    }

    if ($method === 'POST' && $path === '/api/badges') {
        $payload = parseBody();
        $id = isset($payload['id']) ? (int)$payload['id'] : 0;
        $criteriaValue = isset($payload['criteriaValue']) ? (float)$payload['criteriaValue'] : null;
        if ($id > 0) {
            execSql(
                'UPDATE badges SET name = ?, description = ?, icon_id = ?, criteria_type = ?, criteria_value = ? WHERE id = ?',
                [(string)$payload['name'], (string)$payload['description'], (string)$payload['iconId'], (string)$payload['criteriaType'], $criteriaValue, $id]
            );
        } else {
            execSql(
                'INSERT INTO badges (name, description, icon_id, criteria_type, criteria_value) VALUES (?, ?, ?, ?, ?)',
                [(string)$payload['name'], (string)$payload['description'], (string)$payload['iconId'], (string)$payload['criteriaType'], $criteriaValue]
            );
        }
        jsonResponse(200, ['data' => ['success' => true]]);
    }

    if ($method === 'GET' && preg_match('#^/api/users/(\d+)/badges$#', $path, $matches)) {
        $userId = (int)$matches[1];
        $rows = many(
            'SELECT b.id, b.name, b.description, b.icon_id, b.criteria_type, b.criteria_value
             FROM badges b
             JOIN user_badges ub ON b.id = ub.badge_id
             WHERE ub.user_id = ?
             ORDER BY ub.earned_at DESC',
            [$userId]
        );
        $data = array_map(fn(array $row): array => [
            'id' => (string)$row['id'],
            'name' => $row['name'],
            'description' => $row['description'],
            'iconId' => $row['icon_id'],
            'criteriaType' => $row['criteria_type'],
            'criteriaValue' => $row['criteria_value'] !== null ? (float)$row['criteria_value'] : null,
        ], $rows);
        jsonResponse(200, ['data' => $data]);
    }

    if ($method === 'PATCH' && preg_match('#^/api/users/(\d+)$#', $path, $matches)) {
        $userId = (int)$matches[1];
        $payload = parseBody();
        $pdo = db();
        $pdo->beginTransaction();
        try {
            $fields = [];
            $params = [];
            foreach (['name', 'email', 'status'] as $field) {
                if (isset($payload[$field]) && trim((string)$payload[$field]) !== '') {
                    $fields[] = "{$field} = ?";
                    $params[] = (string)$payload[$field];
                }
            }
            if (isset($payload['password']) && (string)$payload['password'] !== '') {
                $fields[] = 'password_hash = ?';
                $params[] = password_hash((string)$payload['password'], PASSWORD_BCRYPT);
            }
            if (count($fields) > 0) {
                $params[] = $userId;
                execSql('UPDATE users SET ' . implode(', ', $fields) . ' WHERE id = ?', $params);
            }
            if (isset($payload['roles']) && is_array($payload['roles'])) {
                execSql('DELETE FROM user_roles WHERE user_id = ?', [$userId]);
                foreach ($payload['roles'] as $roleName) {
                    $role = one('SELECT id FROM roles WHERE name = ?', [(string)$roleName]);
                    if ($role) {
                        execSql('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [$userId, (int)$role['id']]);
                    }
                }
            }
            $pdo->commit();
            jsonResponse(200, ['data' => ['success' => true]]);
        } catch (Throwable $error) {
            $pdo->rollBack();
            throw $error;
        }
    }

    if ($method === 'PATCH' && preg_match('#^/api/users/(\d+)/profile$#', $path, $matches)) {
        $userId = (int)$matches[1];
        $payload = parseBody();
        $fields = [];
        $params = [];
        if (isset($payload['name']) && trim((string)$payload['name']) !== '') {
            $fields[] = 'name = ?';
            $params[] = trim((string)$payload['name']);
        }
        if (isset($payload['password']) && (string)$payload['password'] !== '') {
            $fields[] = 'password_hash = ?';
            $params[] = password_hash((string)$payload['password'], PASSWORD_BCRYPT);
        }
        if (count($fields) === 0) {
            jsonResponse(400, ['error' => 'No se proporcionó ningún dato para actualizar.']);
        }
        $params[] = $userId;
        execSql('UPDATE users SET ' . implode(', ', $fields) . ' WHERE id = ?', $params);
        jsonResponse(200, ['data' => ['success' => true]]);
    }

    if ($method === 'GET' && preg_match('#^/api/users/(\d+)/notification-preferences$#', $path, $matches)) {
        $userId = (int)$matches[1];
        $preferences = userNotificationPreferences($userId);
        jsonResponse(200, ['data' => $preferences]);
    }

    if ($method === 'PATCH' && preg_match('#^/api/users/(\d+)/notification-preferences$#', $path, $matches)) {
        $userId = (int)$matches[1];
        $payload = parseBody();
        if (!hasNotificationPreferencesTable()) {
            jsonResponse(400, ['error' => 'La tabla de preferencias de notificaciones no existe. Ejecuta migraciones.']);
        }
        $types = notificationPreferenceTypes();
        foreach ($types as $type) {
            if (!array_key_exists($type, $payload)) {
                continue;
            }
            $raw = $payload[$type];
            $enabled = $raw === true || $raw === 1 || $raw === '1' || $raw === 'true';
            execSql(
                'INSERT INTO notification_preferences (user_id, notification_type, enabled, updated_at) VALUES (?, ?, ?, NOW())
                 ON DUPLICATE KEY UPDATE enabled = VALUES(enabled), updated_at = NOW()',
                [$userId, $type, $enabled ? 1 : 0]
            );
        }
        jsonResponse(200, ['data' => ['success' => true]]);
    }

    if ($method === 'GET' && preg_match('#^/api/users/(\d+)/notifications$#', $path, $matches)) {
        $userId = (int)$matches[1];
        ensureUpcomingCourseDeadlineNotifications($userId);
        ensureExpiredCourseDeadlineNotifications($userId);
        ensureInactivityNotifications($userId);
        $rows = many('SELECT id, title, description, link, is_read, created_at FROM notifications WHERE user_id = ? AND is_read = 0 ORDER BY created_at DESC LIMIT 10', [$userId]);
        $data = array_map(fn(array $row): array => [
            'id' => (string)$row['id'],
            'title' => $row['title'],
            'description' => $row['description'],
            'link' => $row['link'],
            'isRead' => (int)$row['is_read'] === 1,
            'createdAt' => (new DateTime((string)$row['created_at']))->format(DateTime::ATOM),
        ], $rows);
        jsonResponse(200, ['data' => $data]);
    }

    if ($method === 'PATCH' && preg_match('#^/api/users/(\d+)/notifications/read$#', $path, $matches)) {
        $userId = (int)$matches[1];
        $payload = parseBody();
        $ids = isset($payload['notificationIds']) && is_array($payload['notificationIds']) ? array_values(array_filter(array_map('intval', $payload['notificationIds']), fn(int $value): bool => $value > 0)) : [];
        if (count($ids) > 0) {
            $placeholders = implode(',', array_fill(0, count($ids), '?'));
            $params = array_merge([$userId], $ids);
            execSql("UPDATE notifications SET is_read = 1 WHERE user_id = ? AND id IN ({$placeholders})", $params);
        }
        jsonResponse(200, ['data' => ['success' => true]]);
    }

    if ($method === 'DELETE' && preg_match('#^/api/badges/(\d+)$#', $path, $matches)) {
        $badgeId = (int)$matches[1];
        $pdo = db();
        $pdo->beginTransaction();
        try {
            execSql('DELETE FROM user_badges WHERE badge_id = ?', [$badgeId]);
            execSql('DELETE FROM badges WHERE id = ?', [$badgeId]);
            $pdo->commit();
            jsonResponse(200, ['data' => ['success' => true]]);
        } catch (Throwable $error) {
            $pdo->rollBack();
            throw $error;
        }
    }
}
