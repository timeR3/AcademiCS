<?php
declare(strict_types=1);

function fetchDetailedCourseReport(int $courseId): array {
    $course = one(
        'SELECT c.title, c.teacher_id, u.name AS teacher_name
         FROM courses c
         JOIN users u ON u.id = c.teacher_id
         WHERE c.id = ?',
        [$courseId]
    );
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
            'teacherName' => $course['teacher_name'],
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
        'teacherName' => $course['teacher_name'],
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
        
        // Detectar si es un curso de UAFE basándose en el título
        $isUafe = stripos($data['courseTitle'], 'UAFE') !== false 
               || stripos($data['courseTitle'], 'Lavado de Activos') !== false
               || stripos($data['courseTitle'], 'LA/FT') !== false
               || stripos($data['courseTitle'], 'PLA') !== false;
        
        // Leer parámetros opcionales del modal UAFE (vienen por query string)
        $uafeFecha = $_GET['fecha'] ?? '';
        $uafeDuracion = $_GET['duracion'] ?? '';
        $uafeBaseLegal = $_GET['baseLegal'] ?? '';
        $uafeTipo = $_GET['tipo'] ?? '';
        
        $teacherName = $data['teacherName'] ?? 'N/A';
        
        // Construir la URL base para los logos
        $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
        $host = $_SERVER['HTTP_HOST'] ?? 'localhost:8000';
        $baseUrl = $protocol . '://' . $host;
        
        echo '<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Reporte - ' . htmlspecialchars($data['courseTitle']) . '</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: "Helvetica Neue", "Helvetica", "Arial", sans-serif; color: #1a1a1a; padding: 15px 25px; line-height: 1.3; font-size: 11px; }
        
        .no-print { background: #fff3cd; padding: 15px; margin-bottom: 20px; border: 1px solid #ffeeba; text-align: center; border-radius: 8px; }
        .no-print button { background: #3b82f6; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-weight: bold; font-size: 14px; }
        .no-print button:hover { background: #2563eb; }
        
        .header-logos { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px; padding: 0 10px; }
        .logo-ctv { height: 65px; }
        .logo-uafe { height: 75px; }
        
        .program-title { text-align: center; font-size: 13px; font-weight: bold; margin: 8px 0 15px 0; line-height: 1.4; }
        
        .info-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
        .info-table td { border: 1px solid #333; padding: 5px 10px; vertical-align: middle; font-size: 11px; }
        .info-label { background-color: #e8e8e8; font-weight: bold; width: 110px; text-align: right; padding-right: 12px !important; }
        
        .participants-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        .participants-table th { border: 1px solid #333; padding: 7px 10px; background-color: #e8e8e8; text-align: left; font-weight: bold; font-size: 11px; }
        .participants-table td { border: 1px solid #333; padding: 10px; font-size: 11px; }
        .participants-table .col-num { width: 5%; text-align: center; }
        .participants-table .col-name { width: 30%; }
        .participants-table .col-email { width: 30%; }
        .participants-table .col-signature { width: 35%; }
        
        .simple-header { text-align: center; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #ccc; }
        .simple-header h1 { font-size: 18px; color: #1e3a8a; margin-bottom: 4px; }
        .simple-header h2 { font-size: 14px; color: #555; font-weight: normal; }
        .simple-header .meta { font-size: 11px; color: #777; margin-top: 8px; }
        
        .footer-note { margin-top: 40px; font-size: 9px; text-align: center; color: #888; border-top: 1px solid #ddd; padding-top: 15px; }
        
        @media print {
            .no-print { display: none !important; }
            body { padding: 0 10px; }
            @page { margin: 1cm; }
            .info-label { background-color: #e8e8e8 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .participants-table th { background-color: #e8e8e8 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
    </style>
</head>
<body>
    <div class="no-print">
        <p style="margin-bottom: 10px;">Para guardar como PDF, haz clic en el bot&oacute;n y selecciona "Guardar como PDF" en el destino de la impresora.</p>
        <button onclick="window.print()">Descargar / Imprimir Reporte</button>
    </div>';
        
        if ($isUafe) {
            // ============ CABECERA UAFE ============
            echo '
    <div class="header-logos">
        <img src="' . $baseUrl . '/assets/img/logo_ctv.png" alt="Constructora Thalia Victoria" class="logo-ctv" onerror="this.outerHTML=\'<div style=font-size:14px;font-weight:bold;color:#1e3a8a;>CONSTRUCTORA<br>THALIA VICTORIA</div>\';">
        <img src="' . $baseUrl . '/assets/img/logo_uafe.png" alt="UAFE" class="logo-uafe" onerror="this.outerHTML=\'<div style=font-size:14px;font-weight:bold;color:#c0392b;text-align:right;>UAFE<br><small>Unidad de An&aacute;lisis<br>Financiero y Econ&oacute;mico</small></div>\';">
    </div>
    
    <div class="program-title">
        Programa Anual de Capacitaci&oacute;n en Materia de Prevenci&oacute;n de Lavado de<br>
        Activos (PLA) - ' . date('Y') . '
    </div>
    
    <table class="info-table">
        <tr>
            <td class="info-label">Raz&oacute;n Social :</td>
            <td>CONSTRUCTORA THALIA VICTORIA S.A.</td>
        </tr>
        <tr>
            <td class="info-label">RUC:</td>
            <td>0990215456001</td>
        </tr>
        <tr>
            <td class="info-label">Base Legal:</td>
            <td>' . htmlspecialchars($uafeBaseLegal ?: 'Resoluciones UAFE-DG-2024-0621 (Reg. Ofc.675 -30/10/24) / SCVS-RNAE-1904.') . '</td>
        </tr>
    </table>
    
    <table class="info-table">
        <tr>
            <td class="info-label">Tema:</td>
            <td><strong>' . htmlspecialchars($data['courseTitle']) . '</strong></td>
        </tr>
        <tr>
            <td class="info-label">Fecha:</td>
            <td><strong>' . htmlspecialchars($uafeFecha ?: date('d/m/Y')) . '</strong></td>
        </tr>
        <tr>
            <td class="info-label">Expositor:</td>
            <td><strong>' . htmlspecialchars($teacherName) . '</strong></td>
        </tr>
        <tr>
            <td class="info-label">Duraci&oacute;n:</td>
            <td><strong>' . htmlspecialchars($uafeDuracion ?: 'N/A') . '</strong></td>
        </tr>
        <tr>
            <td class="info-label">Tipo:</td>
            <td>';
            
            if ($uafeTipo === 'induccion') {
                echo '<strong>[X] Inducci&oacute;n (Nuevo Personal) &nbsp;&nbsp; [ ] Refuerzo Anual</strong>';
            } elseif ($uafeTipo === 'refuerzo') {
                echo '<strong>[ ] Inducci&oacute;n (Nuevo Personal) &nbsp;&nbsp; [X] Refuerzo Anual</strong>';
            } else {
                echo '<strong>[ ] Inducci&oacute;n (Nuevo Personal) &nbsp;&nbsp; [ ] Refuerzo Anual</strong>';
            }
            
            echo '</td>
        </tr>
    </table>';
        } else {
            // ============ CABECERA SIMPLE (no-UAFE) ============
            echo '
    <div class="header-logos" style="justify-content: flex-start;">
        <img src="' . $baseUrl . '/assets/img/logo_ctv.png" alt="Constructora Thalia Victoria" class="logo-ctv" onerror="this.outerHTML=\'<div style=font-size:14px;font-weight:bold;color:#1e3a8a;>CONSTRUCTORA THALIA VICTORIA</div>\';">
    </div>
    <div class="simple-header">
        <h1>' . htmlspecialchars($data['courseTitle']) . '</h1>
        <h2>Registro de Asistencia</h2>
        <div class="meta">
            Expositor: <strong>' . htmlspecialchars($teacherName) . '</strong> &nbsp;|&nbsp;
            Fecha: <strong>' . date('d/m/Y') . '</strong> &nbsp;|&nbsp;
            Participantes: <strong>' . $data['totalEnrolled'] . '</strong>
        </div>
    </div>';
        }
        
        // ============ TABLA DE PARTICIPANTES ============
        echo '
    <table class="participants-table">
        <thead>
            <tr>
                <th class="col-num">N&deg;</th>
                <th class="col-name">Nombre del Participante</th>
                <th class="col-email">Correo Electr&oacute;nico</th>
                <th class="col-signature">Firma</th>
            </tr>
        </thead>
        <tbody>';
        
        if (empty($data['students'])) {
            echo '<tr><td colspan="4" style="text-align: center; padding: 20px;">No hay participantes registrados en este curso.</td></tr>';
        } else {
            $num = 1;
            foreach ($data['students'] as $student) {
                echo '<tr>
                    <td class="col-num">' . $num++ . '</td>
                    <td>' . htmlspecialchars($student['studentName']) . '</td>
                    <td>' . htmlspecialchars($student['email']) . '</td>
                    <td></td>
                </tr>';
            }
            // Filas vacías adicionales para firmas manuales
            for ($i = 0; $i < 3; $i++) {
                echo '<tr>
                    <td class="col-num">' . $num++ . '</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td></td>
                </tr>';
            }
        }
        
        echo '
        </tbody>
    </table>
    
    <div class="footer-note">
        Este documento es un registro oficial de asistencia generado por la plataforma AcademiCS para Constructora Thalia Victoria S.A.
    </div>
</body>
</html>';
        exit;
    }
}
