<?php
declare(strict_types=1);

function handleAuthUserCategoryRoutes(string $method, string $path): void {
    if ($method === 'POST' && $path === '/api/auth/register') {
        $payload = parseBody();
        $name = trim((string)($payload['name'] ?? ''));
        $email = trim((string)($payload['email'] ?? ''));
        $password = (string)($payload['password'] ?? '');
        $role = trim((string)($payload['role'] ?? ''));
        if ($name === '' || $email === '' || $password === '' || $role === '') {
            jsonResponse(400, ['error' => 'Nombre, email, contraseña y rol son requeridos.']);
        }
        $pdo = db();
        $pdo->beginTransaction();
        try {
            $hash = password_hash($password, PASSWORD_BCRYPT);
            $stmt = $pdo->prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)');
            $stmt->execute([$name, $email, $hash]);
            $userId = (int)$pdo->lastInsertId();
            $roleRow = one('SELECT id FROM roles WHERE name = ?', [$role]);
            if (!$roleRow) {
                throw new RuntimeException('El rol no existe.');
            }
            execSql('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [$userId, (int)$roleRow['id']]);
            $pdo->commit();
            jsonResponse(201, ['data' => ['success' => true, 'userId' => $userId]]);
        } catch (Throwable $error) {
            $pdo->rollBack();
            if ($error instanceof PDOException && str_contains((string)$error->getMessage(), 'Duplicate')) {
                jsonResponse(400, ['error' => 'Este correo electrónico ya está registrado.']);
            }
            throw $error;
        }
    }

    if ($method === 'POST' && $path === '/api/auth/login') {
        $payload = parseBody();
        $email = trim((string)($payload['email'] ?? ''));
        $password = (string)($payload['password'] ?? '');
        if ($email === '' || $password === '') {
            jsonResponse(400, ['error' => 'Email y contraseña son requeridos.']);
        }
        $user = one('SELECT id, name, email, password_hash, status FROM users WHERE email = ?', [$email]);
        if (!$user || !password_verify($password, (string)$user['password_hash'])) {
            jsonResponse(401, ['error' => 'El correo electrónico o la contraseña son incorrectos.']);
        }
        if ($user['status'] !== 'active') {
            jsonResponse(401, ['error' => 'Esta cuenta de usuario está inactiva.']);
        }
        $hasLastLoginAt = (int)(one(
            "SELECT COUNT(*) AS total
             FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'users'
               AND COLUMN_NAME = 'last_login_at'"
        )['total'] ?? 0) > 0;
        if ($hasLastLoginAt) {
            execSql('UPDATE users SET last_login_at = NOW() WHERE id = ?', [(int)$user['id']]);
        }
        $roles = userRoles((int)$user['id']);
        jsonResponse(200, ['data' => [
            'id' => (string)$user['id'],
            'name' => $user['name'],
            'email' => $user['email'],
            'status' => $user['status'],
            'roles' => $roles,
        ]]);
    }

    if ($method === 'GET' && $path === '/api/users') {
        $hasLastLoginAt = (int)(one(
            "SELECT COUNT(*) AS total
             FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'users'
               AND COLUMN_NAME = 'last_login_at'"
        )['total'] ?? 0) > 0;
        if ($hasLastLoginAt) {
            $rows = many(
                'SELECT u.id, u.name, u.email, u.status, u.created_at, u.last_login_at, ua.last_activity_at, GROUP_CONCAT(r.name) AS roles
                 FROM users u
                 LEFT JOIN user_roles ur ON u.id = ur.user_id
                 LEFT JOIN roles r ON ur.role_id = r.id
                 LEFT JOIN (
                    SELECT activity.user_id, MAX(activity.activity_at) AS last_activity_at
                    FROM (
                        SELECT n.user_id, n.created_at AS activity_at FROM notifications n
                        UNION ALL
                        SELECT es.student_id AS user_id, es.submitted_at AS activity_at FROM evaluation_submissions es
                    ) activity
                    GROUP BY activity.user_id
                 ) ua ON ua.user_id = u.id
                 GROUP BY u.id, u.name, u.email, u.status, u.created_at, u.last_login_at, ua.last_activity_at'
            );
        } else {
            $rows = many(
                'SELECT u.id, u.name, u.email, u.status, u.created_at, NULL AS last_login_at, ua.last_activity_at, GROUP_CONCAT(r.name) AS roles
                 FROM users u
                 LEFT JOIN user_roles ur ON u.id = ur.user_id
                 LEFT JOIN roles r ON ur.role_id = r.id
                 LEFT JOIN (
                    SELECT activity.user_id, MAX(activity.activity_at) AS last_activity_at
                    FROM (
                        SELECT n.user_id, n.created_at AS activity_at FROM notifications n
                        UNION ALL
                        SELECT es.student_id AS user_id, es.submitted_at AS activity_at FROM evaluation_submissions es
                    ) activity
                    GROUP BY activity.user_id
                 ) ua ON ua.user_id = u.id
                 GROUP BY u.id, u.name, u.email, u.status, u.created_at, ua.last_activity_at'
            );
        }
        $data = array_map(fn(array $row): array => [
            'id' => (string)$row['id'],
            'name' => $row['name'],
            'email' => $row['email'],
            'status' => $row['status'],
            'roles' => $row['roles'] ? array_map('trim', explode(',', (string)$row['roles'])) : [],
            'createdAt' => isset($row['created_at']) && $row['created_at'] !== null ? (new DateTime((string)$row['created_at']))->format(DateTime::ATOM) : null,
            'lastLoginAt' => isset($row['last_login_at']) && $row['last_login_at'] !== null ? (new DateTime((string)$row['last_login_at']))->format(DateTime::ATOM) : null,
            'lastActivityAt' => isset($row['last_activity_at']) && $row['last_activity_at'] !== null ? (new DateTime((string)$row['last_activity_at']))->format(DateTime::ATOM) : null,
        ], $rows);
        jsonResponse(200, ['data' => $data]);
    }

    if ($method === 'GET' && $path === '/api/roles') {
        $rows = many('SELECT id, name FROM roles');
        $data = array_map(fn(array $row): array => ['id' => (string)$row['id'], 'name' => $row['name']], $rows);
        jsonResponse(200, ['data' => $data]);
    }

    if ($method === 'GET' && $path === '/api/categories') {
        $onlyActive = ($_GET['onlyActive'] ?? 'false') === 'true';
        if ($onlyActive) {
            $rows = many('SELECT id, name, status FROM course_categories WHERE status = "active" ORDER BY name ASC');
        } else {
            $rows = many(
                'SELECT cat.id, cat.name, cat.status, COUNT(c.id) AS courseCount
                 FROM course_categories cat
                 LEFT JOIN courses c ON c.category_id = cat.id
                 GROUP BY cat.id, cat.name, cat.status
                 ORDER BY cat.name ASC'
            );
        }
        $data = array_map(fn(array $row): array => [
            'id' => (string)$row['id'],
            'name' => $row['name'],
            'status' => $row['status'],
            'courseCount' => isset($row['courseCount']) ? (int)$row['courseCount'] : null,
        ], $rows);
        jsonResponse(200, ['data' => $data]);
    }

    if ($method === 'POST' && $path === '/api/categories') {
        $payload = parseBody();
        $name = trim((string)($payload['name'] ?? ''));
        if ($name === '') {
            jsonResponse(400, ['error' => 'El nombre de la categoría es requerido.']);
        }
        execSql('INSERT INTO course_categories (name) VALUES (?)', [$name]);
        jsonResponse(200, ['data' => ['success' => true, 'categoryId' => (int)db()->lastInsertId()]]);
    }

    if ($method === 'PATCH' && $path === '/api/categories') {
        $payload = parseBody();
        $id = (int)($payload['id'] ?? 0);
        if ($id <= 0) {
            jsonResponse(400, ['error' => 'El id de categoría es requerido.']);
        }
        $updates = [];
        $params = [];
        if (isset($payload['name']) && trim((string)$payload['name']) !== '') {
            $updates[] = 'name = ?';
            $params[] = trim((string)$payload['name']);
        }
        if (isset($payload['status']) && in_array($payload['status'], ['active', 'inactive'], true)) {
            $updates[] = 'status = ?';
            $params[] = $payload['status'];
        }
        if (count($updates) === 0) {
            jsonResponse(200, ['data' => ['success' => false]]);
        }
        $params[] = $id;
        execSql('UPDATE course_categories SET ' . implode(', ', $updates) . ' WHERE id = ?', $params);
        jsonResponse(200, ['data' => ['success' => true]]);
    }
}
