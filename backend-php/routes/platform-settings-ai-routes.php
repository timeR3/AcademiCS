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

function pdfHashesFromDataUris(array $pdfDataUris): array {
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
        $hash = hash('sha256', $binary);
        if ($hash !== '') {
            $hashes[$hash] = true;
        }
    }
    return array_keys($hashes);
}

function sourceFileHashesFromIds(array $sourceFileIds): array {
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
        "SELECT sf.file_hash
         FROM course_source_files csf
         JOIN shared_files sf ON sf.id = csf.shared_file_id
         WHERE csf.id IN ({$placeholders})",
        $ids
    );
    $hashes = [];
    foreach ($rows as $row) {
        $hash = isset($row['file_hash']) ? trim((string)$row['file_hash']) : '';
        if ($hash !== '') {
            $hashes[$hash] = true;
        }
    }
    return array_keys($hashes);
}

function normalizeAiText(string $value): string {
    $value = mb_strtolower($value);
    $normalized = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value);
    if (!is_string($normalized)) {
        $normalized = $value;
    }
    return $normalized;
}

function extractNumericIndicesFromMixed(array $values): array {
    $indices = [];
    foreach ($values as $value) {
        if (is_int($value) && $value >= 0) {
            $indices[$value] = true;
            continue;
        }
        if (is_float($value) && ((int)$value) === $value && $value >= 0) {
            $indices[(int)$value] = true;
            continue;
        }
        if (!is_string($value)) {
            continue;
        }
        $matched = preg_match_all('/\d+/', $value, $found);
        if ($matched !== false && $matched > 0) {
            foreach ($found[0] as $match) {
                $parsed = (int)$match;
                if ($parsed >= 0) {
                    $indices[$parsed] = true;
                }
            }
        }
    }
    $result = array_map('intval', array_keys($indices));
    sort($result);
    return $result;
}

function pickRelevantIndicesForTitle(string $title, array $items, int $maxItems = 6): array {
    if (count($items) === 0) {
        return [];
    }
    $tokens = preg_split('/[^a-z0-9]+/', normalizeAiText($title)) ?: [];
    $tokens = array_values(array_filter($tokens, static function ($token): bool {
        return is_string($token)
            && mb_strlen($token) >= 4
            && !in_array($token, ['modulo', 'fundamentos', 'tema', 'bloque', 'unidad'], true);
    }));
    $scored = [];
    foreach ($items as $index => $item) {
        $itemTitle = isset($item['title']) ? (string)$item['title'] : '';
        $itemContent = isset($item['content']) ? (string)$item['content'] : '';
        $source = normalizeAiText($itemTitle . ' ' . $itemContent);
        $score = 0;
        foreach ($tokens as $token) {
            if (str_contains($source, $token)) {
                $score += 1;
            }
        }
        $scored[] = ['index' => (int)$index, 'score' => $score];
    }
    usort($scored, static function (array $a, array $b): int {
        return $b['score'] <=> $a['score'];
    });
    $best = [];
    foreach ($scored as $entry) {
        if (($entry['score'] ?? 0) <= 0) {
            continue;
        }
        $best[] = (int)$entry['index'];
        if (count($best) >= $maxItems) {
            break;
        }
    }
    if (count($best) > 0) {
        return $best;
    }
    $fallback = [];
    $limit = min($maxItems, count($items));
    for ($i = 0; $i < $limit; $i++) {
        $fallback[] = $i;
    }
    return $fallback;
}

function trimStructuredContentForAi(array $structuredContent, int $maxItems = 60, int $maxCharsPerItem = 2200): array {
    $result = [];
    foreach ($structuredContent as $item) {
        if (!is_array($item)) {
            continue;
        }
        $title = isset($item['title']) ? trim((string)$item['title']) : '';
        $content = isset($item['content']) ? trim((string)$item['content']) : '';
        if ($content === '') {
            continue;
        }
        if (mb_strlen($content) > $maxCharsPerItem) {
            $content = mb_substr($content, 0, $maxCharsPerItem);
        }
        $result[] = [
            'title' => $title !== '' ? $title : 'Bloque',
            'content' => $content,
        ];
        if (count($result) >= $maxItems) {
            break;
        }
    }
    return $result;
}

function extractJsonObjectFromText(string $text): ?array {
    $trimmed = trim($text);
    if ($trimmed === '') {
        return null;
    }
    $decoded = json_decode($trimmed, true);
    if (is_array($decoded)) {
        return $decoded;
    }
    $start = strpos($trimmed, '{');
    $end = strrpos($trimmed, '}');
    if ($start === false || $end === false || $end <= $start) {
        return null;
    }
    $slice = substr($trimmed, $start, ($end - $start) + 1);
    if (!is_string($slice) || $slice === '') {
        return null;
    }
    $decodedSlice = json_decode($slice, true);
    return is_array($decodedSlice) ? $decodedSlice : null;
}

function extractOpenAiTokenUsage(array $response): array {
    $usage = isset($response['usage']) && is_array($response['usage']) ? $response['usage'] : [];
    $inputTokens = 0;
    $outputTokens = 0;
    if (isset($usage['input_tokens'])) {
        $inputTokens = (int)$usage['input_tokens'];
    } elseif (isset($usage['prompt_tokens'])) {
        $inputTokens = (int)$usage['prompt_tokens'];
    }
    if (isset($usage['output_tokens'])) {
        $outputTokens = (int)$usage['output_tokens'];
    } elseif (isset($usage['completion_tokens'])) {
        $outputTokens = (int)$usage['completion_tokens'];
    }
    if ($outputTokens <= 0 && isset($usage['total_tokens'])) {
        $outputTokens = max(0, (int)$usage['total_tokens'] - $inputTokens);
    }
    return [
        'inputTokens' => max(0, $inputTokens),
        'outputTokens' => max(0, $outputTokens),
    ];
}

function trackOpenAiUsageAttempt(array $trackingContext, string $model, string $status, int $inputTokens = 0, int $outputTokens = 0, array $extraMetadata = []): void {
    $eventType = trim((string)($trackingContext['eventType'] ?? ''));
    if ($eventType === '') {
        return;
    }
    $baseMetadata = isset($trackingContext['metadata']) && is_array($trackingContext['metadata']) ? $trackingContext['metadata'] : [];
    $metadata = array_merge($baseMetadata, $extraMetadata);
    logAiUsageEvent([
        'courseId' => max(0, (int)($trackingContext['courseId'] ?? 0)),
        'moduleId' => max(0, (int)($trackingContext['moduleId'] ?? 0)),
        'eventType' => $eventType,
        'status' => $status,
        'modelId' => $model,
        'inputTokens' => max(0, $inputTokens),
        'outputTokens' => max(0, $outputTokens),
        'metadata' => $metadata,
    ]);
}

function callOpenAiJsonResponse(string $model, string $instructions, string $prompt, int $maxOutputTokens = 8192, array $trackingContext = []): array {
    $apiKey = envValue('OPENAI_API_KEY', null);
    if ($apiKey === null || trim($apiKey) === '') {
        trackOpenAiUsageAttempt($trackingContext, $model, 'failed', 0, 0, ['reason' => 'missing_api_key']);
        throw new RuntimeException('OPENAI_API_KEY no está configurada en el backend.');
    }
    $payload = [
        'model' => $model,
        'instructions' => $instructions,
        'input' => [[
            'role' => 'user',
            'content' => [
                ['type' => 'input_text', 'text' => $prompt],
            ],
        ]],
        'temperature' => 0.2,
        'max_output_tokens' => $maxOutputTokens,
    ];
    $jsonPayload = json_encode($payload, JSON_UNESCAPED_UNICODE);
    if ($jsonPayload === false) {
        throw new RuntimeException('No se pudo preparar la solicitud de IA.');
    }
    $context = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => "Content-Type: application/json\r\nAuthorization: Bearer {$apiKey}\r\n",
            'content' => $jsonPayload,
            'timeout' => 180,
            'ignore_errors' => true,
        ],
    ]);
    $raw = @file_get_contents('https://api.openai.com/v1/responses', false, $context);
    if ($raw === false) {
        $error = error_get_last();
        $message = is_array($error) && isset($error['message']) ? (string)$error['message'] : '';
        trackOpenAiUsageAttempt($trackingContext, $model, 'failed', 0, 0, ['reason' => 'request_failed', 'message' => $message]);
        throw new RuntimeException('No se pudo completar la solicitud con IA.' . ($message !== '' ? ' ' . $message : ''));
    }
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        trackOpenAiUsageAttempt($trackingContext, $model, 'failed', 0, 0, ['reason' => 'invalid_response']);
        throw new RuntimeException('La IA devolvió una respuesta inválida.');
    }
    $tokenUsage = extractOpenAiTokenUsage($decoded);
    $errorMessage = isset($decoded['error']['message']) ? trim((string)$decoded['error']['message']) : '';
    if ($errorMessage !== '') {
        trackOpenAiUsageAttempt(
            $trackingContext,
            $model,
            'failed',
            $tokenUsage['inputTokens'],
            $tokenUsage['outputTokens'],
            ['reason' => 'openai_error', 'message' => $errorMessage]
        );
        throw new RuntimeException('OpenAI devolvió un error: ' . $errorMessage);
    }
    $outputText = isset($decoded['output_text']) ? trim((string)$decoded['output_text']) : '';
    if ($outputText === '') {
        $output = isset($decoded['output']) && is_array($decoded['output']) ? $decoded['output'] : [];
        $segments = [];
        foreach ($output as $item) {
            if (!is_array($item)) {
                continue;
            }
            $parts = isset($item['content']) && is_array($item['content']) ? $item['content'] : [];
            foreach ($parts as $part) {
                if (!is_array($part)) {
                    continue;
                }
                $textValue = '';
                if (isset($part['type']) && $part['type'] === 'output_text') {
                    $textValue = trim((string)($part['text'] ?? ''));
                } elseif (isset($part['text']) && is_string($part['text'])) {
                    $textValue = trim($part['text']);
                }
                if ($textValue !== '') {
                    $segments[] = $textValue;
                }
            }
        }
        $outputText = trim(implode("\n\n", $segments));
    }
    $parsed = extractJsonObjectFromText($outputText);
    if (!is_array($parsed)) {
        trackOpenAiUsageAttempt(
            $trackingContext,
            $model,
            'failed',
            $tokenUsage['inputTokens'],
            $tokenUsage['outputTokens'],
            ['reason' => 'invalid_json_output']
        );
        throw new RuntimeException('La IA no devolvió JSON válido.');
    }
    trackOpenAiUsageAttempt($trackingContext, $model, 'success', $tokenUsage['inputTokens'], $tokenUsage['outputTokens']);
    return $parsed;
}

function trimQuestionnaireContent(string $content, int $maxChars): string {
    $normalized = trim(preg_replace("/\r\n?/", "\n", $content) ?? $content);
    if (mb_strlen($normalized) <= $maxChars) {
        return $normalized;
    }
    return trim(mb_substr($normalized, 0, $maxChars));
}

function normalizeGeneratedQuestionnaire(array $aiResult): array {
    $rawQuestions = isset($aiResult['questionnaire']) && is_array($aiResult['questionnaire']) ? $aiResult['questionnaire'] : [];
    $questions = [];
    foreach ($rawQuestions as $item) {
        if (!is_array($item)) {
            continue;
        }
        $text = isset($item['text']) ? trim((string)$item['text']) : '';
        $options = isset($item['options']) && is_array($item['options']) ? $item['options'] : [];
        $correct = isset($item['correctOptionIndex']) ? (int)$item['correctOptionIndex'] : -1;
        if ($text === '' || count($options) !== 4 || $correct < 0 || $correct > 3) {
            continue;
        }
        $normalizedOptions = [];
        foreach ($options as $opt) {
            $optionText = trim((string)$opt);
            if ($optionText === '') {
                $normalizedOptions = [];
                break;
            }
            $normalizedOptions[] = $optionText;
        }
        if (count($normalizedOptions) !== 4) {
            continue;
        }
        $questions[] = [
            'text' => $text,
            'options' => $normalizedOptions,
            'correctOptionIndex' => $correct,
        ];
    }
    return $questions;
}

function fallbackQuestionnaireFromContent(string $content, int $numQuestions, string $difficulty): array {
    $clean = trimQuestionnaireContent($content, 6000);
    $lines = preg_split("/[\n\.!\?]+/u", $clean) ?: [];
    $topics = [];
    foreach ($lines as $line) {
        $value = trim(preg_replace('/\s+/', ' ', (string)$line) ?? (string)$line);
        if ($value === '' || mb_strlen($value) < 20) {
            continue;
        }
        if (mb_strlen($value) > 140) {
            $value = trim(mb_substr($value, 0, 140)) . '…';
        }
        $topics[] = $value;
        if (count($topics) >= max($numQuestions * 2, 12)) {
            break;
        }
    }
    if (count($topics) === 0) {
        $topics = ['conceptos fundamentales del módulo'];
    }
    $difficultyLabel = $difficulty === 'high'
        ? 'de análisis avanzado'
        : ($difficulty === 'low' ? 'básica' : 'aplicada');
    $questions = [];
    for ($i = 0; $i < $numQuestions; $i += 1) {
        $topic = $topics[$i % count($topics)];
        $questions[] = [
            'text' => 'Según el contenido, ¿cuál es la afirmación correcta ' . $difficultyLabel . ' sobre "' . $topic . '"?',
            'options' => [
                $topic,
                'El contenido indica que no tiene relevancia para el módulo.',
                'El contenido afirma lo contrario de forma explícita.',
                'No aparece ninguna relación con este tema en el material.',
            ],
            'correctOptionIndex' => 0,
        ];
    }
    return $questions;
}

function generateQuestionnaireRobustly(string $model, string $instructions, string $basePrompt, string $content, int $numQuestions, string $difficulty, array $trackingContext = []): array {
    $contentVariants = [
        trimQuestionnaireContent($content, 16000),
        trimQuestionnaireContent($content, 10000),
        trimQuestionnaireContent($content, 7000),
        trimQuestionnaireContent($content, 4000),
    ];
    $contentVariants = array_values(array_unique(array_filter($contentVariants, static fn(string $value): bool => $value !== '')));
    $lastError = null;
    $attemptNumber = 0;
    foreach ($contentVariants as $variant) {
        $attemptNumber += 1;
        try {
            $attemptContext = $trackingContext;
            $attemptMetadata = isset($attemptContext['metadata']) && is_array($attemptContext['metadata']) ? $attemptContext['metadata'] : [];
            $attemptMetadata['attempt'] = $attemptNumber;
            $attemptMetadata['contentLength'] = mb_strlen($variant);
            $attemptContext['metadata'] = $attemptMetadata;
            $aiResult = callOpenAiJsonResponse(
                $model,
                $instructions,
                $basePrompt . "\nContenido base:\n" . $variant,
                4500,
                $attemptContext
            );
            $questions = normalizeGeneratedQuestionnaire($aiResult);
            if (count($questions) > 0) {
                return array_slice($questions, 0, $numQuestions);
            }
        } catch (Throwable $error) {
            $lastError = $error;
        }
    }
    if ($lastError instanceof Throwable) {
        error_log('Questionnaire fallback activado: ' . $lastError->getMessage());
    }
    return fallbackQuestionnaireFromContent($content, $numQuestions, $difficulty);
}

function fetchAiSettingsForGeneration(): array {
    $rows = many('SELECT `key`, `value` FROM app_settings WHERE `key` IN ("aiModel", "adminSyllabusPrompt")');
    $settings = [];
    foreach ($rows as $row) {
        $key = isset($row['key']) ? (string)$row['key'] : '';
        $value = isset($row['value']) ? (string)$row['value'] : '';
        if ($key !== '') {
            $settings[$key] = $value;
        }
    }
    return [
        'aiModel' => isset($settings['aiModel']) && trim($settings['aiModel']) !== '' ? trim($settings['aiModel']) : 'gpt-4o-mini',
        'adminSyllabusPrompt' => isset($settings['adminSyllabusPrompt']) && trim($settings['adminSyllabusPrompt']) !== '' ? trim($settings['adminSyllabusPrompt']) : 'Eres un diseñador instruccional experto.',
    ];
}

function normalizeCourseDifficulty($raw): string {
    $difficulty = strtolower(trim((string)$raw));
    if (in_array($difficulty, ['basic', 'intermediate', 'advanced'], true)) {
        return $difficulty;
    }
    return 'intermediate';
}

function parseIncludeFundamentals($raw): bool {
    if (is_bool($raw)) {
        return $raw;
    }
    if (is_int($raw)) {
        return $raw === 1;
    }
    $value = strtolower(trim((string)$raw));
    if ($value === '1' || $value === 'true' || $value === 'yes' || $value === 'si') {
        return true;
    }
    return false;
}

function courseDifficultyInstruction(string $difficulty): string {
    $map = [
        'basic' => 'Dificultad básica: usa lenguaje claro, fundamentos esenciales, ejemplos introductorios y progresión guiada.',
        'intermediate' => 'Dificultad intermedia: combina fundamentos con aplicación práctica, casos de uso y decisiones técnicas moderadas.',
        'advanced' => 'Dificultad avanzada: exige profundidad conceptual, análisis crítico, casos complejos y trade-offs técnicos.',
    ];
    return $map[$difficulty] ?? $map['intermediate'];
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
            $settings['aiModel'] = (string)($model['id'] ?? 'gpt-4o-mini');
        }
        $defaults = [
            'adminSyllabusPrompt' => 'Eres un educador y diseñador de planes de estudio experto.',
            'adminQuestionnairePrompt' => 'Eres un educador experto especializado en crear evaluaciones.',
            'enableYoutubeGeneration' => 'false',
            'minPassingScore' => '70',
            'scoreCalculationMethod' => 'last_attempt',
            'notifGlobalCourseEnrollment' => 'true',
            'notifGlobalCourseDueSoon' => 'true',
            'notifGlobalCourseDueExpired' => 'true',
            'notifGlobalInactivityReminder' => 'true',
            'notifGlobalCourseUpdated' => 'true',
            'notifGlobalCourseStatusChange' => 'true',
            'notifGlobalCourseDueDateChanged' => 'true',
            'notifGlobalEvaluationResult' => 'true',
            'notifGlobalModuleUnlocked' => 'true',
            'notifGlobalCourseCompleted' => 'true',
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
        jsonResponse(200, ['data' => ['isApiKeySet' => envValue('OPENAI_API_KEY') !== null]]);
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
        $courseId = max(0, (int)($payload['courseId'] ?? 0));
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
        $settings = fetchAiSettingsForGeneration();
        $targetModules = max(0, (int)($payload['numModules'] ?? 0));
        $difficulty = normalizeCourseDifficulty($payload['difficulty'] ?? 'intermediate');
        $includeFundamentals = parseIncludeFundamentals($payload['includeFundamentals'] ?? false);
        $trimmedStructuredContent = trimStructuredContentForAi($structuredContent);
        $expectedTotalModules = $targetModules > 0
            ? ($includeFundamentals ? $targetModules + 1 : $targetModules)
            : 0;
        $moduleHint = $targetModules > 0
            ? (
                $includeFundamentals
                    ? 'Genera exactamente ' . $expectedTotalModules . ' títulos en total y el primero debe ser "Fundamentos".'
                    : 'Genera exactamente ' . $expectedTotalModules . ' títulos temáticos sin incluir un módulo de "Fundamentos".'
            )
            : (
                $includeFundamentals
                    ? 'Define un número pedagógicamente óptimo de módulos y coloca "Fundamentos" como primer módulo.'
                    : 'Define un número pedagógicamente óptimo de módulos temáticos sin incluir un módulo de "Fundamentos".'
            );
        $instructions =
            $settings['adminSyllabusPrompt'] . "\n" .
            courseDifficultyInstruction($difficulty) . "\n" .
            'Devuelve exclusivamente JSON válido con la forma {"moduleTitles": [...], "classificationMap": {...}}. ' .
            'Los títulos deben ser semánticos y específicos, sin nombres genéricos. ' .
            'classificationMap debe mapear cada título a índices enteros del arreglo structuredContent. ' .
            'Evita que todos los módulos usen exactamente los mismos índices.';
        $prompt =
            $moduleHint . "\n" .
            "structuredContent:\n" .
            json_encode($trimmedStructuredContent, JSON_UNESCAPED_UNICODE);
        $aiResult = callOpenAiJsonResponse(
            (string)$settings['aiModel'],
            $instructions,
            $prompt,
            8192,
            [
                'eventType' => 'syllabus_index_generation',
                'courseId' => $courseId,
                'metadata' => [
                    'sourceFileCount' => count($sourceFileIds),
                    'pdfDataUriCount' => count($pdfDataUris),
                    'targetModules' => $targetModules,
                    'includeFundamentals' => $includeFundamentals,
                ],
            ]
        );
        $rawTitles = isset($aiResult['moduleTitles']) && is_array($aiResult['moduleTitles']) ? $aiResult['moduleTitles'] : [];
        $moduleTitles = [];
        foreach ($rawTitles as $title) {
            $cleanTitle = trim((string)$title);
            if ($cleanTitle === '') {
                continue;
            }
            $moduleTitles[$cleanTitle] = true;
        }
        $moduleTitles = array_values(array_keys($moduleTitles));
        if (count($moduleTitles) === 0) {
            $moduleTitles = $includeFundamentals ? ['Fundamentos'] : ['Módulo Temático 1'];
        }
        if ($includeFundamentals) {
            if (strcasecmp((string)$moduleTitles[0], 'Fundamentos') !== 0) {
                array_unshift($moduleTitles, 'Fundamentos');
                $moduleTitles = array_values(array_unique($moduleTitles));
            }
        } else {
            $moduleTitles = array_values(array_filter($moduleTitles, static function ($title): bool {
                return strcasecmp((string)$title, 'Fundamentos') !== 0;
            }));
            if (count($moduleTitles) === 0) {
                $moduleTitles = ['Módulo Temático 1'];
            }
        }
        if ($targetModules > 0) {
            $expected = $expectedTotalModules;
            if (count($moduleTitles) > $expected) {
                $moduleTitles = array_slice($moduleTitles, 0, $expected);
            }
            $fill = $includeFundamentals ? 2 : 1;
            while (count($moduleTitles) < $expected) {
                $candidate = 'Módulo Temático ' . $fill;
                if (!in_array($candidate, $moduleTitles, true)) {
                    $moduleTitles[] = $candidate;
                }
                $fill += 1;
            }
        }
        $rawMap = isset($aiResult['classificationMap']) && is_array($aiResult['classificationMap']) ? $aiResult['classificationMap'] : [];
        $used = [];
        foreach ($moduleTitles as $title) {
            $rawIndices = [];
            if (isset($rawMap[$title]) && is_array($rawMap[$title])) {
                $rawIndices = $rawMap[$title];
            }
            $parsed = extractNumericIndicesFromMixed($rawIndices);
            $valid = [];
            foreach ($parsed as $index) {
                if ($index >= 0 && $index < count($structuredContent)) {
                    $valid[] = $index;
                }
            }
            if (count($valid) === 0) {
                $valid = pickRelevantIndicesForTitle($title, $structuredContent, 6);
            }
            $nonUsed = array_values(array_filter($valid, static function ($index) use ($used): bool {
                return !isset($used[$index]);
            }));
            $final = count($nonUsed) > 0 ? $nonUsed : $valid;
            if (count($final) === 0) {
                $final = [0];
            }
            foreach ($final as $idx) {
                $used[$idx] = true;
            }
            $classificationMap[$title] = array_map(static fn($value): string => (string)$value, $final);
        }
        jsonResponse(200, ['data' => [
            'moduleTitles' => $moduleTitles,
            'structuredContent' => $structuredContent,
            'classificationMap' => $classificationMap,
            'pdfHashes' => array_values(array_unique(array_merge(sourceFileHashesFromIds($sourceFileIds), pdfHashesFromDataUris($pdfDataUris)))),
            'promptSource' => 'admin',
        ]]);
    }

    if ($method === 'POST' && $path === '/api/syllabus/module') {
        $payload = parseBody();
        $courseId = max(0, (int)($payload['courseId'] ?? 0));
        $moduleTitle = trim((string)($payload['moduleTitle'] ?? ''));
        if ($moduleTitle === '') {
            jsonResponse(400, ['error' => 'moduleTitle is required.']);
        }
        $structuredContent = isset($payload['structuredContent']) && is_array($payload['structuredContent']) ? $payload['structuredContent'] : [];
        $classificationMap = isset($payload['classificationMap']) && is_array($payload['classificationMap']) ? $payload['classificationMap'] : [];
        $mappedRaw = isset($classificationMap[$moduleTitle]) && is_array($classificationMap[$moduleTitle]) ? $classificationMap[$moduleTitle] : [];
        $mappedIndices = extractNumericIndicesFromMixed($mappedRaw);
        $selected = [];
        foreach ($mappedIndices as $index) {
            if ($index >= 0 && $index < count($structuredContent) && is_array($structuredContent[$index])) {
                $selected[] = $structuredContent[$index];
            }
        }
        if (count($selected) === 0) {
            $fallbackIndices = pickRelevantIndicesForTitle($moduleTitle, $structuredContent, 8);
            foreach ($fallbackIndices as $index) {
                if ($index >= 0 && $index < count($structuredContent) && is_array($structuredContent[$index])) {
                    $selected[] = $structuredContent[$index];
                }
            }
        }
        $selected = trimStructuredContentForAi($selected, 10, 2600);
        if (count($selected) === 0) {
            jsonResponse(400, ['error' => 'No hay contenido suficiente para generar el módulo.']);
        }
        $settings = fetchAiSettingsForGeneration();
        $difficulty = normalizeCourseDifficulty($payload['difficulty'] ?? 'intermediate');
        $instructions =
            'Eres un experto diseñador instruccional. Genera el contenido del módulo solicitado en español, usando el material fuente solo como base de análisis. ' .
            'Sintetiza, estructura y redacta de forma original. Evita copiar texto literal del contenido fuente. ' .
            courseDifficultyInstruction($difficulty) . ' ' .
            'Devuelve exclusivamente JSON válido con la forma {"introduction":"...","syllabus":[{"title":"...","content":"..."}]}.';
        $prompt =
            "Título del módulo: {$moduleTitle}\n\n" .
            "Nivel de dificultad del curso: {$difficulty}\n\n" .
            "Contenido fuente clasificado:\n" .
            json_encode($selected, JSON_UNESCAPED_UNICODE);
        $aiResult = callOpenAiJsonResponse(
            (string)$settings['aiModel'],
            $instructions,
            $prompt,
            5000,
            [
                'eventType' => 'syllabus_module_generation',
                'courseId' => $courseId,
                'metadata' => [
                    'moduleTitle' => $moduleTitle,
                    'selectedChunks' => count($selected),
                    'difficulty' => $difficulty,
                ],
            ]
        );
        $intro = isset($aiResult['introduction']) ? trim((string)$aiResult['introduction']) : '';
        $rawSyllabus = isset($aiResult['syllabus']) && is_array($aiResult['syllabus']) ? $aiResult['syllabus'] : [];
        $syllabus = [];
        foreach ($rawSyllabus as $item) {
            if (!is_array($item)) {
                continue;
            }
            $title = isset($item['title']) ? trim((string)$item['title']) : '';
            $content = isset($item['content']) ? trim((string)$item['content']) : '';
            if ($title === '' || $content === '') {
                continue;
            }
            $syllabus[] = ['title' => $title, 'content' => $content];
        }
        if ($intro === '' || count($syllabus) === 0) {
            jsonResponse(400, ['error' => 'No se pudo generar el temario del módulo.']);
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
        $courseId = max(0, (int)($payload['courseId'] ?? 0));
        $moduleId = max(0, (int)($payload['moduleId'] ?? 0));
        $content = trim((string)($payload['content'] ?? ''));
        if ($content === '') {
            jsonResponse(400, ['error' => 'content is required.']);
        }
        $numQuestions = max(1, (int)($payload['numQuestions'] ?? 10));
        $difficultyRaw = trim((string)($payload['difficulty'] ?? 'medium'));
        $difficulty = in_array($difficultyRaw, ['low', 'medium', 'high'], true) ? $difficultyRaw : 'medium';
        $difficultyPrompt = [
            'low' => 'Genera preguntas de dificultad baja, centradas en definiciones, identificación de conceptos y comprensión básica.',
            'medium' => 'Genera preguntas de dificultad media, enfocadas en aplicación de conceptos y relaciones entre ideas.',
            'high' => 'Genera preguntas de dificultad alta, orientadas a análisis crítico, inferencia y resolución de casos.',
        ];
        $settings = fetchAiSettingsForGeneration();
        $instructions =
            'Eres un evaluador pedagógico estricto. Genera cuestionarios de opción múltiple en español. ' .
            'Cada pregunta debe tener exactamente 4 opciones y una única respuesta correcta. ' .
            $difficultyPrompt[$difficulty] . ' ' .
            'Devuelve exclusivamente JSON válido con la forma {"questionnaire":[{"text":"...","options":["...","...","...","..."],"correctOptionIndex":0}]}.';
        $prompt =
            "Genera {$numQuestions} preguntas de opción múltiple.\n" .
            "Nivel de dificultad: {$difficulty}.";
        $questions = generateQuestionnaireRobustly(
            (string)$settings['aiModel'],
            $instructions,
            $prompt,
            $content,
            $numQuestions,
            $difficulty,
            [
                'eventType' => 'questionnaire_generation',
                'courseId' => $courseId,
                'moduleId' => $moduleId,
                'metadata' => [
                    'requestedQuestions' => $numQuestions,
                    'difficulty' => $difficulty,
                ],
            ]
        );
        if (count($questions) === 0) {
            jsonResponse(400, ['error' => 'No se pudo generar el cuestionario.']);
        }
        jsonResponse(200, ['data' => ['questionnaire' => $questions]]);
    }
}
