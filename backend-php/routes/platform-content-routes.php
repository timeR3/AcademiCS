<?php
declare(strict_types=1);

function contentAiModelId(): string {
    $row = one('SELECT `value` FROM app_settings WHERE `key` = "aiModel" LIMIT 1');
    $value = is_array($row) && isset($row['value']) ? trim((string)$row['value']) : '';
    return $value !== '' ? $value : 'gemini-1.5-pro-latest';
}

function extractGeminiTextParts(array $response): string {
    $candidates = isset($response['candidates']) && is_array($response['candidates']) ? $response['candidates'] : [];
    if (count($candidates) === 0) {
        return '';
    }
    $parts = $candidates[0]['content']['parts'] ?? [];
    if (!is_array($parts)) {
        return '';
    }
    $segments = [];
    foreach ($parts as $part) {
        if (!is_array($part)) {
            continue;
        }
        $text = isset($part['text']) ? trim((string)$part['text']) : '';
        if ($text !== '') {
            $segments[] = $text;
        }
    }
    return trim(implode("\n\n", $segments));
}

function extractGeminiUsageMetadata(array $response): array {
    $usage = isset($response['usageMetadata']) && is_array($response['usageMetadata']) ? $response['usageMetadata'] : [];
    $inputTokens = isset($usage['promptTokenCount']) ? (int)$usage['promptTokenCount'] : 0;
    $outputTokens = 0;
    if (isset($usage['candidatesTokenCount'])) {
        $outputTokens = (int)$usage['candidatesTokenCount'];
    } elseif (isset($usage['outputTokenCount'])) {
        $outputTokens = (int)$usage['outputTokenCount'];
    } elseif (isset($usage['totalTokenCount'])) {
        $total = (int)$usage['totalTokenCount'];
        $outputTokens = max(0, $total - $inputTokens);
    }
    return [
        'inputTokens' => max(0, $inputTokens),
        'outputTokens' => max(0, $outputTokens),
    ];
}

function transcribePdfFromBase64(string $base64Content): array {
    $apiKey = envValue('GEMINI_API_KEY', null);
    if ($apiKey === null || trim($apiKey) === '') {
        throw new RuntimeException('GEMINI_API_KEY no está configurada en el backend.');
    }
    $model = contentAiModelId();
    $url = 'https://generativelanguage.googleapis.com/v1beta/models/' . rawurlencode($model) . ':generateContent?key=' . rawurlencode($apiKey);
    $payload = [
        'contents' => [[
            'parts' => [
                ['text' => 'Extrae el texto completo del PDF. Devuelve solo texto plano, sin explicaciones ni markdown.'],
                ['inline_data' => ['mime_type' => 'application/pdf', 'data' => $base64Content]],
            ],
        ]],
        'generationConfig' => [
            'temperature' => 0,
            'maxOutputTokens' => 8192,
        ],
    ];
    $jsonPayload = json_encode($payload, JSON_UNESCAPED_UNICODE);
    if ($jsonPayload === false) {
        throw new RuntimeException('No se pudo preparar la solicitud de transcripción.');
    }
    $context = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => "Content-Type: application/json\r\n",
            'content' => $jsonPayload,
            'timeout' => 180,
            'ignore_errors' => true,
        ],
    ]);
    $raw = @file_get_contents($url, false, $context);
    if ($raw === false) {
        $error = error_get_last();
        $message = is_array($error) && isset($error['message']) ? (string)$error['message'] : '';
        throw new RuntimeException('No se pudo transcribir el archivo con Gemini.' . ($message !== '' ? ' ' . $message : ''));
    }
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        throw new RuntimeException('La IA devolvió una respuesta inválida al transcribir.');
    }
    $text = extractGeminiTextParts($decoded);
    if ($text === '') {
        $blockReason = $decoded['promptFeedback']['blockReason'] ?? '';
        if (is_string($blockReason) && trim($blockReason) !== '') {
            throw new RuntimeException('La IA bloqueó la transcripción: ' . $blockReason);
        }
        throw new RuntimeException('La IA no devolvió contenido de transcripción.');
    }
    $usage = extractGeminiUsageMetadata($decoded);
    return [
        'text' => $text,
        'inputTokens' => $usage['inputTokens'],
        'outputTokens' => $usage['outputTokens'],
    ];
}

function splitTranscriptIntoChunks(string $text, int $maxChars = 8000): array {
    $normalized = trim(preg_replace("/\r\n?/", "\n", $text) ?? $text);
    if ($normalized === '') {
        return [];
    }
    $paragraphs = preg_split("/\n{2,}/", $normalized) ?: [$normalized];
    $chunks = [];
    $current = '';
    foreach ($paragraphs as $paragraph) {
        $paragraph = trim((string)$paragraph);
        if ($paragraph === '') {
            continue;
        }
        $candidate = $current === '' ? $paragraph : $current . "\n\n" . $paragraph;
        if (mb_strlen($candidate) <= $maxChars) {
            $current = $candidate;
            continue;
        }
        if ($current !== '') {
            $chunks[] = $current;
        }
        if (mb_strlen($paragraph) <= $maxChars) {
            $current = $paragraph;
            continue;
        }
        $length = mb_strlen($paragraph);
        $offset = 0;
        while ($offset < $length) {
            $slice = mb_substr($paragraph, $offset, $maxChars);
            if (trim($slice) !== '') {
                $chunks[] = $slice;
            }
            $offset += $maxChars;
        }
        $current = '';
    }
    if ($current !== '') {
        $chunks[] = $current;
    }
    return $chunks;
}

function buildStructuredTranscript(array $chunks): array {
    $structured = [];
    foreach ($chunks as $index => $chunk) {
        $content = trim((string)$chunk);
        if ($content === '') {
            continue;
        }
        $structured[] = [
            'title' => 'Bloque ' . ($index + 1),
            'content' => $content,
        ];
    }
    return $structured;
}

function distributeTokensByChunk(array $chunks, int $totalTokens): array {
    if (count($chunks) === 0 || $totalTokens <= 0) {
        return array_fill(0, count($chunks), 0);
    }
    $lengths = array_map(static fn($chunk): int => max(1, mb_strlen((string)$chunk)), $chunks);
    $totalLength = array_sum($lengths);
    if ($totalLength <= 0) {
        $result = array_fill(0, count($chunks), 0);
        $result[0] = $totalTokens;
        return $result;
    }
    $distribution = array_fill(0, count($chunks), 0);
    $allocated = 0;
    foreach ($lengths as $index => $length) {
        $value = (int)floor(($length / $totalLength) * $totalTokens);
        $distribution[$index] = $value;
        $allocated += $value;
    }
    $remaining = $totalTokens - $allocated;
    $idx = 0;
    while ($remaining > 0 && count($distribution) > 0) {
        $distribution[$idx] += 1;
        $remaining -= 1;
        $idx = ($idx + 1) % count($distribution);
    }
    return $distribution;
}

function persistTranscriptForHash(int $sharedFileId, string $fileHash, string $base64Content): void {
    $transcription = transcribePdfFromBase64($base64Content);
    $transcript = trim((string)($transcription['text'] ?? ''));
    $inputTokens = max(0, (int)($transcription['inputTokens'] ?? 0));
    $outputTokens = max(0, (int)($transcription['outputTokens'] ?? 0));
    $chunks = splitTranscriptIntoChunks($transcript);
    if (count($chunks) === 0) {
        throw new RuntimeException('La transcripción está vacía.');
    }
    $inputDistribution = distributeTokensByChunk($chunks, $inputTokens);
    $outputDistribution = distributeTokensByChunk($chunks, $outputTokens);
    $structured = buildStructuredTranscript($chunks);
    $structuredJson = json_encode($structured, JSON_UNESCAPED_UNICODE);
    if ($structuredJson === false) {
        throw new RuntimeException('No se pudo serializar la transcripción.');
    }
    $pdo = db();
    $pdo->beginTransaction();
    try {
        execSql('DELETE FROM file_transcript_chunks WHERE file_hash = ?', [$fileHash]);
        execSql('DELETE FROM file_transcripts WHERE file_hash = ?', [$fileHash]);
        foreach ($chunks as $index => $chunk) {
            execSql(
                'INSERT INTO file_transcript_chunks (file_hash, chunk_index, text_content, input_tokens, output_tokens) VALUES (?, ?, ?, ?, ?)',
                [$fileHash, $index, $chunk, $inputDistribution[$index] ?? 0, $outputDistribution[$index] ?? 0]
            );
        }
        execSql(
            'INSERT INTO file_transcripts (file_hash, structured_content, input_tokens, output_tokens, created_at) VALUES (?, ?, ?, ?, NOW())',
            [$fileHash, $structuredJson, $inputTokens, $outputTokens]
        );
        execSql(
            'UPDATE shared_files SET status = "completed", total_chunks = ? WHERE id = ?',
            [count($chunks), $sharedFileId]
        );
        $pdo->commit();
    } catch (Throwable $error) {
        $pdo->rollBack();
        throw $error;
    }
}

function handlePlatformContentRoutes(string $method, string $path): void {
    if ($method === 'POST' && $path === '/api/files/cache') {
        $payload = parseBody();
        $dataUri = (string)($payload['dataUri'] ?? '');
        if ($dataUri === '') {
            jsonResponse(400, ['error' => 'dataUri is required.']);
        }
        $commaPos = strpos($dataUri, ',');
        if ($commaPos === false) {
            jsonResponse(400, ['error' => 'Formato de archivo inválido.']);
        }
        $base64Content = substr($dataUri, $commaPos + 1);
        $fileBuffer = parseDataUri($dataUri);
        $fileHash = hash('sha256', $fileBuffer);
        $existing = one('SELECT id FROM shared_files WHERE file_hash = ? LIMIT 1', [$fileHash]);
        if ($existing) {
            $sharedFileId = (int)$existing['id'];
            $transcriptHealth = one(
                'SELECT
                    (SELECT COUNT(*) FROM file_transcripts WHERE file_hash = ?) AS transcript_count,
                    (SELECT COUNT(*) FROM file_transcript_chunks WHERE file_hash = ?) AS chunk_count',
                [$fileHash, $fileHash]
            );
            $transcriptCount = (int)($transcriptHealth['transcript_count'] ?? 0);
            $chunkCount = (int)($transcriptHealth['chunk_count'] ?? 0);
            if ($transcriptCount === 0 || $chunkCount === 0) {
                execSql('UPDATE shared_files SET status = "processing" WHERE id = ?', [$sharedFileId]);
                try {
                    persistTranscriptForHash($sharedFileId, $fileHash, $base64Content);
                } catch (Throwable $error) {
                    execSql('UPDATE shared_files SET status = "failed" WHERE id = ?', [$sharedFileId]);
                    throw $error;
                }
                jsonResponse(200, ['data' => ['hash' => $fileHash, 'status' => 'transcribed']]);
            }
            jsonResponse(200, ['data' => ['hash' => $fileHash, 'status' => 'cached']]);
        }
        execSql(
            'INSERT INTO shared_files (file_name, file_content, file_hash, status, total_chunks) VALUES (?, ?, ?, "processing", 0)',
            [(string)($payload['fileName'] ?? ('source-' . substr($fileHash, 0, 8) . '.pdf')), $fileBuffer, $fileHash]
        );
        $sharedFileId = (int)db()->lastInsertId();
        try {
            persistTranscriptForHash($sharedFileId, $fileHash, $base64Content);
        } catch (Throwable $error) {
            execSql('UPDATE shared_files SET status = "failed" WHERE id = ?', [$sharedFileId]);
            throw $error;
        }
        jsonResponse(200, ['data' => ['hash' => $fileHash, 'status' => 'transcribed']]);
    }

    if ($method === 'GET' && preg_match('#^/api/source-files/(\d+)$#', $path, $matches)) {
        $fileId = (int)$matches[1];
        $row = one(
            'SELECT sf.file_name, sf.file_content
             FROM shared_files sf
             JOIN course_source_files csf ON sf.id = csf.shared_file_id
             WHERE csf.id = ?',
            [$fileId]
        );
        if (!$row || !$row['file_content']) {
            jsonResponse(200, ['data' => ['dataUrl' => null, 'fileName' => null]]);
        }
        $base64 = base64_encode((string)$row['file_content']);
        jsonResponse(200, ['data' => ['dataUrl' => 'data:application/pdf;base64,' . $base64, 'fileName' => $row['file_name']]]);
    }

    if ($method === 'POST' && $path === '/api/bibliography') {
        $payload = parseBody();
        $courseId = (int)($payload['courseId'] ?? 0);
        $type = (string)($payload['type'] ?? '');
        if ($courseId <= 0 || ($type !== 'file' && $type !== 'link')) {
            jsonResponse(400, ['error' => 'courseId y type son requeridos.']);
        }
        if ($type === 'file') {
            $fileName = trim((string)($payload['fileName'] ?? ''));
            $dataUri = (string)($payload['dataUri'] ?? '');
            if ($fileName === '' || $dataUri === '') {
                jsonResponse(400, ['error' => 'Faltan datos del archivo.']);
            }
            $binary = parseDataUri($dataUri);
            execSql(
                'INSERT INTO course_bibliography (course_id, item_type, item_name, file_content) VALUES (?, "file", ?, ?)',
                [$courseId, $fileName, $binary]
            );
            jsonResponse(200, ['data' => ['bibliographyItemId' => (int)db()->lastInsertId()]]);
        }
        $url = trim((string)($payload['url'] ?? ''));
        if ($url === '') {
            jsonResponse(400, ['error' => 'La URL es requerida.']);
        }
        execSql(
            'INSERT INTO course_bibliography (course_id, item_type, item_name, url) VALUES (?, "link", ?, ?)',
            [$courseId, $url, $url]
        );
        jsonResponse(200, ['data' => ['bibliographyItemId' => (int)db()->lastInsertId()]]);
    }

    if ($method === 'GET' && preg_match('#^/api/bibliography/(\d+)$#', $path, $matches)) {
        $itemId = (int)$matches[1];
        $row = one('SELECT item_name, file_content FROM course_bibliography WHERE id = ? AND item_type = "file"', [$itemId]);
        if (!$row || !$row['file_content']) {
            jsonResponse(200, ['data' => ['dataUrl' => null, 'fileName' => null]]);
        }
        $base64 = base64_encode((string)$row['file_content']);
        jsonResponse(200, ['data' => ['dataUrl' => 'data:application/pdf;base64,' . $base64, 'fileName' => $row['item_name']]]);
    }

    if ($method === 'DELETE' && preg_match('#^/api/bibliography/(\d+)$#', $path, $matches)) {
        $itemId = (int)$matches[1];
        $affected = execSql('DELETE FROM course_bibliography WHERE id = ?', [$itemId]);
        if ($affected === 0) {
            jsonResponse(400, ['error' => 'El ítem no existe.']);
        }
        jsonResponse(200, ['data' => ['success' => true]]);
    }
}
