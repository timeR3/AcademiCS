<?php
declare(strict_types=1);

error_reporting(E_ALL);
ini_set('display_errors', '0');

function loadDotEnvFiles(): void {
    static $loaded = false;
    if ($loaded) {
        return;
    }
    $loaded = true;
    $rootDir = dirname(__DIR__, 2);
    $files = [
        $rootDir . DIRECTORY_SEPARATOR . '.env',
        $rootDir . DIRECTORY_SEPARATOR . '.env.local',
    ];
    foreach ($files as $file) {
        if (!is_file($file) || !is_readable($file)) {
            continue;
        }
        $lines = file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if (!is_array($lines)) {
            continue;
        }
        foreach ($lines as $line) {
            $trimmed = trim($line);
            if ($trimmed === '' || str_starts_with($trimmed, '#')) {
                continue;
            }
            $pos = strpos($trimmed, '=');
            if ($pos === false) {
                continue;
            }
            $key = trim(substr($trimmed, 0, $pos));
            $value = trim(substr($trimmed, $pos + 1));
            if ($key === '') {
                continue;
            }
            $first = substr($value, 0, 1);
            $last = substr($value, -1);
            if (($first === '"' && $last === '"') || ($first === "'" && $last === "'")) {
                $value = substr($value, 1, -1);
            }
            if (getenv($key) === false) {
                putenv($key . '=' . $value);
                $_ENV[$key] = $value;
                $_SERVER[$key] = $value;
            }
        }
    }
}

function envValue(string $key, ?string $fallback = null): ?string {
    loadDotEnvFiles();
    $value = getenv($key);
    if ($value === false || $value === '') {
        if (isset($_ENV[$key]) && $_ENV[$key] !== '') {
            return (string)$_ENV[$key];
        }
        if (isset($_SERVER[$key]) && $_SERVER[$key] !== '') {
            return (string)$_SERVER[$key];
        }
        return $fallback;
    }
    return $value;
}

function envValueAny(array $keys, ?string $fallback = null): ?string {
    foreach ($keys as $key) {
        $value = envValue($key, null);
        if ($value !== null && $value !== '') {
            return $value;
        }
    }
    return $fallback;
}

function envValueBoolAny(array $keys, bool $fallback = false): bool {
    $value = envValueAny($keys, null);
    if ($value === null || $value === '') {
        return $fallback;
    }
    $normalized = strtolower(trim($value));
    return in_array($normalized, ['1', 'true', 'yes', 'on'], true);
}

function corsAllowedOrigins(): array {
    $raw = envValue('CORS_ORIGIN', envValue('FRONTEND_ORIGIN', '')) ?? '';
    $parts = array_map('trim', explode(',', $raw));
    return array_values(array_filter($parts, fn(string $item) => $item !== ''));
}

function applyCors(): void {
    $allowed = corsAllowedOrigins();
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin === '' || count($allowed) === 0 || in_array($origin, $allowed, true)) {
        header('Access-Control-Allow-Origin: ' . ($origin !== '' ? $origin : '*'));
    }
    header('Vary: Origin');
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
    header('Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS');
}

function jsonResponse(int $status, array $payload): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

function parseBody(): array {
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        jsonResponse(400, ['error' => 'Payload JSON inválido.']);
    }
    return $decoded;
}

function routePath(): string {
    $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?? '/';
    $scriptDir = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '')), '/');
    if ($scriptDir !== '' && $scriptDir !== '/' && str_starts_with($path, $scriptDir)) {
        $path = substr($path, strlen($scriptDir));
        if ($path === '') {
            $path = '/';
        }
    }
    return $path;
}

function discoverApiRouteDefinitions(): array {
    static $routes = null;
    if (is_array($routes)) {
        return $routes;
    }
    $routes = [];
    $routeSources = [__FILE__];
    $routeFiles = glob(dirname(__DIR__) . DIRECTORY_SEPARATOR . 'routes' . DIRECTORY_SEPARATOR . '*.php');
    if (is_array($routeFiles)) {
        foreach ($routeFiles as $routeFile) {
            if (is_string($routeFile) && $routeFile !== '' && is_file($routeFile)) {
                $routeSources[] = $routeFile;
            }
        }
    }
    foreach ($routeSources as $routeSource) {
        $source = file_get_contents($routeSource);
        if (!is_string($source) || $source === '') {
            continue;
        }
        preg_match_all('/if \(\$method === \'([A-Z]+)\' && \$path === \'([^\']+)\'\) \{/', $source, $exactMatches, PREG_SET_ORDER);
        foreach ($exactMatches as $match) {
            $path = (string)$match[2];
            if (!str_starts_with($path, '/api')) {
                continue;
            }
            $routes[] = [
                'method' => (string)$match[1],
                'kind' => 'exact',
                'pattern' => $path,
            ];
        }
        preg_match_all('/if \(\$method === \'([A-Z]+)\' && preg_match\(\'#\^(.+?)\$#\', \$path, \$matches\)\) \{/', $source, $regexMatches, PREG_SET_ORDER);
        foreach ($regexMatches as $match) {
            $regexBody = (string)$match[2];
            $normalized = preg_replace('/\\\\\\\\\//', '/', $regexBody) ?? $regexBody;
            if (!str_starts_with($normalized, '/api')) {
                continue;
            }
            $routes[] = [
                'method' => (string)$match[1],
                'kind' => 'regex',
                'pattern' => '#^' . $regexBody . '$#',
            ];
        }
    }
    return $routes;
}

function countApiRoutes(): int {
    return count(discoverApiRouteDefinitions());
}

function allowedMethodsForApiPath(string $path): array {
    $allowed = [];
    foreach (discoverApiRouteDefinitions() as $route) {
        $method = (string)$route['method'];
        $kind = (string)$route['kind'];
        $pattern = (string)$route['pattern'];
        if ($kind === 'exact' && $path === $pattern) {
            $allowed[$method] = true;
            continue;
        }
        if ($kind === 'regex' && preg_match($pattern, $path) === 1) {
            $allowed[$method] = true;
        }
    }
    return array_keys($allowed);
}

function tableExists(PDO $pdo, string $tableName): bool {
    $stmt = $pdo->prepare('SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1');
    $stmt->execute([$tableName]);
    return (bool)$stmt->fetchColumn();
}

function indexExists(PDO $pdo, string $tableName, string $indexName): bool {
    $stmt = $pdo->prepare('SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ? LIMIT 1');
    $stmt->execute([$tableName, $indexName]);
    return (bool)$stmt->fetchColumn();
}

function ensureIndex(PDO $pdo, string $tableName, string $indexName, array $columns): void {
    if (!tableExists($pdo, $tableName)) {
        return;
    }
    if (indexExists($pdo, $tableName, $indexName)) {
        return;
    }
    $quotedColumns = array_map(fn(string $column): string => '`' . str_replace('`', '', $column) . '`', $columns);
    $sql = 'CREATE INDEX `' . str_replace('`', '', $indexName) . '` ON `' . str_replace('`', '', $tableName) . '` (' . implode(', ', $quotedColumns) . ')';
    $pdo->exec($sql);
}

function ensurePerformanceIndexes(PDO $pdo): void {
    static $ensured = false;
    if ($ensured) {
        return;
    }
    $ensured = true;
    $indexSpecs = [
        ['courses', 'idx_courses_teacher_status', ['teacher_id', 'status', 'id']],
        ['courses', 'idx_courses_status_teacher', ['status', 'teacher_id', 'id']],
        ['course_modules', 'idx_course_modules_course_order', ['course_id', 'module_order', 'id']],
        ['course_enrollments', 'idx_enrollments_course_student', ['course_id', 'student_id']],
        ['course_enrollments', 'idx_enrollments_student_status', ['student_id', 'status', 'course_id']],
        ['course_enrollments', 'idx_enrollments_course_status_student', ['course_id', 'status', 'student_id']],
        ['evaluation_submissions', 'idx_eval_module_student_submitted', ['module_id', 'student_id', 'submitted_at']],
        ['evaluation_submissions', 'idx_eval_student_module_passed', ['student_id', 'module_id', 'passed']],
        ['evaluation_submissions', 'idx_eval_student_module_submitted_id', ['student_id', 'module_id', 'submitted_at', 'id']],
        ['users', 'idx_users_status_id', ['status', 'id']],
        ['users', 'idx_users_email', ['email']],
        ['user_roles', 'idx_user_roles_role_user', ['role_id', 'user_id']],
        ['module_syllabus', 'idx_syllabus_module_id_id', ['module_id', 'id']],
        ['module_questions', 'idx_questions_module_id_id', ['module_id', 'id']],
        ['course_bibliography', 'idx_biblio_course_id_id', ['course_id', 'id']],
        ['course_source_files', 'idx_source_course_id_id', ['course_id', 'id']],
        ['shared_files', 'idx_shared_files_file_hash', ['file_hash']],
        ['notifications', 'idx_notifications_user_created', ['user_id', 'created_at']],
        ['course_categories', 'idx_categories_status_name', ['status', 'name']],
    ];
    try {
        foreach ($indexSpecs as [$tableName, $indexName, $columns]) {
            ensureIndex($pdo, $tableName, $indexName, $columns);
        }
    } catch (Throwable $error) {
        error_log('Index bootstrap warning: ' . $error->getMessage());
    }
}

function db(): PDO {
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }
    $databaseUrl = envValueAny(['DATABASE_URL', 'JAWSDB_URL'], null);
    $host = envValueAny(['DB_HOST', 'MYSQL_HOST', 'DATABASE_HOST'], '127.0.0.1');
    $port = envValueAny(['DB_PORT', 'MYSQL_PORT', 'DATABASE_PORT'], '3306');
    $name = envValueAny(['DB_DATABASE', 'DB_NAME', 'MYSQL_DATABASE', 'DATABASE_NAME'], '');
    $user = envValueAny(['DB_USER', 'DB_USERNAME', 'MYSQL_USER', 'DATABASE_USER'], '');
    $pass = envValueAny(['DB_PASSWORD', 'MYSQL_PASSWORD', 'DATABASE_PASSWORD'], '');
    if ($databaseUrl !== null && $databaseUrl !== '') {
        $parts = parse_url($databaseUrl);
        if (is_array($parts)) {
            $host = isset($parts['host']) ? (string)$parts['host'] : $host;
            $port = isset($parts['port']) ? (string)$parts['port'] : $port;
            $user = isset($parts['user']) ? (string)$parts['user'] : $user;
            $pass = isset($parts['pass']) ? (string)$parts['pass'] : $pass;
            if (isset($parts['path']) && $parts['path'] !== '') {
                $name = ltrim((string)$parts['path'], '/');
            }
        }
    }
    if ($name === '' || $user === '') {
        jsonResponse(500, ['error' => 'Configuración de base de datos incompleta. Define DB_DATABASE/DB_NAME y DB_USER/DB_USERNAME.']);
    }
    $dsn = "mysql:host={$host};port={$port};dbname={$name};charset=utf8mb4";
    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_PERSISTENT => envValueBoolAny(['DB_PERSISTENT_CONNECTIONS', 'MYSQL_PERSISTENT_CONNECTIONS'], true),
    ]);
    if (envValueBoolAny(['DB_BOOTSTRAP_INDEXES', 'MYSQL_BOOTSTRAP_INDEXES'], false)) {
        ensurePerformanceIndexes($pdo);
    }
    return $pdo;
}

function one(string $sql, array $params = []): ?array {
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    $row = $stmt->fetch();
    return $row === false ? null : $row;
}

function many(string $sql, array $params = []): array {
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll();
}

function execSql(string $sql, array $params = []): int {
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    return $stmt->rowCount();
}

function userRoles(int $userId): array {
    $rows = many('SELECT r.name FROM roles r JOIN user_roles ur ON r.id = ur.role_id WHERE ur.user_id = ?', [$userId]);
    return array_values(array_map(fn(array $row): string => (string)$row['name'], $rows));
}

function mapCourseLevelStatus(bool $isPassed, bool $firstInProgressSet, string $enrollmentStatus): string {
    if ($enrollmentStatus === 'completed') {
        return 'completed';
    }
    if ($isPassed) {
        return 'completed';
    }
    if (!$firstInProgressSet) {
        return 'in-progress';
    }
    return 'locked';
}

function fetchStudentProgressForCourses(array $courseIds): array {
    if (count($courseIds) === 0) {
        return [];
    }
    $normalizedCourseIds = array_values(array_unique(array_map(fn($id): int => (int)$id, $courseIds)));
    if (count($normalizedCourseIds) === 0) {
        return [];
    }
    $coursePlaceholders = inClausePlaceholders($normalizedCourseIds);
    $enrollments = many(
        "SELECT course_id, student_id, due_date, status, final_score
         FROM course_enrollments
         WHERE course_id IN ({$coursePlaceholders})",
        $normalizedCourseIds
    );
    if (count($enrollments) === 0) {
        return [];
    }

    $studentIds = array_values(array_unique(array_map(fn(array $row): int => (int)$row['student_id'], $enrollments)));
    $moduleRows = many(
        "SELECT id, course_id
         FROM course_modules
         WHERE course_id IN ({$coursePlaceholders})",
        $normalizedCourseIds
    );
    $moduleIds = array_values(array_map(fn(array $row): int => (int)$row['id'], $moduleRows));
    $moduleCountByCourse = [];
    foreach ($moduleRows as $moduleRow) {
        $cid = (int)$moduleRow['course_id'];
        if (!isset($moduleCountByCourse[$cid])) {
            $moduleCountByCourse[$cid] = 0;
        }
        $moduleCountByCourse[$cid] += 1;
    }

    $usersById = [];
    if (count($studentIds) > 0) {
        $studentPlaceholders = inClausePlaceholders($studentIds);
        $userRows = many(
            "SELECT u.id, u.name, u.email, u.status, GROUP_CONCAT(r.name) AS roles
             FROM users u
             LEFT JOIN user_roles ur ON ur.user_id = u.id
             LEFT JOIN roles r ON r.id = ur.role_id
             WHERE u.id IN ({$studentPlaceholders})
             GROUP BY u.id, u.name, u.email, u.status",
            $studentIds
        );
        foreach ($userRows as $userRow) {
            $usersById[(int)$userRow['id']] = [
                'id' => (string)$userRow['id'],
                'name' => $userRow['name'],
                'email' => $userRow['email'],
                'status' => $userRow['status'],
                'roles' => $userRow['roles'] ? array_map('trim', explode(',', (string)$userRow['roles'])) : [],
            ];
        }
    }

    $completedByCourseStudent = [];
    $averageByCourseStudent = [];
    if (count($moduleIds) > 0 && count($studentIds) > 0) {
        $modulePlaceholders = inClausePlaceholders($moduleIds);
        $studentPlaceholders = inClausePlaceholders($studentIds);
        $completedRows = many(
            "SELECT cm.course_id, es.student_id, COUNT(DISTINCT es.module_id) AS completedModulesCount
             FROM evaluation_submissions es
             JOIN course_modules cm ON cm.id = es.module_id
             WHERE es.passed = 1 AND es.module_id IN ({$modulePlaceholders}) AND es.student_id IN ({$studentPlaceholders})
             GROUP BY cm.course_id, es.student_id",
            array_merge($moduleIds, $studentIds)
        );
        foreach ($completedRows as $row) {
            $key = ((int)$row['course_id']) . ':' . ((int)$row['student_id']);
            $completedByCourseStudent[$key] = (int)$row['completedModulesCount'];
        }

        $averageRows = many(
            "SELECT cm.course_id, es.student_id, AVG(es.score) AS averageScore
             FROM evaluation_submissions es
             JOIN (
                SELECT tie.student_id, tie.module_id, MAX(tie.id) AS max_id
                FROM evaluation_submissions tie
                JOIN (
                    SELECT student_id, module_id, MAX(submitted_at) AS max_submitted
                    FROM evaluation_submissions
                    WHERE module_id IN ({$modulePlaceholders}) AND student_id IN ({$studentPlaceholders})
                    GROUP BY student_id, module_id
                ) latest ON latest.student_id = tie.student_id AND latest.module_id = tie.module_id AND latest.max_submitted = tie.submitted_at
                GROUP BY tie.student_id, tie.module_id
             ) latest ON latest.max_id = es.id
             JOIN course_modules cm ON cm.id = es.module_id
             GROUP BY cm.course_id, es.student_id",
            array_merge($moduleIds, $studentIds)
        );
        foreach ($averageRows as $row) {
            $key = ((int)$row['course_id']) . ':' . ((int)$row['student_id']);
            $averageByCourseStudent[$key] = (float)($row['averageScore'] ?? 0);
        }
    }

    $progressByCourse = [];
    foreach ($enrollments as $enrollment) {
        $courseId = (int)$enrollment['course_id'];
        $studentId = (int)$enrollment['student_id'];
        $user = $usersById[$studentId] ?? null;
        if (!$user) {
            continue;
        }
        if (!isset($progressByCourse[$courseId])) {
            $progressByCourse[$courseId] = [];
        }
        $key = $courseId . ':' . $studentId;
        $progressByCourse[$courseId][] = [
            'id' => $user['id'],
            'name' => $user['name'],
            'email' => $user['email'],
            'status' => $user['status'],
            'roles' => $user['roles'],
            'enrollmentStatus' => $enrollment['status'],
            'completedModulesCount' => $completedByCourseStudent[$key] ?? 0,
            'totalModulesCount' => $moduleCountByCourse[$courseId] ?? 0,
            'finalScore' => $enrollment['final_score'] !== null ? (float)$enrollment['final_score'] : null,
            'averageScore' => $averageByCourseStudent[$key] ?? 0,
            'dueDate' => $enrollment['due_date'] !== null ? (new DateTime((string)$enrollment['due_date']))->format(DateTime::ATOM) : null,
        ];
    }
    return $progressByCourse;
}

function fetchStudentProgressForCourse(int $courseId): array {
    $progressByCourse = fetchStudentProgressForCourses([$courseId]);
    return $progressByCourse[$courseId] ?? [];
}

function moduleDetailsByIds(array $moduleIds): array {
    if (count($moduleIds) === 0) {
        return ['syllabus' => [], 'questionnaire' => []];
    }
    $modulePlaceholders = implode(',', array_fill(0, count($moduleIds), '?'));
    $syllabusRows = many(
        "SELECT id, module_id, title, content
         FROM module_syllabus
         WHERE module_id IN ({$modulePlaceholders})
         ORDER BY id ASC",
        $moduleIds
    );
    $questionRows = many(
        "SELECT id, module_id, question_text, options, correct_option_index
         FROM module_questions
         WHERE module_id IN ({$modulePlaceholders})
         ORDER BY id ASC",
        $moduleIds
    );
    $syllabusByModule = [];
    foreach ($syllabusRows as $row) {
        $moduleId = (int)$row['module_id'];
        if (!isset($syllabusByModule[$moduleId])) {
            $syllabusByModule[$moduleId] = [];
        }
        $syllabusByModule[$moduleId][] = [
            'id' => (string)$row['id'],
            'title' => $row['title'],
            'content' => $row['content'],
        ];
    }
    $questionnaireByModule = [];
    foreach ($questionRows as $row) {
        $moduleId = (int)$row['module_id'];
        if (!isset($questionnaireByModule[$moduleId])) {
            $questionnaireByModule[$moduleId] = [];
        }
        $options = json_decode((string)$row['options'], true);
        if (!is_array($options)) {
            $options = [];
        }
        $questionnaireByModule[$moduleId][] = [
            'id' => (string)$row['id'],
            'text' => $row['question_text'],
            'options' => $options,
            'correctOptionIndex' => (int)$row['correct_option_index'],
        ];
    }
    return ['syllabus' => $syllabusByModule, 'questionnaire' => $questionnaireByModule];
}

function moduleDetails(int $moduleId): array {
    $syllabusRows = many('SELECT id, title, content FROM module_syllabus WHERE module_id = ?', [$moduleId]);
    $questionRows = many('SELECT id, question_text, options, correct_option_index FROM module_questions WHERE module_id = ?', [$moduleId]);
    $syllabus = array_map(fn(array $row): array => [
        'id' => (string)$row['id'],
        'title' => $row['title'],
        'content' => $row['content'],
    ], $syllabusRows);
    $questionnaire = array_map(function (array $row): array {
        $options = json_decode((string)$row['options'], true);
        if (!is_array($options)) {
            $options = [];
        }
        return [
            'id' => (string)$row['id'],
            'text' => $row['question_text'],
            'options' => $options,
            'correctOptionIndex' => (int)$row['correct_option_index'],
        ];
    }, $questionRows);
    return ['syllabus' => $syllabus, 'questionnaire' => $questionnaire];
}

function sourceFilesForCourse(int $courseId): array {
    $rows = many(
        'SELECT csf.id, sf.file_name, sf.uploaded_at
         FROM course_source_files csf
         JOIN shared_files sf ON csf.shared_file_id = sf.id
         WHERE csf.course_id = ?',
        [$courseId]
    );
    return array_map(fn(array $row): array => [
        'id' => (string)$row['id'],
        'fileName' => $row['file_name'],
        'uploadedAt' => (new DateTime((string)$row['uploaded_at']))->format(DateTime::ATOM),
    ], $rows);
}

function bibliographyForCourse(int $courseId): array {
    $rows = many('SELECT id, item_name, item_type, url, uploaded_at FROM course_bibliography WHERE course_id = ?', [$courseId]);
    return array_map(fn(array $row): array => [
        'id' => (string)$row['id'],
        'itemName' => $row['item_name'],
        'itemType' => $row['item_type'],
        'url' => $row['url'],
        'uploadedAt' => (new DateTime((string)$row['uploaded_at']))->format(DateTime::ATOM),
    ], $rows);
}

function teacherCourses(string $teacherId, string $status, bool $includeDetails = true, int $courseIdFilter = 0): array {
    $tid = (int)$teacherId;
    $sql = 'SELECT c.id, c.title, c.category_id, cat.name AS category_name
            FROM courses c
            LEFT JOIN course_categories cat ON c.category_id = cat.id
            WHERE c.teacher_id = ? AND c.status = ?';
    $params = [$tid, $status];
    if ($courseIdFilter > 0) {
        $sql .= ' AND c.id = ?';
        $params[] = $courseIdFilter;
    }
    $courseRows = many($sql, $params);
    if (count($courseRows) === 0) {
        return [];
    }
    $courseIds = array_values(array_map(fn(array $row): int => (int)$row['id'], $courseRows));
    $coursePlaceholders = inClausePlaceholders($courseIds);
    $moduleRows = many(
        $includeDetails
            ? "SELECT id, course_id, title, introduction, module_order, questions_to_display
               FROM course_modules
               WHERE course_id IN ({$coursePlaceholders})
               ORDER BY course_id ASC, module_order ASC"
            : "SELECT id, course_id, title, module_order
               FROM course_modules
               WHERE course_id IN ({$coursePlaceholders})
               ORDER BY course_id ASC, module_order ASC",
        $courseIds
    );
    $moduleIds = array_values(array_map(fn(array $row): int => (int)$row['id'], $moduleRows));
    $moduleDetails = $includeDetails ? moduleDetailsByIds($moduleIds) : ['syllabus' => [], 'questionnaire' => []];
    $levelsByCourse = [];
    foreach ($moduleRows as $moduleRow) {
        $courseId = (int)$moduleRow['course_id'];
        $moduleId = (int)$moduleRow['id'];
        if (!isset($levelsByCourse[$courseId])) {
            $levelsByCourse[$courseId] = [];
        }
        $levelsByCourse[$courseId][] = [
            'id' => (string)$moduleId,
            'title' => $moduleRow['title'],
            'status' => 'locked',
            'introduction' => $includeDetails ? ((string)$moduleRow['introduction']) : '',
            'syllabus' => $moduleDetails['syllabus'][$moduleId] ?? [],
            'questionnaire' => $moduleDetails['questionnaire'][$moduleId] ?? [],
            'questionsToDisplay' => $includeDetails ? (int)$moduleRow['questions_to_display'] : 0,
        ];
    }
    $enrollmentRows = many(
        "SELECT course_id, student_id, due_date, status
         FROM course_enrollments
         WHERE course_id IN ({$coursePlaceholders})",
        $courseIds
    );
    $studentsByCourse = [];
    $completedStudentIdsByCourse = [];
    foreach ($enrollmentRows as $row) {
        $courseId = (int)$row['course_id'];
        if (!isset($studentsByCourse[$courseId])) {
            $studentsByCourse[$courseId] = [];
        }
        if (!isset($completedStudentIdsByCourse[$courseId])) {
            $completedStudentIdsByCourse[$courseId] = [];
        }
        $studentsByCourse[$courseId][] = [
            'studentId' => (string)$row['student_id'],
            'dueDate' => $row['due_date'],
        ];
        if ((string)$row['status'] === 'completed') {
            $completedStudentIdsByCourse[$courseId][] = (string)$row['student_id'];
        }
    }
    $sourceByCourse = [];
    $biblioByCourse = [];
    if ($includeDetails) {
        $sourceRows = many(
            "SELECT csf.course_id, csf.id, sf.file_name, sf.uploaded_at
             FROM course_source_files csf
             JOIN shared_files sf ON sf.id = csf.shared_file_id
             WHERE csf.course_id IN ({$coursePlaceholders})
             ORDER BY csf.id ASC",
            $courseIds
        );
        foreach ($sourceRows as $row) {
            $courseId = (int)$row['course_id'];
            if (!isset($sourceByCourse[$courseId])) {
                $sourceByCourse[$courseId] = [];
            }
            $sourceByCourse[$courseId][] = [
                'id' => (string)$row['id'],
                'fileName' => $row['file_name'],
                'uploadedAt' => (new DateTime((string)$row['uploaded_at']))->format(DateTime::ATOM),
            ];
        }
        $biblioRows = many(
            "SELECT course_id, id, item_name, item_type, url, uploaded_at
             FROM course_bibliography
             WHERE course_id IN ({$coursePlaceholders})
             ORDER BY id ASC",
            $courseIds
        );
        foreach ($biblioRows as $row) {
            $courseId = (int)$row['course_id'];
            if (!isset($biblioByCourse[$courseId])) {
                $biblioByCourse[$courseId] = [];
            }
            $biblioByCourse[$courseId][] = [
                'id' => (string)$row['id'],
                'itemName' => $row['item_name'],
                'itemType' => $row['item_type'],
                'url' => $row['url'],
                'uploadedAt' => (new DateTime((string)$row['uploaded_at']))->format(DateTime::ATOM),
            ];
        }
    }
    $progressByCourse = $includeDetails ? fetchStudentProgressForCourses($courseIds) : [];
    $courses = [];
    foreach ($courseRows as $courseRow) {
        $courseId = (int)$courseRow['id'];
        $courses[] = [
            'id' => (string)$courseId,
            'title' => $courseRow['title'],
            'status' => $status,
            'levels' => $levelsByCourse[$courseId] ?? [],
            'students' => $studentsByCourse[$courseId] ?? [],
            'completedStudentIds' => array_values(array_unique($completedStudentIdsByCourse[$courseId] ?? [])),
            'studentProgress' => $progressByCourse[$courseId] ?? [],
            'sourceFiles' => $sourceByCourse[$courseId] ?? [],
            'bibliography' => $biblioByCourse[$courseId] ?? [],
            'teacherId' => (string)$tid,
            'categoryId' => $courseRow['category_id'] !== null ? (string)$courseRow['category_id'] : null,
            'categoryName' => $courseRow['category_name'],
        ];
    }
    return $courses;
}

function studentCourses(string $studentId, bool $includeDetails = true, int $courseIdFilter = 0): array {
    $sid = (int)$studentId;
    $sql = 'SELECT c.id, c.title, c.teacher_id, c.category_id, cat.name AS category_name, c.status AS course_status,
                   ce.due_date, ce.status AS enrollment_status, ce.final_score
            FROM courses c
            JOIN course_enrollments ce ON c.id = ce.course_id
            LEFT JOIN course_categories cat ON c.category_id = cat.id
            WHERE ce.student_id = ? AND c.status != "archived"';
    $params = [$sid];
    if ($courseIdFilter > 0) {
        $sql .= ' AND c.id = ?';
        $params[] = $courseIdFilter;
    }
    $rows = many($sql, $params);
    if (count($rows) === 0) {
        return [];
    }
    $courseIds = array_values(array_map(fn(array $row): int => (int)$row['id'], $rows));
    $coursePlaceholders = inClausePlaceholders($courseIds);
    $moduleRows = many(
        $includeDetails
            ? "SELECT id, course_id, title, introduction, module_order, questions_to_display
               FROM course_modules
               WHERE course_id IN ({$coursePlaceholders})
               ORDER BY course_id ASC, module_order ASC"
            : "SELECT id, course_id, title, module_order
               FROM course_modules
               WHERE course_id IN ({$coursePlaceholders})
               ORDER BY course_id ASC, module_order ASC",
        $courseIds
    );
    $moduleIds = array_values(array_map(fn(array $item): int => (int)$item['id'], $moduleRows));
    $moduleDetails = $includeDetails ? moduleDetailsByIds($moduleIds) : ['syllabus' => [], 'questionnaire' => []];
    $passedByCourseModule = [];
    if (count($courseIds) > 0) {
        $passedRows = many(
            "SELECT cm.course_id, es.module_id
             FROM evaluation_submissions es
             JOIN course_modules cm ON cm.id = es.module_id
             WHERE es.student_id = ? AND es.passed = 1 AND cm.course_id IN ({$coursePlaceholders})
             GROUP BY cm.course_id, es.module_id",
            array_merge([$sid], $courseIds)
        );
        foreach ($passedRows as $item) {
            $courseId = (int)$item['course_id'];
            if (!isset($passedByCourseModule[$courseId])) {
                $passedByCourseModule[$courseId] = [];
            }
            $passedByCourseModule[$courseId][(int)$item['module_id']] = true;
        }
    }
    $modulesByCourse = [];
    foreach ($moduleRows as $moduleRow) {
        $courseId = (int)$moduleRow['course_id'];
        if (!isset($modulesByCourse[$courseId])) {
            $modulesByCourse[$courseId] = [];
        }
        $modulesByCourse[$courseId][] = $moduleRow;
    }
    $sourceByCourse = [];
    $biblioByCourse = [];
    if ($includeDetails) {
        $sourceRows = many(
            "SELECT csf.course_id, csf.id, sf.file_name, sf.uploaded_at
             FROM course_source_files csf
             JOIN shared_files sf ON sf.id = csf.shared_file_id
             WHERE csf.course_id IN ({$coursePlaceholders})
             ORDER BY csf.id ASC",
            $courseIds
        );
        foreach ($sourceRows as $item) {
            $courseId = (int)$item['course_id'];
            if (!isset($sourceByCourse[$courseId])) {
                $sourceByCourse[$courseId] = [];
            }
            $sourceByCourse[$courseId][] = [
                'id' => (string)$item['id'],
                'fileName' => $item['file_name'],
                'uploadedAt' => (new DateTime((string)$item['uploaded_at']))->format(DateTime::ATOM),
            ];
        }
        $biblioRows = many(
            "SELECT course_id, id, item_name, item_type, url, uploaded_at
             FROM course_bibliography
             WHERE course_id IN ({$coursePlaceholders})
             ORDER BY id ASC",
            $courseIds
        );
        foreach ($biblioRows as $item) {
            $courseId = (int)$item['course_id'];
            if (!isset($biblioByCourse[$courseId])) {
                $biblioByCourse[$courseId] = [];
            }
            $biblioByCourse[$courseId][] = [
                'id' => (string)$item['id'],
                'itemName' => $item['item_name'],
                'itemType' => $item['item_type'],
                'url' => $item['url'],
                'uploadedAt' => (new DateTime((string)$item['uploaded_at']))->format(DateTime::ATOM),
            ];
        }
    }
    $courses = [];
    foreach ($rows as $row) {
        $courseId = (int)$row['id'];
        $firstInProgressSet = false;
        $levels = [];
        foreach ($modulesByCourse[$courseId] ?? [] as $moduleRow) {
            $moduleId = (int)$moduleRow['id'];
            $isPassed = isset($passedByCourseModule[$courseId][$moduleId]);
            $levelStatus = mapCourseLevelStatus($isPassed, $firstInProgressSet, (string)$row['enrollment_status']);
            if ($levelStatus === 'in-progress') {
                $firstInProgressSet = true;
            }
            $levels[] = [
                'id' => (string)$moduleId,
                'title' => $moduleRow['title'],
                'status' => $levelStatus,
                'introduction' => $includeDetails ? ((string)$moduleRow['introduction']) : '',
                'syllabus' => $moduleDetails['syllabus'][$moduleId] ?? [],
                'questionnaire' => $moduleDetails['questionnaire'][$moduleId] ?? [],
                'questionsToDisplay' => $includeDetails ? (int)$moduleRow['questions_to_display'] : 0,
            ];
        }
        $courses[] = [
            'id' => (string)$courseId,
            'title' => $row['title'],
            'levels' => $levels,
            'students' => [],
            'completedStudentIds' => [],
            'status' => $row['enrollment_status'],
            'sourceFiles' => $sourceByCourse[$courseId] ?? [],
            'bibliography' => $biblioByCourse[$courseId] ?? [],
            'teacherId' => (string)$row['teacher_id'],
            'categoryId' => $row['category_id'] !== null ? (string)$row['category_id'] : null,
            'categoryName' => $row['category_name'],
            'finalScore' => $row['final_score'] !== null ? (float)$row['final_score'] : null,
            'dueDate' => $row['due_date'] !== null ? (new DateTime((string)$row['due_date']))->format(DateTime::ATOM) : null,
            'globalStatus' => $row['course_status'],
        ];
    }
    return $courses;
}

function inClausePlaceholders(array $ids): string {
    return implode(',', array_fill(0, count($ids), '?'));
}

function sharedFileIdsByHash(array $hashes): array {
    $normalized = array_values(array_unique(array_filter(array_map(static fn($hash): string => trim((string)$hash), $hashes), static fn(string $hash): bool => $hash !== '')));
    if (count($normalized) === 0) {
        return [];
    }
    $placeholders = inClausePlaceholders($normalized);
    $rows = many(
        "SELECT id, file_hash
         FROM shared_files
         WHERE file_hash IN ({$placeholders})",
        $normalized
    );
    $idsByHash = [];
    foreach ($rows as $row) {
        $idsByHash[(string)$row['file_hash']] = (int)$row['id'];
    }
    return $idsByHash;
}

function adminCoursesByStatus(string $status, bool $includeDetails = true, int $courseIdFilter = 0): array {
    $sql = 'SELECT c.id, c.title, c.teacher_id, c.category_id, cat.name AS category_name
            FROM courses c
            JOIN users u ON u.id = c.teacher_id
            JOIN user_roles ur ON ur.user_id = u.id
            JOIN roles r ON r.id = ur.role_id
            LEFT JOIN course_categories cat ON c.category_id = cat.id
            WHERE r.name = "teacher" AND u.status = "active" AND c.status = ?';
    $params = [$status];
    if ($courseIdFilter > 0) {
        $sql .= ' AND c.id = ?';
        $params[] = $courseIdFilter;
    }
    $sql .= ' GROUP BY c.id, c.title, c.teacher_id, c.category_id, cat.name ORDER BY c.id ASC';
    $courseRows = many($sql, $params);
    if (count($courseRows) === 0) {
        return [];
    }

    $courseIds = array_values(array_map(fn(array $row): int => (int)$row['id'], $courseRows));
    $coursePlaceholders = inClausePlaceholders($courseIds);

    $moduleRows = [];
    $moduleIds = [];
    if ($includeDetails) {
        $moduleRows = many(
            "SELECT id, course_id, title, introduction, module_order, questions_to_display
             FROM course_modules
             WHERE course_id IN ({$coursePlaceholders})
             ORDER BY course_id ASC, module_order ASC",
            $courseIds
        );
        $moduleIds = array_values(array_map(fn(array $row): int => (int)$row['id'], $moduleRows));
    }

    $syllabusByModule = [];
    $questionnaireByModule = [];
    if ($includeDetails && count($moduleIds) > 0) {
        $modulePlaceholders = inClausePlaceholders($moduleIds);
        $syllabusRows = many(
            "SELECT id, module_id, title, content
             FROM module_syllabus
             WHERE module_id IN ({$modulePlaceholders})
             ORDER BY id ASC",
            $moduleIds
        );
        foreach ($syllabusRows as $row) {
            $moduleId = (int)$row['module_id'];
            if (!isset($syllabusByModule[$moduleId])) {
                $syllabusByModule[$moduleId] = [];
            }
            $syllabusByModule[$moduleId][] = [
                'id' => (string)$row['id'],
                'title' => $row['title'],
                'content' => $row['content'],
            ];
        }

        $questionRows = many(
            "SELECT id, module_id, question_text, options, correct_option_index
             FROM module_questions
             WHERE module_id IN ({$modulePlaceholders})
             ORDER BY id ASC",
            $moduleIds
        );
        foreach ($questionRows as $row) {
            $moduleId = (int)$row['module_id'];
            if (!isset($questionnaireByModule[$moduleId])) {
                $questionnaireByModule[$moduleId] = [];
            }
            $options = json_decode((string)$row['options'], true);
            if (!is_array($options)) {
                $options = [];
            }
            $questionnaireByModule[$moduleId][] = [
                'id' => (string)$row['id'],
                'text' => $row['question_text'],
                'options' => $options,
                'correctOptionIndex' => (int)$row['correct_option_index'],
            ];
        }
    }

    $levelsByCourse = [];
    $moduleCountByCourse = [];
    foreach ($moduleRows as $moduleRow) {
        $courseId = (int)$moduleRow['course_id'];
        $moduleId = (int)$moduleRow['id'];
        if (!isset($levelsByCourse[$courseId])) {
            $levelsByCourse[$courseId] = [];
        }
        if (!isset($moduleCountByCourse[$courseId])) {
            $moduleCountByCourse[$courseId] = 0;
        }
        $moduleCountByCourse[$courseId] += 1;
        $levelsByCourse[$courseId][] = [
            'id' => (string)$moduleId,
            'title' => $moduleRow['title'],
            'status' => 'locked',
            'introduction' => $moduleRow['introduction'],
            'syllabus' => $syllabusByModule[$moduleId] ?? [],
            'questionnaire' => $questionnaireByModule[$moduleId] ?? [],
            'questionsToDisplay' => (int)$moduleRow['questions_to_display'],
        ];
    }

    $enrollmentRows = many(
        "SELECT course_id, student_id, due_date, status, final_score
         FROM course_enrollments
         WHERE course_id IN ({$coursePlaceholders})",
        $courseIds
    );
    $usersById = [];
    $completedByCourseStudent = [];
    $averageByCourseStudent = [];
    if ($includeDetails) {
        $studentIds = array_values(array_unique(array_map(fn(array $row): int => (int)$row['student_id'], $enrollmentRows)));
        if (count($studentIds) > 0) {
            $studentPlaceholders = inClausePlaceholders($studentIds);
            $userRows = many(
                "SELECT u.id, u.name, u.email, u.status, GROUP_CONCAT(r.name) AS roles
                 FROM users u
                 LEFT JOIN user_roles ur ON ur.user_id = u.id
                 LEFT JOIN roles r ON r.id = ur.role_id
                 WHERE u.id IN ({$studentPlaceholders})
                 GROUP BY u.id, u.name, u.email, u.status",
                $studentIds
            );
            foreach ($userRows as $userRow) {
                $usersById[(int)$userRow['id']] = [
                    'id' => (string)$userRow['id'],
                    'name' => $userRow['name'],
                    'email' => $userRow['email'],
                    'status' => $userRow['status'],
                    'roles' => $userRow['roles'] ? array_map('trim', explode(',', (string)$userRow['roles'])) : [],
                ];
            }
        }

        if (count($studentIds) > 0 && count($moduleIds) > 0) {
            $modulePlaceholders = inClausePlaceholders($moduleIds);
            $studentPlaceholders = inClausePlaceholders($studentIds);
            $completedRows = many(
                "SELECT cm.course_id, es.student_id, COUNT(DISTINCT es.module_id) AS completedModulesCount
                 FROM evaluation_submissions es
                 JOIN course_modules cm ON cm.id = es.module_id
                 WHERE es.passed = 1 AND es.module_id IN ({$modulePlaceholders}) AND es.student_id IN ({$studentPlaceholders})
                 GROUP BY cm.course_id, es.student_id",
                array_merge($moduleIds, $studentIds)
            );
            foreach ($completedRows as $row) {
                $key = ((int)$row['course_id']) . ':' . ((int)$row['student_id']);
                $completedByCourseStudent[$key] = (int)$row['completedModulesCount'];
            }

            $averageRows = many(
                "SELECT cm.course_id, es.student_id, AVG(es.score) AS averageScore
                 FROM evaluation_submissions es
                 JOIN (
                    SELECT tie.student_id, tie.module_id, MAX(tie.id) AS max_id
                    FROM evaluation_submissions tie
                    JOIN (
                        SELECT student_id, module_id, MAX(submitted_at) AS max_submitted
                        FROM evaluation_submissions
                        WHERE module_id IN ({$modulePlaceholders}) AND student_id IN ({$studentPlaceholders})
                        GROUP BY student_id, module_id
                    ) latest ON latest.student_id = tie.student_id AND latest.module_id = tie.module_id AND latest.max_submitted = tie.submitted_at
                    GROUP BY tie.student_id, tie.module_id
                 ) latest ON latest.max_id = es.id
                 JOIN course_modules cm ON cm.id = es.module_id
                 GROUP BY cm.course_id, es.student_id",
                array_merge($moduleIds, $studentIds)
            );
            foreach ($averageRows as $row) {
                $key = ((int)$row['course_id']) . ':' . ((int)$row['student_id']);
                $averageByCourseStudent[$key] = (float)($row['averageScore'] ?? 0);
            }
        }
    }

    $sourceByCourse = [];
    $biblioByCourse = [];
    if ($includeDetails) {
        $sourceRows = many(
            "SELECT csf.course_id, csf.id, sf.file_name, sf.uploaded_at
             FROM course_source_files csf
             JOIN shared_files sf ON sf.id = csf.shared_file_id
             WHERE csf.course_id IN ({$coursePlaceholders})
             ORDER BY csf.id ASC",
            $courseIds
        );
        foreach ($sourceRows as $row) {
            $courseId = (int)$row['course_id'];
            if (!isset($sourceByCourse[$courseId])) {
                $sourceByCourse[$courseId] = [];
            }
            $sourceByCourse[$courseId][] = [
                'id' => (string)$row['id'],
                'fileName' => $row['file_name'],
                'uploadedAt' => (new DateTime((string)$row['uploaded_at']))->format(DateTime::ATOM),
            ];
        }

        $biblioRows = many(
            "SELECT course_id, id, item_name, item_type, url, uploaded_at
             FROM course_bibliography
             WHERE course_id IN ({$coursePlaceholders})
             ORDER BY id ASC",
            $courseIds
        );
        foreach ($biblioRows as $row) {
            $courseId = (int)$row['course_id'];
            if (!isset($biblioByCourse[$courseId])) {
                $biblioByCourse[$courseId] = [];
            }
            $biblioByCourse[$courseId][] = [
                'id' => (string)$row['id'],
                'itemName' => $row['item_name'],
                'itemType' => $row['item_type'],
                'url' => $row['url'],
                'uploadedAt' => (new DateTime((string)$row['uploaded_at']))->format(DateTime::ATOM),
            ];
        }
    }

    $studentsByCourse = [];
    $progressByCourse = [];
    $completedStudentIdsByCourse = [];
    foreach ($enrollmentRows as $row) {
        $courseId = (int)$row['course_id'];
        $studentId = (int)$row['student_id'];
        if (!isset($studentsByCourse[$courseId])) {
            $studentsByCourse[$courseId] = [];
        }
        if (!isset($progressByCourse[$courseId])) {
            $progressByCourse[$courseId] = [];
        }
        if (!isset($completedStudentIdsByCourse[$courseId])) {
            $completedStudentIdsByCourse[$courseId] = [];
        }
        $studentsByCourse[$courseId][] = [
            'studentId' => (string)$studentId,
            'dueDate' => $row['due_date'],
        ];
        if ($includeDetails) {
            $user = $usersById[$studentId] ?? [
                'id' => (string)$studentId,
                'name' => 'Usuario',
                'email' => '',
                'status' => 'active',
                'roles' => [],
            ];
            $progressKey = $courseId . ':' . $studentId;
            $progressByCourse[$courseId][] = [
                'id' => $user['id'],
                'name' => $user['name'],
                'email' => $user['email'],
                'status' => $user['status'],
                'roles' => $user['roles'],
                'enrollmentStatus' => $row['status'],
                'completedModulesCount' => $completedByCourseStudent[$progressKey] ?? 0,
                'totalModulesCount' => $moduleCountByCourse[$courseId] ?? 0,
                'finalScore' => $row['final_score'] !== null ? (float)$row['final_score'] : null,
                'averageScore' => $averageByCourseStudent[$progressKey] ?? 0,
                'dueDate' => $row['due_date'] !== null ? (new DateTime((string)$row['due_date']))->format(DateTime::ATOM) : null,
            ];
        }
        if ($row['status'] === 'completed') {
            $completedStudentIdsByCourse[$courseId][] = (string)$studentId;
        }
    }

    $all = [];
    foreach ($courseRows as $courseRow) {
        $courseId = (int)$courseRow['id'];
        $all[] = [
            'id' => (string)$courseId,
            'title' => $courseRow['title'],
            'status' => $status,
            'levels' => $includeDetails ? ($levelsByCourse[$courseId] ?? []) : [],
            'students' => $studentsByCourse[$courseId] ?? [],
            'completedStudentIds' => array_values(array_unique($completedStudentIdsByCourse[$courseId] ?? [])),
            'studentProgress' => $progressByCourse[$courseId] ?? [],
            'sourceFiles' => $sourceByCourse[$courseId] ?? [],
            'bibliography' => $biblioByCourse[$courseId] ?? [],
            'teacherId' => (string)$courseRow['teacher_id'],
            'categoryId' => $courseRow['category_id'] !== null ? (string)$courseRow['category_id'] : null,
            'categoryName' => $courseRow['category_name'],
        ];
    }
    return $all;
}

function duplicateCourse(int $courseId): int {
    $pdo = db();
    $pdo->beginTransaction();
    try {
        $course = one('SELECT * FROM courses WHERE id = ?', [$courseId]);
        if (!$course) {
            throw new RuntimeException('Course not found');
        }
        $stmt = $pdo->prepare('INSERT INTO courses (title, teacher_id, status, category_id) VALUES (?, ?, ?, ?)');
        $stmt->execute(['(Copia) ' . $course['title'], $course['teacher_id'], 'active', $course['category_id']]);
        $newCourseId = (int)$pdo->lastInsertId();
        $modules = many('SELECT * FROM course_modules WHERE course_id = ? ORDER BY module_order ASC', [$courseId]);
        $moduleIds = array_values(array_map(static fn(array $module): int => (int)$module['id'], $modules));
        $moduleIdMap = [];
        $mStmt = $pdo->prepare('INSERT INTO course_modules (course_id, title, introduction, module_order, questions_to_display) VALUES (?, ?, ?, ?, ?)');
        foreach ($modules as $module) {
            $oldModuleId = (int)$module['id'];
            $mStmt->execute([$newCourseId, $module['title'], $module['introduction'], $module['module_order'], $module['questions_to_display']]);
            $moduleIdMap[$oldModuleId] = (int)$pdo->lastInsertId();
        }
        if (count($moduleIds) > 0) {
            $modulePlaceholders = inClausePlaceholders($moduleIds);
            $syllabusRows = many(
                "SELECT module_id, title, content
                 FROM module_syllabus
                 WHERE module_id IN ({$modulePlaceholders})
                 ORDER BY id ASC",
                $moduleIds
            );
            $syllabusStmt = $pdo->prepare('INSERT INTO module_syllabus (module_id, title, content) VALUES (?, ?, ?)');
            foreach ($syllabusRows as $row) {
                $oldModuleId = (int)$row['module_id'];
                if (!isset($moduleIdMap[$oldModuleId])) {
                    continue;
                }
                $syllabusStmt->execute([$moduleIdMap[$oldModuleId], $row['title'], $row['content']]);
            }
            $questionRows = many(
                "SELECT module_id, question_text, options, correct_option_index
                 FROM module_questions
                 WHERE module_id IN ({$modulePlaceholders})
                 ORDER BY id ASC",
                $moduleIds
            );
            $questionStmt = $pdo->prepare('INSERT INTO module_questions (module_id, question_text, options, correct_option_index) VALUES (?, ?, ?, ?)');
            foreach ($questionRows as $row) {
                $oldModuleId = (int)$row['module_id'];
                if (!isset($moduleIdMap[$oldModuleId])) {
                    continue;
                }
                $questionStmt->execute([$moduleIdMap[$oldModuleId], $row['question_text'], $row['options'], $row['correct_option_index']]);
            }
        }
        $links = many('SELECT shared_file_id FROM course_source_files WHERE course_id = ?', [$courseId]);
        $linkStmt = $pdo->prepare('INSERT INTO course_source_files (course_id, shared_file_id) VALUES (?, ?)');
        foreach ($links as $link) {
            $linkStmt->execute([$newCourseId, $link['shared_file_id']]);
        }
        $pdo->commit();
        return $newCourseId;
    } catch (Throwable $error) {
        $pdo->rollBack();
        throw $error;
    }
}

function parseDataUri(string $dataUri): string {
    $comma = strpos($dataUri, ',');
    if ($comma === false) {
        throw new RuntimeException('Formato de archivo inválido.');
    }
    $base64 = substr($dataUri, $comma + 1);
    $binary = base64_decode($base64, true);
    if ($binary === false) {
        throw new RuntimeException('No se pudo decodificar el archivo.');
    }
    return $binary;
}

function randomModuleTitle(int $index): string {
    if ($index === 0) {
        return 'Fundamentos';
    }
    return 'Módulo ' . ($index + 1);
}

applyCors();
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$path = routePath();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$startedAt = gmdate('c');
$mountedRoutes = countApiRoutes();
$isReady = true;
require_once dirname(__DIR__) . DIRECTORY_SEPARATOR . 'routes' . DIRECTORY_SEPARATOR . 'auth-users-categories.php';
require_once dirname(__DIR__) . DIRECTORY_SEPARATOR . 'routes' . DIRECTORY_SEPARATOR . 'platform-routes.php';

try {
    if ($method === 'GET' && $path === '/health') {
        jsonResponse(200, ['status' => 'ok', 'ready' => $isReady, 'routes' => $mountedRoutes, 'startedAt' => $startedAt]);
    }

    if ($method === 'GET' && $path === '/health/ready') {
        jsonResponse(200, ['status' => 'ready', 'ready' => $isReady, 'routes' => $mountedRoutes, 'startedAt' => $startedAt]);
    }

    handleAuthUserCategoryRoutes($method, $path);
    handlePlatformRoutes($method, $path);

    if (str_starts_with($path, '/api')) {
        $allowedMethods = allowedMethodsForApiPath($path);
        if (count($allowedMethods) > 0 && !in_array($method, $allowedMethods, true)) {
            jsonResponse(405, ['error' => 'Método no permitido.']);
        }
    }

    jsonResponse(404, ['error' => 'Endpoint no encontrado.']);
} catch (Throwable $error) {
    $message = $error->getMessage() !== '' ? $error->getMessage() : 'Error interno del servidor.';
    jsonResponse(500, ['error' => $message]);
}
