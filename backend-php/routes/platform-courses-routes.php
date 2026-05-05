<?php
declare(strict_types=1);

require_once dirname(__DIR__) . DIRECTORY_SEPARATOR . 'utils' . DIRECTORY_SEPARATOR . 'mailer.php';

function resolveSharedFileIdsFromReferences(array $references): array {
    $hashes = [];
    $numericRefs = [];
    foreach ($references as $reference) {
        $value = trim((string)$reference);
        if ($value === '') {
            continue;
        }
        if (preg_match('/^[a-f0-9]{64}$/i', $value) === 1) {
            $hashes[] = strtolower($value);
            continue;
        }
        $numeric = (int)$value;
        if ($numeric > 0) {
            $numericRefs[] = $numeric;
        }
    }
    $hashes = array_values(array_unique($hashes));
    $numericRefs = array_values(array_unique($numericRefs));
    $sharedIds = [];
    if (count($hashes) > 0) {
        $inHashes = inClausePlaceholders($hashes);
        $rowsByHash = many("SELECT id FROM shared_files WHERE file_hash IN ({$inHashes})", $hashes);
        foreach ($rowsByHash as $row) {
            $id = (int)($row['id'] ?? 0);
            if ($id > 0) {
                $sharedIds[$id] = true;
            }
        }
    }
    if (count($numericRefs) > 0) {
        $inNumeric = inClausePlaceholders($numericRefs);
        $rowsBySharedId = many("SELECT id FROM shared_files WHERE id IN ({$inNumeric})", $numericRefs);
        foreach ($rowsBySharedId as $row) {
            $id = (int)($row['id'] ?? 0);
            if ($id > 0) {
                $sharedIds[$id] = true;
            }
        }
        $rowsByCourseSourceId = many("SELECT shared_file_id FROM course_source_files WHERE id IN ({$inNumeric})", $numericRefs);
        foreach ($rowsByCourseSourceId as $row) {
            $id = (int)($row['shared_file_id'] ?? 0);
            if ($id > 0) {
                $sharedIds[$id] = true;
            }
        }
    }
    return array_map(static fn(int $id): int => $id, array_keys($sharedIds));
}

function normalizeCourseDifficultyValue($raw): string {
    $difficulty = strtolower(trim((string)$raw));
    if (in_array($difficulty, ['basic', 'intermediate', 'advanced'], true)) {
        return $difficulty;
    }
    return 'intermediate';
}

function parseIncludeFundamentalsValue($raw): bool {
    if (is_bool($raw)) {
        return $raw;
    }
    if (is_int($raw)) {
        return $raw === 1;
    }
    $value = strtolower(trim((string)$raw));
    return $value === '1' || $value === 'true' || $value === 'yes' || $value === 'si';
}

function courseNotificationGlobalSettingKey(string $type): string {
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

function courseNotificationsHasPreferencesTable(): bool {
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

function courseNotificationAllowedForUser(int $userId, string $type): bool {
    $settingKey = courseNotificationGlobalSettingKey($type);
    if ($settingKey !== '') {
        $global = one('SELECT `value` FROM app_settings WHERE `key` = ? LIMIT 1', [$settingKey]);
        if ($global && strtolower(trim((string)$global['value'])) === 'false') {
            return false;
        }
    }
    if (!courseNotificationsHasPreferencesTable()) {
        return true;
    }
    $row = one('SELECT enabled FROM notification_preferences WHERE user_id = ? AND notification_type = ? LIMIT 1', [$userId, $type]);
    if (!$row) {
        return true;
    }
    return (int)($row['enabled'] ?? 0) === 1;
}

function notifyUsers(array $userIds, string $title, string $description, string $link, string $notificationType): void {
    if (count($userIds) === 0) {
        return;
    }
    $uniqueIds = array_values(array_unique(array_map(static fn($id): int => (int)$id, $userIds)));
    foreach ($uniqueIds as $userId) {
        if ($userId <= 0) {
            continue;
        }
        if (!courseNotificationAllowedForUser($userId, $notificationType)) {
            continue;
        }
        execSql(
            'INSERT INTO notifications (user_id, title, description, link) VALUES (?, ?, ?, ?)',
            [$userId, $title, $description, $link]
        );
    }
}

function awardBadgesForStudentEvaluation(int $studentId, int $courseId, int $moduleId, float $score, bool $passed, bool $isCourseCompleted): void {
    $badges = many('SELECT id, criteria_type, criteria_value FROM badges', []);
    if (count($badges) === 0) {
        return;
    }
    $earnedRows = many('SELECT badge_id FROM user_badges WHERE user_id = ?', [$studentId]);
    $earnedLookup = [];
    foreach ($earnedRows as $earnedRow) {
        $badgeId = (int)($earnedRow['badge_id'] ?? 0);
        if ($badgeId > 0) {
            $earnedLookup[$badgeId] = true;
        }
    }
    foreach ($badges as $badge) {
        $badgeId = (int)($badge['id'] ?? 0);
        if ($badgeId <= 0 || array_key_exists($badgeId, $earnedLookup)) {
            continue;
        }
        $criteriaType = strtoupper(trim((string)($badge['criteria_type'] ?? '')));
        $criteriaValue = isset($badge['criteria_value']) ? (float)$badge['criteria_value'] : null;
        $shouldAward = false;
        if ($criteriaType === 'SCORE') {
            if ($criteriaValue !== null && $score >= $criteriaValue) {
                $shouldAward = true;
            }
        } elseif ($criteriaType === 'FIRST_PASS') {
            $row = one('SELECT COUNT(*) AS total FROM evaluation_submissions WHERE student_id = ? AND passed = 1', [$studentId]);
            if ((int)($row['total'] ?? 0) === 1) {
                $shouldAward = true;
            }
        } elseif ($criteriaType === 'COURSE_COMPLETION') {
            $shouldAward = $isCourseCompleted;
        } elseif ($criteriaType === 'COURSE_COUNT') {
            if ($criteriaValue !== null) {
                $row = one('SELECT COUNT(*) AS total FROM course_enrollments WHERE student_id = ? AND status = "completed"', [$studentId]);
                if ((int)($row['total'] ?? 0) >= (int)$criteriaValue) {
                    $shouldAward = true;
                }
            }
        } elseif ($criteriaType === 'PERFECT_STREAK') {
            if ($criteriaValue !== null && (int)$criteriaValue > 0) {
                $limit = (int)$criteriaValue;
                $scores = many('SELECT score FROM evaluation_submissions WHERE student_id = ? ORDER BY submitted_at DESC LIMIT ' . $limit, [$studentId]);
                if (count($scores) === $limit) {
                    $allPerfect = true;
                    foreach ($scores as $scoreRow) {
                        if ((float)($scoreRow['score'] ?? 0) < 100) {
                            $allPerfect = false;
                            break;
                        }
                    }
                    $shouldAward = $allPerfect;
                }
            }
        } elseif ($criteriaType === 'FIRST_TRY') {
            $row = one('SELECT COUNT(*) AS total FROM evaluation_submissions WHERE student_id = ? AND module_id = ?', [$studentId, $moduleId]);
            if ((int)($row['total'] ?? 0) === 1 && $passed) {
                $shouldAward = true;
            }
        } elseif ($criteriaType === 'FIRST_COURSE') {
            $row = one('SELECT COUNT(*) AS total FROM course_enrollments WHERE student_id = ?', [$studentId]);
            if ((int)($row['total'] ?? 0) >= 1) {
                $shouldAward = true;
            }
        }
        if ($shouldAward) {
            execSql('INSERT IGNORE INTO user_badges (user_id, badge_id) VALUES (?, ?)', [$studentId, $badgeId]);
            $earnedLookup[$badgeId] = true;
        }
    }
}

function handlePlatformCoursesRoutes(string $method, string $path): void {
    if ($method === 'GET' && $path === '/api/courses') {
        $role = (string)($_GET['role'] ?? '');
        $userId = (string)($_GET['userId'] ?? '');
        $status = (string)($_GET['status'] ?? 'active');
        $courseId = (int)($_GET['courseId'] ?? 0);
        $includeDetails = (string)($_GET['includeDetails'] ?? 'true') !== 'false';
        if ($role === '') {
            jsonResponse(400, ['error' => 'El parámetro role es requerido.']);
        }
        if ($role === 'teacher') {
            if ($userId === '') {
                jsonResponse(400, ['error' => 'El parámetro userId es requerido para teacher.']);
            }
            jsonResponse(200, ['data' => teacherCourses($userId, $status, $includeDetails, $courseId)]);
        }
        if ($role === 'student') {
            if ($userId === '') {
                jsonResponse(400, ['error' => 'El parámetro userId es requerido para student.']);
            }
            jsonResponse(200, ['data' => studentCourses($userId, $includeDetails, $courseId)]);
        }
        if ($role === 'admin') {
            jsonResponse(200, ['data' => adminCoursesByStatus($status, $includeDetails, $courseId)]);
        }
        jsonResponse(400, ['error' => 'Role inválido.']);
    }

    if ($method === 'POST' && $path === '/api/courses') {
        $payload = parseBody();
        $title = trim((string)($payload['title'] ?? ''));
        $teacherId = (int)($payload['teacherId'] ?? 0);
        $categoryId = isset($payload['categoryId']) ? (int)$payload['categoryId'] : null;
        $difficulty = normalizeCourseDifficultyValue($payload['difficulty'] ?? 'intermediate');
        $includeFundamentals = parseIncludeFundamentalsValue($payload['includeFundamentals'] ?? false) ? 1 : 0;
        if ($title === '' || $teacherId <= 0) {
            jsonResponse(400, ['error' => 'Título y teacherId son requeridos.']);
        }
        execSql('INSERT INTO courses (title, teacher_id, category_id, difficulty, include_fundamentals) VALUES (?, ?, ?, ?, ?)', [$title, $teacherId, $categoryId, $difficulty, $includeFundamentals]);
        jsonResponse(201, ['data' => ['courseId' => (int)db()->lastInsertId()]]);
    }

    if ($method === 'PATCH' && preg_match('#^/api/courses/(\d+)/title$#', $path, $matches)) {
        $courseId = (int)$matches[1];
        $payload = parseBody();
        $title = trim((string)($payload['title'] ?? ''));
        $categoryId = isset($payload['categoryId']) ? (int)$payload['categoryId'] : null;
        $difficulty = normalizeCourseDifficultyValue($payload['difficulty'] ?? 'intermediate');
        $includeFundamentals = parseIncludeFundamentalsValue($payload['includeFundamentals'] ?? false) ? 1 : 0;
        if ($title === '') {
            jsonResponse(400, ['error' => 'El título es requerido.']);
        }
        $previousCourse = one('SELECT title FROM courses WHERE id = ?', [$courseId]);
        $previousTitle = (string)($previousCourse['title'] ?? 'curso');
        execSql('UPDATE courses SET title = ?, category_id = ?, difficulty = ?, include_fundamentals = ? WHERE id = ?', [$title, $categoryId, $difficulty, $includeFundamentals, $courseId]);
        $studentRows = many('SELECT student_id FROM course_enrollments WHERE course_id = ?', [$courseId]);
        $studentIds = array_map(static fn(array $row): int => (int)$row['student_id'], $studentRows);
        notifyUsers(
            $studentIds,
            'Actualización en tu curso',
            'El curso "' . $previousTitle . '" ahora se muestra como "' . $title . '". Revisa el contenido actualizado.',
            '/courses/' . $courseId,
            'course_updated'
        );
        jsonResponse(200, ['data' => ['success' => true]]);
    }

    if ($method === 'PATCH' && preg_match('#^/api/courses/(\d+)/status$#', $path, $matches)) {
        $courseId = (int)$matches[1];
        $payload = parseBody();
        $action = (string)($payload['action'] ?? '');
        if ($action === '') {
            jsonResponse(400, ['error' => 'La acción es requerida.']);
        }
        $course = one('SELECT title FROM courses WHERE id = ?', [$courseId]);
        $courseTitle = (string)($course['title'] ?? 'curso');
        if ($action === 'archive') {
            execSql('UPDATE courses SET status = "archived" WHERE id = ?', [$courseId]);
        } elseif ($action === 'suspend') {
            execSql('UPDATE courses SET status = "suspended" WHERE id = ?', [$courseId]);
        } elseif ($action === 'reactivate' || $action === 'restore') {
            execSql('UPDATE courses SET status = "active" WHERE id = ?', [$courseId]);
        } else {
            jsonResponse(400, ['error' => 'Acción inválida.']);
        }
        $studentRows = many('SELECT student_id FROM course_enrollments WHERE course_id = ?', [$courseId]);
        $studentIds = array_map(static fn(array $row): int => (int)$row['student_id'], $studentRows);
        if ($action === 'suspend') {
            notifyUsers($studentIds, 'Curso suspendido', 'El curso "' . $courseTitle . '" fue suspendido temporalmente por administración.', '/courses/' . $courseId, 'course_status_change');
        } elseif ($action === 'reactivate' || $action === 'restore') {
            notifyUsers($studentIds, 'Curso reactivado', 'El curso "' . $courseTitle . '" está activo nuevamente y puedes continuar.', '/courses/' . $courseId, 'course_status_change');
        } elseif ($action === 'archive') {
            notifyUsers($studentIds, 'Curso archivado', 'El curso "' . $courseTitle . '" fue archivado y ya no recibirá nuevas actualizaciones.', '/courses/' . $courseId, 'course_status_change');
        }
        jsonResponse(200, ['data' => ['success' => true]]);
    }

    if ($method === 'POST' && preg_match('#^/api/courses/(\d+)/duplicate$#', $path, $matches)) {
        $courseId = (int)$matches[1];
        $newCourseId = duplicateCourse($courseId);
        jsonResponse(201, ['data' => ['success' => true, 'newCourseId' => $newCourseId]]);
    }

    if ($method === 'DELETE' && preg_match('#^/api/courses/(\d+)$#', $path, $matches)) {
        $courseId = (int)$matches[1];
        $course = one('SELECT id, title FROM courses WHERE id = ?', [$courseId]);
        if (!$course) {
            jsonResponse(404, ['error' => 'Curso no encontrado.']);
        }
        $pdo = db();
        $pdo->beginTransaction();
        try {
            // En lugar de borrar físicamente el curso, lo marcamos como archivado.
            // Esto preserva materiales, transcripciones y bibliografía.
            execSql('UPDATE courses SET status = "archived" WHERE id = ?', [$courseId]);
            $pdo->commit();
            jsonResponse(200, ['data' => ['success' => true, 'message' => 'Curso movido a archivados para preservación de materiales.']]);
        } catch (Throwable $error) {
            $pdo->rollBack();
            throw $error;
        }
    }

    if ($method === 'PATCH' && preg_match('#^/api/courses/(\d+)/students$#', $path, $matches)) {
        $courseId = (int)$matches[1];
        $payload = parseBody();
        $studentEnrollments = isset($payload['studentEnrollments']) && is_array($payload['studentEnrollments']) ? $payload['studentEnrollments'] : [];
        $notify = (bool)($payload['notify'] ?? false);
        $pdo = db();
        $pdo->beginTransaction();
        try {
            $current = many('SELECT student_id, due_date FROM course_enrollments WHERE course_id = ?', [$courseId]);
            $currentIds = array_map(fn(array $row): int => (int)$row['student_id'], $current);
            $currentIdSet = [];
            $currentDueDateByStudent = [];
            foreach ($currentIds as $currentId) {
                $currentIdSet[$currentId] = true;
            }
            foreach ($current as $currentRow) {
                $currentStudentId = (int)($currentRow['student_id'] ?? 0);
                if ($currentStudentId > 0) {
                    $currentDueDateByStudent[$currentStudentId] = isset($currentRow['due_date']) && $currentRow['due_date'] !== null ? (string)$currentRow['due_date'] : null;
                }
            }
            $incomingByStudent = [];
            foreach ($studentEnrollments as $enrollment) {
                $sid = (int)($enrollment['studentId'] ?? 0);
                if ($sid <= 0) {
                    continue;
                }
                $incomingByStudent[$sid] = $enrollment['dueDate'] ?? null;
            }
            $incomingIds = array_keys($incomingByStudent);
            $newIds = [];
            if (count($incomingIds) === 0) {
                execSql('DELETE FROM course_enrollments WHERE course_id = ?', [$courseId]);
            } else {
                $incomingPlaceholders = inClausePlaceholders($incomingIds);
                $deleteParams = array_merge([$courseId], $incomingIds);
                execSql(
                    "DELETE FROM course_enrollments WHERE course_id = ? AND student_id NOT IN ({$incomingPlaceholders})",
                    $deleteParams
                );
            }
            $updateEnrollmentStmt = $pdo->prepare('UPDATE course_enrollments SET due_date = ? WHERE course_id = ? AND student_id = ?');
            $insertEnrollmentStmt = $pdo->prepare('INSERT INTO course_enrollments (student_id, course_id, due_date) VALUES (?, ?, ?)');
            $dueDateChangedIds = [];
            foreach ($incomingByStudent as $sid => $dueDate) {
                if (isset($currentIdSet[$sid])) {
                    $updateEnrollmentStmt->execute([$dueDate ?: null, $courseId, $sid]);
                    $previousDueDate = $currentDueDateByStudent[$sid] ?? null;
                    $nextDueDate = $dueDate ?: null;
                    if ($previousDueDate !== $nextDueDate) {
                        $dueDateChangedIds[] = $sid;
                    }
                } else {
                    $insertEnrollmentStmt->execute([$sid, $courseId, $dueDate ?: null]);
                    $newIds[] = $sid;
                }
            }
            $course = one('SELECT title, teacher_id FROM courses WHERE id = ?', [$courseId]);
            $courseTitle = $course['title'] ?? 'curso';
            
            // Obtener email del profesor para usar en el Reply-To
            $teacherId = (int)($course['teacher_id'] ?? 0);
            $teacherEmail = '';
            $teacherName = '';
            if ($teacherId > 0) {
                $teacher = one('SELECT email, name FROM users WHERE id = ?', [$teacherId]);
                if ($teacher) {
                    $teacherEmail = $teacher['email'];
                    $teacherName = $teacher['name'];
                }
            }

            $emailsSent = 0;

            if (count($newIds) > 0) {
                $insertNotificationStmt = $pdo->prepare('INSERT INTO notifications (user_id, title, description, link) VALUES (?, ?, ?, ?)');
                
                // Pre-cargar los correos de los estudiantes si se va a notificar por email
                $studentEmails = [];
                if ($notify) {
                    $placeholders = inClausePlaceholders($newIds);
                    $users = many("SELECT id, email, name FROM users WHERE id IN ({$placeholders})", $newIds);
                    foreach ($users as $u) {
                        $studentEmails[(int)$u['id']] = $u;
                    }
                }

                foreach ($newIds as $sid) {
                    if (!courseNotificationAllowedForUser($sid, 'course_enrollment')) {
                        continue;
                    }
                    $insertNotificationStmt->execute([$sid, 'Inscrito en un nuevo curso', 'Has sido inscrito en el curso "' . $courseTitle . '". ¡Empieza a aprender ahora!', '/courses/' . $courseId]);
                    
                    // Enviar correo
                    if ($notify && isset($studentEmails[$sid])) {
                        $studentData = $studentEmails[$sid];
                        $frontendOrigin = envValue('FRONTEND_ORIGIN', 'https://academics.costasol.com.ec');
                        $courseLink = rtrim($frontendOrigin, '/') . '/courses/' . $courseId;
                        
                        $subject = "¡Bienvenido/a al curso: {$courseTitle}!";
                        $htmlBody = "
                            <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;'>
                                <h2 style='color: #0f172a;'>¡Hola, {$studentData['name']}!</h2>
                                <p>Has sido inscrito/a exitosamente en el curso: <strong>{$courseTitle}</strong>.</p>
                                <p>Ya puedes acceder a la plataforma para revisar el contenido y comenzar tu aprendizaje.</p>
                                " . ($teacherName ? "<p><strong>Profesor/a asignado/a:</strong> {$teacherName}</p>" : "") . "
                                <div style='text-align: center; margin: 30px 0;'>
                                    <a href='{$courseLink}' style='background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;'>Ir al curso ahora</a>
                                </div>
                                <p style='font-size: 12px; color: #64748b; margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 15px;'>
                                    Este es un mensaje automático de la plataforma AcademiCS. " . ($teacherEmail ? "Si respondes a este correo, el mensaje se enviará directamente a tu profesor." : "Por favor no respondas a esta dirección.") . "
                                </p>
                            </div>
                        ";

                        $success = sendMicrosoftGraphEmail($studentData['email'], $subject, $htmlBody, $teacherEmail ?: null);
                        if ($success) {
                            $emailsSent++;
                        }
                    }
                }
            }
            if (count($dueDateChangedIds) > 0) {
                $insertNotificationStmt = $pdo->prepare('INSERT INTO notifications (user_id, title, description, link) VALUES (?, ?, ?, ?)');
                foreach (array_values(array_unique($dueDateChangedIds)) as $sid) {
                    if (!courseNotificationAllowedForUser($sid, 'course_due_date_changed')) {
                        continue;
                    }
                    $dueDateValue = $incomingByStudent[$sid] ?? null;
                    $dueDateLabel = $dueDateValue ? (new DateTime((string)$dueDateValue))->format('d/m/Y H:i') : 'sin fecha límite';
                    $insertNotificationStmt->execute([$sid, 'Fecha límite actualizada', 'El curso "' . $courseTitle . '" tiene nueva fecha límite: ' . $dueDateLabel . '.', '/courses/' . $courseId]);
                }
            }
            $pdo->commit();
            
            $message = 'La lista de estudiantes inscritos ha sido actualizada.';
            if ($notify) {
                if (count($newIds) > 0) {
                    $message = "Estudiantes guardados. Se enviaron {$emailsSent} correos de notificación.";
                } else {
                    $message = 'La lista fue actualizada, pero no había nuevos estudiantes que notificar por correo.';
                }
            }
            jsonResponse(200, ['data' => ['success' => true, 'message' => $message, 'emailsSent' => $emailsSent]]);
        } catch (Throwable $error) {
            $pdo->rollBack();
            throw $error;
        }
    }

    if ($method === 'GET' && preg_match('#^/api/courses/(\d+)/analytics$#', $path, $matches)) {
        $courseId = (int)$matches[1];
        $enrolledRow = one('SELECT COUNT(DISTINCT student_id) AS totalEnrolled FROM course_enrollments WHERE course_id = ?', [$courseId]);
        $totalEnrolled = (int)($enrolledRow['totalEnrolled'] ?? 0);
        $moduleRows = many('SELECT id, title FROM course_modules WHERE course_id = ? ORDER BY module_order ASC', [$courseId]);
        $moduleIds = array_values(array_map(fn(array $row): int => (int)$row['id'], $moduleRows));
        $moduleStatsById = [];
        if (count($moduleIds) > 0) {
            $modulePlaceholders = inClausePlaceholders($moduleIds);
            $moduleStatsRows = many(
                "SELECT latest.module_id,
                        SUM(CASE WHEN latest.passed = 1 THEN 1 ELSE 0 END) AS passed_count,
                        AVG(latest.score) AS average_score
                 FROM evaluation_submissions latest
                 JOIN (
                    SELECT tie.module_id, tie.student_id, MAX(tie.id) AS max_id
                    FROM evaluation_submissions tie
                    JOIN (
                        SELECT module_id, student_id, MAX(submitted_at) AS max_submitted
                        FROM evaluation_submissions
                        WHERE module_id IN ({$modulePlaceholders})
                        GROUP BY module_id, student_id
                    ) picked_time ON picked_time.module_id = tie.module_id
                        AND picked_time.student_id = tie.student_id
                        AND picked_time.max_submitted = tie.submitted_at
                    GROUP BY tie.module_id, tie.student_id
                 ) picked ON picked.max_id = latest.id
                 GROUP BY latest.module_id",
                $moduleIds
            );
            foreach ($moduleStatsRows as $moduleStatsRow) {
                $moduleStatsById[(int)$moduleStatsRow['module_id']] = [
                    'passed_count' => (int)($moduleStatsRow['passed_count'] ?? 0),
                    'average_score' => isset($moduleStatsRow['average_score']) ? (float)$moduleStatsRow['average_score'] : 0.0,
                ];
            }
        }
        $totalModulesCompleted = 0;
        $totalAverageScoreSum = 0.0;
        $modulesWithAttempts = 0;
        $moduleAnalytics = [];
        foreach ($moduleRows as $moduleRow) {
            $moduleId = (int)$moduleRow['id'];
            $moduleStats = $moduleStatsById[$moduleId] ?? ['passed_count' => 0, 'average_score' => 0.0];
            $passedCount = (int)$moduleStats['passed_count'];
            $averageScore = (float)$moduleStats['average_score'];
            $completionRate = $totalEnrolled > 0 ? ($passedCount / $totalEnrolled) * 100 : 0;
            $moduleAnalytics[] = [
                'moduleId' => $moduleId,
                'title' => $moduleRow['title'],
                'completionRate' => $completionRate,
                'averageScore' => $averageScore,
            ];
            $totalModulesCompleted += $passedCount;
            if (isset($moduleStatsById[$moduleId])) {
                $totalAverageScoreSum += $averageScore;
                $modulesWithAttempts++;
            }
        }
        $statusRow = one(
            'SELECT SUM(CASE WHEN status = "completed" THEN 1 ELSE 0 END) AS completions,
                    SUM(CASE WHEN status = "in-progress" THEN 1 ELSE 0 END) AS active
             FROM course_enrollments
             WHERE course_id = ?',
            [$courseId]
        );
        $courseCompletions = (int)($statusRow['completions'] ?? 0);
        $activeStudents = (int)($statusRow['active'] ?? 0);
        $completionRate = $totalEnrolled > 0 ? ($courseCompletions / $totalEnrolled) * 100 : 0;
        $averageScore = $modulesWithAttempts > 0 ? $totalAverageScoreSum / $modulesWithAttempts : 0;
        jsonResponse(200, ['data' => [
            'totalEnrolled' => $totalEnrolled,
            'activeStudents' => $activeStudents,
            'courseCompletions' => $courseCompletions,
            'completionRate' => $completionRate,
            'averageScore' => $averageScore,
            'totalModulesCompleted' => $totalModulesCompleted,
            'modules' => $moduleAnalytics,
        ]]);
    }

    if ($method === 'PATCH' && preg_match('#^/api/modules/(\d+)/questionnaire$#', $path, $matches)) {
        $moduleId = (int)$matches[1];
        $payload = parseBody();
        $questionnaire = isset($payload['questionnaire']) && is_array($payload['questionnaire']) ? $payload['questionnaire'] : [];
        $questionsToDisplay = isset($payload['questionsToDisplay']) ? (int)$payload['questionsToDisplay'] : 10;
        $pdo = db();
        $pdo->beginTransaction();
        try {
            execSql('DELETE FROM module_questions WHERE module_id = ?', [$moduleId]);
            execSql('UPDATE course_modules SET questions_to_display = ? WHERE id = ?', [$questionsToDisplay, $moduleId]);
            foreach ($questionnaire as $question) {
                execSql(
                    'INSERT INTO module_questions (module_id, question_text, options, correct_option_index) VALUES (?, ?, ?, ?)',
                    [$moduleId, (string)($question['text'] ?? ''), json_encode($question['options'] ?? [], JSON_UNESCAPED_UNICODE), (int)($question['correctOptionIndex'] ?? 0)]
                );
            }
            $pdo->commit();
            jsonResponse(200, ['data' => ['success' => true]]);
        } catch (Throwable $error) {
            $pdo->rollBack();
            throw $error;
        }
    }

    if ($method === 'PATCH' && preg_match('#^/api/courses/(\d+)/learning-path$#', $path, $matches)) {
        $courseId = (int)$matches[1];
        $payload = parseBody();
        $learningPath = isset($payload['learningPath']) && is_array($payload['learningPath']) ? $payload['learningPath'] : [];
        $sourceFileHashes = isset($payload['sourceFileHashes']) && is_array($payload['sourceFileHashes']) ? $payload['sourceFileHashes'] : [];
        $pdo = db();
        $pdo->beginTransaction();
        try {
            $modules = many('SELECT id FROM course_modules WHERE course_id = ?', [$courseId]);
            $moduleIds = array_map(fn(array $row): int => (int)$row['id'], $modules);
            if (count($moduleIds) > 0) {
                $in = implode(',', array_fill(0, count($moduleIds), '?'));
                execSql("DELETE FROM module_syllabus WHERE module_id IN ({$in})", $moduleIds);
                execSql("DELETE FROM module_questions WHERE module_id IN ({$in})", $moduleIds);
                execSql("DELETE FROM evaluation_submissions WHERE module_id IN ({$in})", $moduleIds);
                execSql("DELETE FROM course_modules WHERE id IN ({$in})", $moduleIds);
            }
            execSql('DELETE FROM course_source_files WHERE course_id = ?', [$courseId]);
            $resolvedSourceFileIds = resolveSharedFileIdsFromReferences($sourceFileHashes);
            if (count($resolvedSourceFileIds) > 0) {
                $insertSourceStmt = $pdo->prepare('INSERT IGNORE INTO course_source_files (course_id, shared_file_id) VALUES (?, ?)');
                foreach ($resolvedSourceFileIds as $sharedFileId) {
                    $insertSourceStmt->execute([$courseId, $sharedFileId]);
                }
            }
            $updated = [];
            foreach (array_values($learningPath) as $index => $module) {
                execSql(
                    'INSERT INTO course_modules (course_id, title, introduction, module_order, questions_to_display) VALUES (?, ?, ?, ?, ?)',
                    [$courseId, (string)($module['title'] ?? ''), (string)($module['introduction'] ?? ''), $index + 1, (int)($module['questionsToDisplay'] ?? 10)]
                );
                $newModuleId = (int)$pdo->lastInsertId();
                $newSyllabus = [];
                $syllabusList = isset($module['syllabus']) && is_array($module['syllabus']) ? $module['syllabus'] : [];
                foreach ($syllabusList as $section) {
                    execSql('INSERT INTO module_syllabus (module_id, title, content) VALUES (?, ?, ?)', [$newModuleId, (string)($section['title'] ?? ''), (string)($section['content'] ?? '')]);
                    $newSyllabus[] = ['id' => (string)$pdo->lastInsertId(), 'title' => (string)($section['title'] ?? ''), 'content' => (string)($section['content'] ?? '')];
                }
                $newQuestions = [];
                $questionList = isset($module['questionnaire']) && is_array($module['questionnaire']) ? $module['questionnaire'] : [];
                foreach ($questionList as $question) {
                    execSql(
                        'INSERT INTO module_questions (module_id, question_text, options, correct_option_index) VALUES (?, ?, ?, ?)',
                        [$newModuleId, (string)($question['text'] ?? ''), json_encode($question['options'] ?? [], JSON_UNESCAPED_UNICODE), (int)($question['correctOptionIndex'] ?? 0)]
                    );
                    $newQuestions[] = [
                        'id' => (string)$pdo->lastInsertId(),
                        'text' => (string)($question['text'] ?? ''),
                        'options' => $question['options'] ?? [],
                        'correctOptionIndex' => (int)($question['correctOptionIndex'] ?? 0),
                    ];
                }
                $updated[] = [
                    'id' => (string)$newModuleId,
                    'title' => (string)($module['title'] ?? ''),
                    'introduction' => (string)($module['introduction'] ?? ''),
                    'status' => 'locked',
                    'syllabus' => $newSyllabus,
                    'questionnaire' => $newQuestions,
                    'questionsToDisplay' => (int)($module['questionsToDisplay'] ?? 10),
                ];
            }
            $pdo->commit();
            jsonResponse(200, ['data' => ['updatedLearningPath' => $updated]]);
        } catch (Throwable $error) {
            $pdo->rollBack();
            throw $error;
        }
    }

    if ($method === 'POST' && $path === '/api/evaluations') {
        $payload = parseBody();
        $studentId = (int)($payload['studentId'] ?? 0);
        $courseId = (int)($payload['courseId'] ?? 0);
        $moduleId = (int)($payload['moduleId'] ?? 0);
        $score = isset($payload['score']) ? (float)$payload['score'] : null;
        if ($studentId <= 0 || $courseId <= 0 || $moduleId <= 0 || $score === null) {
            jsonResponse(400, ['error' => 'Payload inválido para evaluación.']);
        }
        $pdo = db();
        $pdo->beginTransaction();
        try {
            $setting = one('SELECT `value` FROM app_settings WHERE `key` = "minPassingScore"');
            $passingScore = $setting ? (float)$setting['value'] : 70.0;
            $passed = $score >= $passingScore;
            $course = one('SELECT title FROM courses WHERE id = ?', [$courseId]);
            $courseTitle = (string)($course['title'] ?? 'curso');
            $module = one('SELECT title, module_order FROM course_modules WHERE id = ? AND course_id = ?', [$moduleId, $courseId]);
            $moduleTitle = (string)($module['title'] ?? 'módulo');
            $moduleOrder = (int)($module['module_order'] ?? 0);
            execSql(
                'INSERT INTO evaluation_submissions (student_id, module_id, score, passed, submitted_at) VALUES (?, ?, ?, ?, NOW())',
                [$studentId, $moduleId, $score, $passed ? 1 : 0]
            );
            if (courseNotificationAllowedForUser($studentId, 'evaluation_result')) {
                execSql(
                    'INSERT INTO notifications (user_id, title, description, link) VALUES (?, ?, ?, ?)',
                    [$studentId, $passed ? 'Evaluación aprobada' : 'Evaluación no aprobada', 'Resultado del módulo "' . $moduleTitle . '" en "' . $courseTitle . '": ' . number_format($score, 1) . '%.', '/courses/' . $courseId]
                );
            }
            $courseModules = many('SELECT id FROM course_modules WHERE course_id = ?', [$courseId]);
            $courseModuleIds = array_values(array_map(fn(array $row): int => (int)$row['id'], $courseModules));
            $totalModules = count($courseModuleIds);
            if ($totalModules === 0) {
                $pdo->commit();
                jsonResponse(200, ['data' => ['passed' => $passed]]);
            }
            $modulePlaceholders = inClausePlaceholders($courseModuleIds);
            $approvedRow = one(
                "SELECT COUNT(*) AS approvedCount
                 FROM evaluation_submissions es
                 JOIN (
                   SELECT tie.module_id, MAX(tie.id) AS max_id
                   FROM evaluation_submissions tie
                   JOIN (
                     SELECT module_id, MAX(submitted_at) AS max_submitted
                     FROM evaluation_submissions
                     WHERE student_id = ? AND module_id IN ({$modulePlaceholders})
                     GROUP BY module_id
                   ) latest ON latest.module_id = tie.module_id AND latest.max_submitted = tie.submitted_at
                   WHERE tie.student_id = ?
                   GROUP BY tie.module_id
                 ) picked ON picked.max_id = es.id
                 WHERE es.passed = 1",
                array_merge([$studentId], $courseModuleIds, [$studentId])
            );
            $approvedCount = (int)($approvedRow['approvedCount'] ?? 0);
            if ($totalModules > 0 && $approvedCount === $totalModules) {
                $finalRow = one(
                    "SELECT AVG(es.score) AS finalScore
                     FROM evaluation_submissions es
                     JOIN (
                       SELECT tie.module_id, MAX(tie.id) AS max_id
                       FROM evaluation_submissions tie
                       JOIN (
                         SELECT module_id, MAX(submitted_at) AS max_submitted
                         FROM evaluation_submissions
                         WHERE student_id = ? AND module_id IN ({$modulePlaceholders})
                         GROUP BY module_id
                       ) latest ON latest.module_id = tie.module_id AND latest.max_submitted = tie.submitted_at
                       WHERE tie.student_id = ?
                       GROUP BY tie.module_id
                     ) picked ON picked.max_id = es.id",
                    array_merge([$studentId], $courseModuleIds, [$studentId])
                );
                $finalScore = (float)($finalRow['finalScore'] ?? 0);
                execSql('UPDATE course_enrollments SET status = "completed", final_score = ? WHERE student_id = ? AND course_id = ?', [$finalScore, $studentId, $courseId]);
                if (courseNotificationAllowedForUser($studentId, 'course_completed')) {
                    execSql(
                        'INSERT INTO notifications (user_id, title, description, link) VALUES (?, ?, ?, ?)',
                        [$studentId, 'Curso completado', 'Completaste el curso "' . $courseTitle . '" con puntaje final de ' . number_format($finalScore, 1) . '%.', '/courses/' . $courseId]
                    );
                }
                try {
                    awardBadgesForStudentEvaluation($studentId, $courseId, $moduleId, $score, $passed, true);
                } catch (Throwable $badgeError) {
                    error_log('Error awarding student badges: ' . $badgeError->getMessage());
                }
                $pdo->commit();
                jsonResponse(200, ['data' => ['passed' => $passed, 'finalScore' => $finalScore]]);
            }
            if ($passed && $moduleOrder > 0) {
                $nextModule = one('SELECT title FROM course_modules WHERE course_id = ? AND module_order = ? LIMIT 1', [$courseId, $moduleOrder + 1]);
                if ($nextModule) {
                    $nextModuleTitle = (string)($nextModule['title'] ?? 'siguiente módulo');
                    if (courseNotificationAllowedForUser($studentId, 'module_unlocked')) {
                        execSql(
                            'INSERT INTO notifications (user_id, title, description, link) VALUES (?, ?, ?, ?)',
                            [$studentId, 'Módulo desbloqueado', 'Has desbloqueado "' . $nextModuleTitle . '" en el curso "' . $courseTitle . '".', '/courses/' . $courseId]
                        );
                    }
                }
            }
            try {
                awardBadgesForStudentEvaluation($studentId, $courseId, $moduleId, $score, $passed, false);
            } catch (Throwable $badgeError) {
                error_log('Error awarding student badges: ' . $badgeError->getMessage());
            }
            $pdo->commit();
            jsonResponse(200, ['data' => ['passed' => $passed]]);
        } catch (Throwable $error) {
            $pdo->rollBack();
            throw $error;
        }
    }
}
