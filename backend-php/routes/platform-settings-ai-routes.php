<?php
declare(strict_types=1);

function decodeStructuredContentValue($value): array {
    if (!is_string($value) || trim($value) === '') {
        return [];
    }
    $decoded = json_decode($value, true);
    if (!is_array($decoded)) {
        return [];
    }
    $items = [];
    foreach ($decoded as $item) {
        if (!is_array($item)) {
            continue;
        }
        $title = isset($item['title']) ? trim((string)$item['title']) : '';
        $content = isset($item['content']) ? trim((string)$item['content']) : '';
        if ($content === '') {
            continue;
        }
        $items[] = [
            'title' => $title !== '' ? $title : 'Bloque',
            'content' => $content,
        ];
    }
    return $items;
}

function structuredContentFromSourceFileIds(array $sourceFileIds): array {
    $ids = [];
    foreach ($sourceFileIds as $id) {
        $numeric = (int)$id;
        if ($numeric > 0) {
            $ids[] = $numeric;
        }
    }
    $ids = array_values(array_unique($ids));
    if (count($ids) === 0) {
        return [];
    }
    $placeholders = inClausePlaceholders($ids);
    $rows = many(
        "SELECT csf.id AS source_file_id, ft.structured_content
         FROM course_source_files csf
         JOIN shared_files sf ON sf.id = csf.shared_file_id
         LEFT JOIN file_transcripts ft ON ft.file_hash = sf.file_hash
         WHERE csf.id IN ({$placeholders})
         ORDER BY csf.id ASC",
        $ids
    );
    $structured = [];
    foreach ($rows as $row) {
        $items = decodeStructuredContentValue($row['structured_content'] ?? null);
        foreach ($items as $item) {
            $structured[] = $item;
        }
    }
    return $structured;
}

function structuredContentFromPdfDataUris(array $pdfDataUris): array {
    if (count($pdfDataUris) === 0) {
        return [];
    }
    $hashes = [];
    foreach ($pdfDataUris as $uri) {
        $dataUri = is_string($uri) ? trim($uri) : '';
        if ($dataUri === '') {
            continue;
        }
        try {
            $binary = parseDataUri($dataUri);
        } catch (Throwable $error) {
            continue;
        }
        $hashes[] = hash('sha256', $binary);
    }
    $hashes = array_values(array_unique($hashes));
    if (count($hashes) === 0) {
        return [];
    }
    $placeholders = inClausePlaceholders($hashes);
    $rows = many(
        "SELECT file_hash, structured_content
         FROM file_transcripts
         WHERE file_hash IN ({$placeholders})",
        $hashes
    );
    $byHash = [];
    foreach ($rows as $row) {
        $fileHash = (string)($row['file_hash'] ?? '');
        if ($fileHash === '') {
            continue;
        }
        $byHash[$fileHash] = decodeStructuredContentValue($row['structured_content'] ?? null);
    }
    $structured = [];
    foreach ($hashes as $hash) {
        $items = $byHash[$hash] ?? [];
        foreach ($items as $item) {
            $structured[] = $item;
        }
    }
    return $structured;
}

function handlePlatformSettingsAiRoutes(string $method, string $path): void {
    if ($method === 'GET' && $path === '/api/app-settings') {
        $rows = many('SELECT `key`, `value` FROM app_settings');
        $settings = [];
        foreach ($rows as $row) {
            $settings[(string)$row['key']] = (string)$row['value'];
        }
        if (!isset($settings['aiModel'])) {
            $model = one('SELECT id FROM ai_models WHERE status = "active" LIMIT 1');
            $settings['aiModel'] = (string)($model['id'] ?? 'gemini-1.5-pro-latest');
        }
        $defaults = [
            'adminSyllabusPrompt' => 'Eres un educador y diseñador de planes de estudio experto.',
            'adminQuestionnairePrompt' => 'Eres un educador experto especializado en crear evaluaciones.',
            'enableYoutubeGeneration' => 'false',
            'minPassingScore' => '70',
            'scoreCalculationMethod' => 'last_attempt',
        ];
        foreach ($defaults as $key => $value) {
            if (!isset($settings[$key])) {
                $settings[$key] = $value;
            }
        }
        jsonResponse(200, ['data' => $settings]);
    }

    if ($method === 'PATCH' && $path === '/api/app-settings') {
        $payload = parseBody();
        $pdo = db();
        $pdo->beginTransaction();
        try {
            foreach ($payload as $key => $value) {
                if (!is_string($key) || $value === null) {
                    continue;
                }
                execSql(
                    'INSERT INTO app_settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)',
                    [$key, (string)$value]
                );
                if ($key === 'adminSyllabusPrompt') {
                    execSql('INSERT INTO prompt_history (prompt_type, content) VALUES ("syllabus", ?)', [(string)$value]);
                } elseif ($key === 'adminQuestionnairePrompt') {
                    execSql('INSERT INTO prompt_history (prompt_type, content) VALUES ("questionnaire", ?)', [(string)$value]);
                }
            }
            $pdo->commit();
            jsonResponse(200, ['data' => ['success' => true]]);
        } catch (Throwable $error) {
            $pdo->rollBack();
            throw $error;
        }
    }

    if ($method === 'GET' && $path === '/api/prompt-history') {
        $rows = many('SELECT id, prompt_type, content, saved_at FROM prompt_history ORDER BY saved_at DESC');
        $data = array_map(fn(array $row): array => [
            'id' => (string)$row['id'],
            'promptType' => $row['prompt_type'],
            'content' => $row['content'],
            'savedAt' => (new DateTime((string)$row['saved_at']))->format(DateTime::ATOM),
        ], $rows);
        jsonResponse(200, ['data' => $data]);
    }

    if ($method === 'GET' && $path === '/api/ai-config-status') {
        jsonResponse(200, ['data' => ['isApiKeySet' => envValue('GEMINI_API_KEY') !== null]]);
    }

    if ($method === 'GET' && $path === '/api/ai-models') {
        $rows = many('SELECT id, name, pricing_input, pricing_output, status FROM ai_models ORDER BY name');
        $data = array_map(fn(array $row): array => [
            'id' => $row['id'],
            'name' => $row['name'],
            'pricingInput' => $row['pricing_input'],
            'pricingOutput' => $row['pricing_output'],
            'status' => $row['status'],
        ], $rows);
        jsonResponse(200, ['data' => $data]);
    }

    if ($method === 'POST' && $path === '/api/ai-models') {
        $payload = parseBody();
        $id = trim((string)($payload['id'] ?? ''));
        $name = trim((string)($payload['name'] ?? ''));
        if ($id === '' || $name === '') {
            jsonResponse(400, ['error' => 'id y name son requeridos.']);
        }
        $exists = one('SELECT id FROM ai_models WHERE id = ?', [$id]);
        if ($exists) {
            execSql(
                'UPDATE ai_models SET name = ?, pricing_input = ?, pricing_output = ?, status = ? WHERE id = ?',
                [$name, (string)($payload['pricingInput'] ?? ''), (string)($payload['pricingOutput'] ?? ''), (string)($payload['status'] ?? 'active'), $id]
            );
        } else {
            execSql(
                'INSERT INTO ai_models (id, name, pricing_input, pricing_output, status) VALUES (?, ?, ?, ?, ?)',
                [$id, $name, (string)($payload['pricingInput'] ?? ''), (string)($payload['pricingOutput'] ?? ''), (string)($payload['status'] ?? 'active')]
            );
        }
        jsonResponse(200, ['data' => ['success' => true]]);
    }

    if ($method === 'DELETE' && preg_match('#^/api/prompt-history/(\d+)$#', $path, $matches)) {
        $id = (int)$matches[1];
        $affected = execSql('DELETE FROM prompt_history WHERE id = ?', [$id]);
        if ($affected === 0) {
            jsonResponse(400, ['error' => 'El prompt no fue encontrado o ya fue eliminado.']);
        }
        jsonResponse(200, ['data' => ['success' => true]]);
    }

    if ($method === 'DELETE' && preg_match('#^/api/ai-models/(.+)$#', $path, $matches)) {
        $modelId = urldecode($matches[1]);
        $affected = execSql('DELETE FROM ai_models WHERE id = ?', [$modelId]);
        if ($affected === 0) {
            jsonResponse(400, ['error' => 'El modelo de IA no fue encontrado o ya fue eliminado.']);
        }
        jsonResponse(200, ['data' => ['success' => true]]);
    }

    if ($method === 'POST' && $path === '/api/syllabus/index') {
        $payload = parseBody();
        $numModules = max(1, (int)($payload['numModules'] ?? 4));
        $moduleTitles = [];
        for ($i = 0; $i < $numModules + 1; $i++) {
            $moduleTitles[] = randomModuleTitle($i);
        }
        $sourceFileIds = isset($payload['sourceFileIds']) && is_array($payload['sourceFileIds']) ? $payload['sourceFileIds'] : [];
        $pdfDataUris = isset($payload['pdfDataUris']) && is_array($payload['pdfDataUris']) ? $payload['pdfDataUris'] : [];
        $structuredContent = structuredContentFromSourceFileIds($sourceFileIds);
        if (count($structuredContent) === 0 && count($sourceFileIds) > 0) {
            jsonResponse(409, ['error' => 'Las fuentes seleccionadas aún no tienen transcripción procesada. Reprocesa los archivos e inténtalo nuevamente.']);
        }
        if (count($structuredContent) === 0 && count($sourceFileIds) === 0) {
            $structuredContent = structuredContentFromPdfDataUris($pdfDataUris);
        }
        if (count($structuredContent) === 0 && count($pdfDataUris) > 0) {
            jsonResponse(409, ['error' => 'No se encontró transcripción utilizable para los PDF cargados. Procesa nuevamente los archivos.']);
        }
        $classificationMap = [];
        if (count($structuredContent) === 0) {
            jsonResponse(400, ['error' => 'Debe proporcionar al menos una fuente.']);
        }
        foreach ($moduleTitles as $idx => $title) {
            $classificationMap[$title] = [strval($idx % count($structuredContent))];
        }
        jsonResponse(200, ['data' => [
            'moduleTitles' => $moduleTitles,
            'structuredContent' => $structuredContent,
            'classificationMap' => $classificationMap,
            'pdfHashes' => [],
            'promptSource' => 'php-fallback',
        ]]);
    }

    if ($method === 'POST' && $path === '/api/syllabus/module') {
        $payload = parseBody();
        $moduleTitle = trim((string)($payload['moduleTitle'] ?? ''));
        if ($moduleTitle === '') {
            jsonResponse(400, ['error' => 'moduleTitle is required.']);
        }
        $structuredContent = isset($payload['structuredContent']) && is_array($payload['structuredContent']) ? $payload['structuredContent'] : [];
        $intro = 'Introducción del módulo ' . $moduleTitle;
        if (count($structuredContent) > 0) {
            $intro = 'Este módulo desarrolla ' . $moduleTitle . ' a partir de fuentes disponibles.';
        }
        $syllabus = [];
        $limit = min(4, max(1, count($structuredContent)));
        if ($limit === 0) {
            $limit = 1;
            $structuredContent = [['title' => 'Base', 'content' => 'Contenido base']];
        }
        for ($i = 0; $i < $limit; $i++) {
            $item = $structuredContent[$i] ?? ['title' => 'Tema ' . ($i + 1), 'content' => 'Contenido del tema'];
            $title = is_array($item) && isset($item['title']) ? (string)$item['title'] : 'Tema ' . ($i + 1);
            $content = is_array($item) && isset($item['content']) ? (string)$item['content'] : 'Contenido del tema';
            $syllabus[] = [
                'title' => $title,
                'content' => mb_substr($content, 0, 900),
            ];
        }
        jsonResponse(200, ['data' => [
            'introduction' => $intro,
            'syllabus' => $syllabus,
            'questionnaire' => [],
            'questionsToDisplay' => 10,
        ]]);
    }

    if ($method === 'POST' && $path === '/api/questionnaire/generate') {
        $payload = parseBody();
        $content = trim((string)($payload['content'] ?? ''));
        if ($content === '') {
            jsonResponse(400, ['error' => 'content is required.']);
        }
        $numQuestions = max(1, (int)($payload['numQuestions'] ?? 10));
        $questions = [];
        for ($i = 0; $i < $numQuestions; $i++) {
            $questions[] = [
                'text' => 'Pregunta ' . ($i + 1) . ': ¿Cuál es la idea clave del contenido?',
                'options' => [
                    'Resumen conceptual principal',
                    'Detalle secundario',
                    'Dato no relacionado',
                    'Suposición incorrecta',
                ],
                'correctOptionIndex' => 0,
            ];
        }
        jsonResponse(200, ['data' => ['questionnaire' => $questions]]);
    }
}
