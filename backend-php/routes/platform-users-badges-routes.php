<?php
declare(strict_types=1);

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

    if ($method === 'GET' && preg_match('#^/api/users/(\d+)/notifications$#', $path, $matches)) {
        $userId = (int)$matches[1];
        $rows = many('SELECT id, title, description, link, is_read, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 10', [$userId]);
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
