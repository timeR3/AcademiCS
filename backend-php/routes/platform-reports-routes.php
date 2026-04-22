<?php
declare(strict_types=1);

function fetchDetailedCourseReport(int $courseId): array {
    $course = one('SELECT title FROM courses WHERE id = ?', [$courseId]);
    if (!$course) {
        return [];
    }

    $modules = many('SELECT id, title FROM course_modules WHERE course_id = ? ORDER BY module_order ASC', [$courseId]);
    $totalModules = count($modules);
    $moduleIds = array_map(fn($m) => (int)$m['id'], $modules);

    $enrollments = many(
        "SELECT ce.student_id, u.name, u.email, ce.enrolled_at, ce.status, ce.final_score, ce.due_date
         FROM course_enrollments ce
         JOIN users u ON u.id = ce.student_id
         WHERE ce.course_id = ?
         ORDER BY u.name ASC",
        [$courseId]
    );

    if (empty($enrollments)) {
        return [
            'courseTitle' => $course['title'],
            'totalEnrolled' => 0,
            'totalModules' => $totalModules,
            'students' => []
        ];
    }

    // Optimización: Obtener todos los módulos aprobados de todos los alumnos en una sola consulta
    $studentIds = array_map(fn($en) => (int)$en['student_id'], $enrollments);
    $allPassedRows = [];
    if ($totalModules > 0) {
        $mPlaceholders = inClausePlaceholders($moduleIds);
        $sPlaceholders = inClausePlaceholders($studentIds);
        $allPassedRows = many(
            "SELECT student_id, module_id, MAX(submitted_at) as last_date
             FROM evaluation_submissions
             WHERE student_id IN ($sPlaceholders) AND module_id IN ($mPlaceholders) AND passed = 1
             GROUP BY student_id, module_id",
            array_merge($studentIds, $moduleIds)
        );
    }

    // Organizar módulos aprobados por estudiante
    $passedByStudent = [];
    foreach ($allPassedRows as $row) {
        $sid = (int)$row['student_id'];
        if (!isset($passedByStudent[$sid])) {
            $passedByStudent[$sid] = ['count' => 0, 'lastDate' => null];
        }
        $passedByStudent[$sid]['count']++;
        if ($passedByStudent[$sid]['lastDate'] === null || $row['last_date'] > $passedByStudent[$sid]['lastDate']) {
            $passedByStudent[$sid]['lastDate'] = $row['last_date'];
        }
    }

    $reportData = [];
    foreach ($enrollments as $en) {
        $studentId = (int)$en['student_id'];
        $stats = $passedByStudent[$studentId] ?? ['count' => 0, 'lastDate' => null];
        
        $progress = $totalModules > 0 ? round(($stats['count'] / $totalModules) * 100, 2) : 0;

        $reportData[] = [
            'studentName' => $en['name'],
            'email' => $en['email'],
            'enrolledAt' => $en['enrolled_at'],
            'status' => $en['status'] === 'completed' ? 'Completado' : 'En Progreso',
            'progress' => $progress . '%',
            'grade' => $en['final_score'] !== null ? number_format((float)$en['final_score'], 2) : 'N/A',
            'completionDate' => $en['status'] === 'completed' ? ($stats['lastDate'] ?: 'N/A') : 'N/A',
            'dueDate' => $en['due_date'] ?: 'Sin límite'
        ];
    }

    return [
        'courseTitle' => $course['title'],
        'totalEnrolled' => count($enrollments),
        'totalModules' => $totalModules,
        'students' => $reportData
    ];
}

function handlePlatformReportsRoutes(string $method, string $path): void {
    if ($method === 'GET' && $path === '/api/reports/course-progress') {
        $courseId = (int)($_GET['courseId'] ?? 0);
        if ($courseId <= 0) {
            jsonResponse(400, ['error' => 'ID de curso inválido.']);
        }
        $data = fetchDetailedCourseReport($courseId);
        jsonResponse(200, ['data' => $data]);
    }

    if ($method === 'GET' && $path === '/api/reports/export/csv') {
        // Limpiar cualquier buffer de salida previo para evitar archivos corruptos
        if (ob_get_length()) ob_end_clean();
        
        $courseId = (int)($_GET['courseId'] ?? 0);
        if ($courseId <= 0) {
            http_response_code(400);
            echo "ID de curso inválido.";
            exit;
        }
        
        $data = fetchDetailedCourseReport($courseId);
        if (empty($data)) {
            http_response_code(404);
            echo "Curso no encontrado.";
            exit;
        }
        
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="reporte_curso_' . $courseId . '.csv"');
        header('Pragma: no-cache');
        header('Expires: 0');
        
        $output = fopen('php://output', 'w');
        // BOM para que Excel reconozca UTF-8
        fprintf($output, chr(0xEF).chr(0xBB).chr(0xBF));
        
        // Encabezados del curso
        fputcsv($output, ['Reporte de Curso:', $data['courseTitle']]);
        fputcsv($output, ['Total Inscritos:', $data['totalEnrolled']]);
        fputcsv($output, ['Fecha de Generación:', date('Y-m-d H:i:s')]);
        fputcsv($output, []);
        
        // Encabezados de tabla
        fputcsv($output, ['Estudiante', 'Email', 'Fecha Inscripción', 'Estado', 'Progreso', 'Calificación Final', 'Fecha de Cumplimiento', 'Fecha Límite']);
        
        foreach ($data['students'] as $student) {
            fputcsv($output, [
                $student['studentName'],
                $student['email'],
                $student['enrolledAt'],
                $student['status'],
                $student['progress'],
                $student['grade'],
                $student['completionDate'],
                $student['dueDate']
            ]);
        }
        fclose($output);
        exit;
    }

    if ($method === 'GET' && $path === '/api/reports/export/pdf-view') {
        $courseId = (int)($_GET['courseId'] ?? 0);
        if ($courseId <= 0) {
            echo "ID de curso inválido.";
            exit;
        }
        $data = fetchDetailedCourseReport($courseId);
        
        ?>
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <title>Reporte de Curso - <?php echo htmlspecialchars($data['courseTitle']); ?></title>
            <style>
                body { font-family: sans-serif; color: #333; padding: 20px; line-height: 1.4; }
                .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #eee; padding-bottom: 10px; }
                .summary { margin-bottom: 20px; display: flex; justify-content: space-between; background: #f9f9f9; padding: 15px; border-radius: 8px; }
                table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                th, td { border: 1px solid #ddd; padding: 10px; text-align: left; font-size: 12px; }
                th { background-color: #3b82f6; color: white; }
                tr:nth-child(even) { background-color: #f2f2f2; }
                .status-completed { color: #059669; font-weight: bold; }
                .status-progress { color: #d97706; }
                .no-print { background: #fff3cd; padding: 15px; margin-bottom: 20px; border: 1px solid #ffeeba; text-align: center; border-radius: 8px; }
                button { background: #3b82f6; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-weight: bold; }
                button:hover { background: #2563eb; }
                @media print {
                    .no-print { display: none; }
                    body { padding: 0; }
                    th { background-color: #3b82f6 !important; color: white !important; -webkit-print-color-adjust: exact; }
                }
            </style>
        </head>
        <body>
            <div class="no-print">
                <p style="margin-bottom: 10px;">Para guardar como PDF, haz clic en el botón y selecciona "Guardar como PDF" en el destino de la impresora.</p>
                <button onclick="window.print()">Descargar / Imprimir Reporte</button>
            </div>
            
            <div class="header">
                <h1 style="margin: 0; color: #1e3a8a;">AcademiCS</h1>
                <h2 style="margin: 5px 0 0 0; color: #4b5563;">Reporte de Progreso Estudiantil</h2>
                <h3 style="margin: 10px 0 0 0; color: #2563eb;"><?php echo htmlspecialchars($data['courseTitle']); ?></h3>
            </div>
            
            <div class="summary">
                <div><strong>Fecha Generación:</strong> <?php echo date('d/m/Y H:i'); ?></div>
                <div><strong>Total Estudiantes:</strong> <?php echo $data['totalEnrolled']; ?></div>
                <div><strong>Módulos en el Curso:</strong> <?php echo $data['totalModules']; ?></div>
            </div>
            
            <table>
                <thead>
                    <tr>
                        <th>Estudiante</th>
                        <th>Email</th>
                        <th>Estado</th>
                        <th>Progreso</th>
                        <th>Calificación</th>
                        <th>Finalización</th>
                    </tr>
                </thead>
                <tbody>
                    <?php if (empty($data['students'])): ?>
                        <tr><td colspan="6" style="text-align: center;">No hay estudiantes inscritos actualmente.</td></tr>
                    <?php else: ?>
                        <?php foreach ($data['students'] as $student): ?>
                            <tr>
                                <td style="font-weight: 500;"><?php echo htmlspecialchars($student['studentName']); ?></td>
                                <td><?php echo htmlspecialchars($student['email']); ?></td>
                                <td class="<?php echo $student['status'] === 'Completado' ? 'status-completed' : 'status-progress'; ?>">
                                    <?php echo $student['status']; ?>
                                </td>
                                <td>
                                    <div style="background: #e5e7eb; height: 8px; border-radius: 4px; width: 60px; display: inline-block; margin-right: 5px;">
                                        <div style="background: #3b82f6; height: 100%; border-radius: 4px; width: <?php echo $student['progress']; ?>;"></div>
                                    </div>
                                    <?php echo $student['progress']; ?>
                                </td>
                                <td style="font-weight: bold;"><?php echo $student['grade']; ?></td>
                                <td><?php echo $student['completionDate']; ?></td>
                            </tr>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </tbody>
            </table>
            
            <div style="margin-top: 50px; font-size: 10px; text-align: center; color: #9ca3af; border-top: 1px solid #eee; padding-top: 20px;">
                Este documento es un reporte oficial generado por la plataforma AcademiCS.
            </div>
        </body>
        </html>
        <?php
        exit;
    }
}
