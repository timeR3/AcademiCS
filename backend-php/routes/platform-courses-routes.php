<?php
declare(strict_types=1);

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
        if ($title === '' || $teacherId <= 0) {
            jsonResponse(400, ['error' => 'Título y teacherId son requeridos.']);
        }
        execSql('INSERT INTO courses (title, teacher_id, category_id) VALUES (?, ?, ?)', [$title, $teacherId, $categoryId]);
        jsonResponse(201, ['data' => ['courseId' => (int)db()->lastInsertId()]]);
    }

    if ($method === 'PATCH' && preg_match('#^/api/courses/(\d+)/title$#', $path, $matches)) {
        $courseId = (int)$matches[1];
        $payload = parseBody();
        $title = trim((string)($payload['title'] ?? ''));
        $categoryId = isset($payload['categoryId']) ? (int)$payload['categoryId'] : null;
        if ($title === '') {
            jsonResponse(400, ['error' => 'El título es requerido.']);
        }
        execSql('UPDATE courses SET title = ?, category_id = ? WHERE id = ?', [$title, $categoryId, $courseId]);
        jsonResponse(200, ['data' => ['success' => true]]);
    }

    if ($method === 'PATCH' && preg_match('#^/api/courses/(\d+)/status$#', $path, $matches)) {
        $courseId = (int)$matches[1];
        $payload = parseBody();
        $action = (string)($payload['action'] ?? '');
        if ($action === '') {
            jsonResponse(400, ['error' => 'La acción es requerida.']);
        }
        if ($action === 'archive') {
            execSql('UPDATE courses SET status = "archived" WHERE id = ?', [$courseId]);
        } elseif ($action === 'suspend') {
            execSql('UPDATE courses SET status = "suspended" WHERE id = ?', [$courseId]);
        } elseif ($action === 'reactivate' || $action === 'restore') {
            execSql('UPDATE courses SET status = "active" WHERE id = ?', [$courseId]);
        } else {
            jsonResponse(400, ['error' => 'Acción inválida.']);
        }
        jsonResponse(200, ['data' => ['success' => true]]);
    }

    if ($method === 'POST' && preg_match('#^/api/courses/(\d+)/duplicate$#', $path, $matches)) {
        $courseId = (int)$matches[1];
        $newCourseId = duplicateCourse($courseId);
        jsonResponse(201, ['data' => ['success' => true, 'newCourseId' => $newCourseId]]);
    }

    if ($method === 'PATCH' && preg_match('#^/api/courses/(\d+)/students$#', $path, $matches)) {
        $courseId = (int)$matches[1];
        $payload = parseBody();
        $studentEnrollments = isset($payload['studentEnrollments']) && is_array($payload['studentEnrollments']) ? $payload['studentEnrollments'] : [];
        $notify = (bool)($payload['notify'] ?? false);
        $pdo = db();
        $pdo->beginTransaction();
        try {
            $current = many('SELECT student_id FROM course_enrollments WHERE course_id = ?', [$courseId]);
            $currentIds = array_map(fn(array $row): int => (int)$row['student_id'], $current);
            $currentIdSet = [];
            foreach ($currentIds as $currentId) {
                $currentIdSet[$currentId] = true;
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
            foreach ($incomingByStudent as $sid => $dueDate) {
                if (isset($currentIdSet[$sid])) {
                    $updateEnrollmentStmt->execute([$dueDate ?: null, $courseId, $sid]);
                } else {
                    $insertEnrollmentStmt->execute([$sid, $courseId, $dueDate ?: null]);
                    $newIds[] = $sid;
                }
            }
            if (count($newIds) > 0) {
                $course = one('SELECT title FROM courses WHERE id = ?', [$courseId]);
                $courseTitle = $course['title'] ?? 'curso';
                $insertNotificationStmt = $pdo->prepare('INSERT INTO notifications (user_id, title, description, link) VALUES (?, ?, ?, ?)');
                foreach ($newIds as $sid) {
                    $insertNotificationStmt->execute([$sid, 'Inscrito en un nuevo curso', 'Has sido inscrito en el curso "' . $courseTitle . '". ¡Empieza a aprender ahora!', '/']);
                }
            }
            $pdo->commit();
            $message = 'La lista de estudiantes inscritos ha sido actualizada.';
            if ($notify) {
                if (count($newIds) > 0) {
                    $message = 'Estudiantes guardados. El envío de correo está deshabilitado en backend PHP.';
                } else {
                    $message = $message . ' No había nuevos estudiantes que notificar.';
                }
            }
            jsonResponse(200, ['data' => ['success' => true, 'message' => $message, 'emailsSent' => 0]]);
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
                 FROM (
                    SELECT es.module_id, es.student_id, es.score, es.passed,
                           ROW_NUMBER() OVER(PARTITION BY es.module_id, es.student_id ORDER BY es.submitted_at DESC) AS rn
                    FROM evaluation_submissions es
                    WHERE es.module_id IN ({$modulePlaceholders})
                 ) latest
                 WHERE latest.rn = 1
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
            if (count($sourceFileHashes) > 0) {
                execSql('DELETE FROM course_source_files WHERE course_id = ?', [$courseId]);
                $sharedFileIdsByHash = sharedFileIdsByHash($sourceFileHashes);
                $insertSourceStmt = $pdo->prepare('INSERT IGNORE INTO course_source_files (course_id, shared_file_id) VALUES (?, ?)');
                foreach ($sourceFileHashes as $hash) {
                    $normalizedHash = trim((string)$hash);
                    $sharedFileId = $sharedFileIdsByHash[$normalizedHash] ?? null;
                    if ($sharedFileId === null) {
                        continue;
                    }
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
            execSql(
                'INSERT INTO evaluation_submissions (student_id, module_id, score, passed, submitted_at) VALUES (?, ?, ?, ?, NOW())',
                [$studentId, $moduleId, $score, $passed ? 1 : 0]
            );
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
                $pdo->commit();
                jsonResponse(200, ['data' => ['passed' => $passed, 'finalScore' => $finalScore]]);
            }
            $pdo->commit();
            jsonResponse(200, ['data' => ['passed' => $passed]]);
        } catch (Throwable $error) {
            $pdo->rollBack();
            throw $error;
        }
    }
}
