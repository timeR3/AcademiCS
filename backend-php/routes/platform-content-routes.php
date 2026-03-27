<?php
declare(strict_types=1);

function contentAiModelId(): string {
    $row = one('SELECT `value` FROM app_settings WHERE `key` = "aiModel" LIMIT 1');
    $value = is_array($row) && isset($row['value']) ? trim((string)$row['value']) : '';
    return $value !== '' ? $value : 'gpt-4o-mini';
}

function extractOpenAiTextFromResponse(array $response): string {
    $outputText = isset($response['output_text']) ? trim((string)$response['output_text']) : '';
    if ($outputText !== '') {
        return $outputText;
    }
    $output = isset($response['output']) && is_array($response['output']) ? $response['output'] : [];
    $segments = [];
    foreach ($output as $item) {
        if (!is_array($item)) {
            continue;
        }
        $contents = isset($item['content']) && is_array($item['content']) ? $item['content'] : [];
        foreach ($contents as $contentPart) {
            if (!is_array($contentPart)) {
                continue;
            }
            $text = '';
            if (isset($contentPart['type']) && $contentPart['type'] === 'output_text') {
                $text = trim((string)($contentPart['text'] ?? ''));
            } elseif (isset($contentPart['text']) && is_string($contentPart['text'])) {
                $text = trim($contentPart['text']);
            }
            if ($text !== '') {
                $segments[] = $text;
            }
        }
    }
    if (count($segments) > 0) {
        return trim(implode("\n\n", $segments));
    }
    $choices = isset($response['choices']) && is_array($response['choices']) ? $response['choices'] : [];
    if (count($choices) > 0) {
        $messageContent = $choices[0]['message']['content'] ?? '';
        if (is_string($messageContent) && trim($messageContent) !== '') {
            return trim($messageContent);
        }
    }
    return '';
}

function extractOpenAiUsageMetadata(array $response): array {
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

function transcribePdfFromBase64(string $base64Content): array {
    $apiKey = envValue('OPENAI_API_KEY', null);
    if ($apiKey === null || trim($apiKey) === '') {
        throw new RuntimeException('OPENAI_API_KEY no está configurada en el backend.');
    }
    $model = contentAiModelId();
    $url = 'https://api.openai.com/v1/responses';
    $payload = [
        'model' => $model,
        'input' => [[
            'role' => 'user',
            'content' => [
                ['type' => 'input_text', 'text' => 'Extrae el texto completo del PDF. Devuelve solo texto plano, sin explicaciones ni markdown.'],
                ['type' => 'input_file', 'filename' => 'document.pdf', 'file_data' => 'data:application/pdf;base64,' . $base64Content],
            ],
        ]],
        'temperature' => 0,
        'max_output_tokens' => 8192,
    ];
    $jsonPayload = json_encode($payload, JSON_UNESCAPED_UNICODE);
    if ($jsonPayload === false) {
        throw new RuntimeException('No se pudo preparar la solicitud de transcripción.');
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
    $raw = @file_get_contents($url, false, $context);
    if ($raw === false) {
        $error = error_get_last();
        $message = is_array($error) && isset($error['message']) ? (string)$error['message'] : '';
        throw new RuntimeException('No se pudo transcribir el archivo con OpenAI.' . ($message !== '' ? ' ' . $message : ''));
    }
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        throw new RuntimeException('La IA devolvió una respuesta inválida al transcribir.');
    }
    $errorMessage = isset($decoded['error']['message']) ? trim((string)$decoded['error']['message']) : '';
    if ($errorMessage !== '') {
        throw new RuntimeException('OpenAI devolvió un error: ' . $errorMessage);
    }
    $text = extractOpenAiTextFromResponse($decoded);
    if ($text === '') {
        throw new RuntimeException('La IA no devolvió contenido de transcripción.');
    }
    $usage = extractOpenAiUsageMetadata($decoded);
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

function sharedFilesProcessedChunkColumn(): string {
    static $column = null;
    if (is_string($column)) {
        return $column;
    }
    $column = '';
    $rows = many('SHOW COLUMNS FROM shared_files');
    foreach ($rows as $row) {
        $name = trim((string)($row['Field'] ?? ''));
        if ($name === 'processed_chunk' || $name === 'processed_chunks') {
            $column = $name;
            break;
        }
    }
    return $column;
}

function fileTranscriptsHasFileName(): bool {
    static $hasColumn = null;
    if (is_bool($hasColumn)) {
        return $hasColumn;
    }
    $hasColumn = false;
    $rows = many('SHOW COLUMNS FROM file_transcripts');
    foreach ($rows as $row) {
        $name = trim((string)($row['Field'] ?? ''));
        if ($name === 'file_name') {
            $hasColumn = true;
            break;
        }
    }
    return $hasColumn;
}

function normalizeChunkTitleLine(string $line): string {
    $line = trim(preg_replace('/\s+/', ' ', $line) ?? $line);
    if ($line === '') {
        return '';
    }
    $line = preg_replace('/^[\d\.\-\)\s]+/u', '', $line) ?? $line;
    $line = trim($line, "-–—•:;,. \t\n\r\0\x0B");
    if ($line === '') {
        return '';
    }
    if (mb_strlen($line) > 90) {
        $line = trim(mb_substr($line, 0, 90)) . '…';
    }
    return $line;
}

function buildChunkTitle(string $content, int $index, string $fileName): string {
    $lines = preg_split("/\n+/", trim($content)) ?: [];
    foreach ($lines as $line) {
        $title = normalizeChunkTitleLine((string)$line);
        if ($title !== '') {
            return $title;
        }
    }
    $baseFileName = trim(pathinfo($fileName, PATHINFO_FILENAME));
    if ($baseFileName !== '') {
        return $baseFileName . ' - Sección ' . ($index + 1);
    }
    return 'Sección ' . ($index + 1);
}

function buildStructuredTranscript(array $chunks, string $fileName): array {
    $structured = [];
    foreach ($chunks as $index => $chunk) {
        $content = trim((string)$chunk);
        if ($content === '') {
            continue;
        }
        $structured[] = [
            'title' => buildChunkTitle($content, $index, $fileName),
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

function persistTranscriptForHash(int $sharedFileId, string $fileHash, string $base64Content, string $fileName): array {
    try {
        $transcription = transcribePdfFromBase64($base64Content);
    } catch (Throwable $error) {
        throw new RuntimeException('Paso 4/6: transcribiendo el archivo. ' . trim((string)$error->getMessage()), 0, $error);
    }
    $transcript = trim((string)($transcription['text'] ?? ''));
    $inputTokens = max(0, (int)($transcription['inputTokens'] ?? 0));
    $outputTokens = max(0, (int)($transcription['outputTokens'] ?? 0));
    $chunks = splitTranscriptIntoChunks($transcript);
    if (count($chunks) === 0) {
        throw new RuntimeException('Paso 5/6: separando el contenido. La transcripción está vacía.');
    }
    $inputDistribution = distributeTokensByChunk($chunks, $inputTokens);
    $outputDistribution = distributeTokensByChunk($chunks, $outputTokens);
    $structured = buildStructuredTranscript($chunks, $fileName);
    $structuredJson = json_encode($structured, JSON_UNESCAPED_UNICODE);
    if ($structuredJson === false) {
        throw new RuntimeException('Paso 5/6: separando el contenido. No se pudo estructurar la transcripción.');
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
        if (fileTranscriptsHasFileName()) {
            execSql(
                'INSERT INTO file_transcripts (file_hash, file_name, structured_content, input_tokens, output_tokens, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
                [$fileHash, $fileName, $structuredJson, $inputTokens, $outputTokens]
            );
        } else {
            execSql(
                'INSERT INTO file_transcripts (file_hash, structured_content, input_tokens, output_tokens, created_at) VALUES (?, ?, ?, ?, NOW())',
                [$fileHash, $structuredJson, $inputTokens, $outputTokens]
            );
        }
        $processedColumn = sharedFilesProcessedChunkColumn();
        if ($processedColumn !== '') {
            execSql(
                "UPDATE shared_files SET status = 'completed', total_chunks = ?, {$processedColumn} = ? WHERE id = ?",
                [count($chunks), count($chunks), $sharedFileId]
            );
        } else {
            execSql(
                'UPDATE shared_files SET status = "completed", total_chunks = ? WHERE id = ?',
                [count($chunks), $sharedFileId]
            );
        }
        $pdo->commit();
        return [
            'inputTokens' => $inputTokens,
            'outputTokens' => $outputTokens,
            'chunks' => count($chunks),
        ];
    } catch (Throwable $error) {
        $pdo->rollBack();
        throw new RuntimeException('Paso 6/6: guardando contenido del curso. ' . trim((string)$error->getMessage()), 0, $error);
    }
}

function handlePlatformContentRoutes(string $method, string $path): void {
    if ($method === 'POST' && $path === '/api/files/cache') {
        $stage = 'Paso 1/6: preparando el archivo';
        $courseId = 0;
        $requestedFileName = '';
        $fileUploadFailureLogged = false;
        try {
            $payload = parseBody();
            $courseId = max(0, (int)($payload['courseId'] ?? 0));
            $dataUri = (string)($payload['dataUri'] ?? '');
            if ($dataUri === '') {
                jsonResponse(400, ['error' => 'No recibimos el archivo para procesar.']);
            }
            $commaPos = strpos($dataUri, ',');
            if ($commaPos === false) {
                jsonResponse(400, ['error' => 'Formato de archivo inválido.']);
            }
            $stage = 'Paso 2/6: leyendo el PDF';
            $base64Content = substr($dataUri, $commaPos + 1);
            $fileBuffer = parseDataUri($dataUri);
            $stage = 'Paso 3/6: revisando si ya existe en tu biblioteca';
            $fileHash = hash('sha256', $fileBuffer);
            $requestedFileName = trim((string)($payload['fileName'] ?? ''));
            if ($requestedFileName === '') {
                $requestedFileName = 'source-' . substr($fileHash, 0, 8) . '.pdf';
            }
            $existing = one('SELECT id, file_name FROM shared_files WHERE file_hash = ? LIMIT 1', [$fileHash]);
            if ($existing) {
                $sharedFileId = (int)$existing['id'];
                $storedFileName = trim((string)($existing['file_name'] ?? ''));
                $effectiveFileName = $storedFileName !== '' ? $storedFileName : $requestedFileName;
                if ($storedFileName === '' && $requestedFileName !== '') {
                    execSql('UPDATE shared_files SET file_name = ? WHERE id = ?', [$requestedFileName, $sharedFileId]);
                    $effectiveFileName = $requestedFileName;
                }
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
                        $stage = 'Paso 4/6: transcribiendo el archivo';
                        $usage = persistTranscriptForHash($sharedFileId, $fileHash, $base64Content, $effectiveFileName);
                        logAiUsageEvent([
                            'courseId' => $courseId,
                            'eventType' => 'file_upload',
                            'status' => 'success',
                            'modelId' => contentAiModelId(),
                            'inputTokens' => (int)($usage['inputTokens'] ?? 0),
                            'outputTokens' => (int)($usage['outputTokens'] ?? 0),
                            'metadata' => [
                                'fileHash' => $fileHash,
                                'fileName' => $effectiveFileName,
                                'sharedFileId' => $sharedFileId,
                                'chunks' => (int)($usage['chunks'] ?? 0),
                                'cachedFile' => true,
                                'reprocessed' => true,
                            ],
                        ]);
                    } catch (Throwable $error) {
                        execSql('UPDATE shared_files SET status = "failed" WHERE id = ?', [$sharedFileId]);
                        logAiUsageEvent([
                            'courseId' => $courseId,
                            'eventType' => 'file_upload',
                            'status' => 'failed',
                            'modelId' => contentAiModelId(),
                            'metadata' => [
                                'fileHash' => $fileHash,
                                'fileName' => $effectiveFileName,
                                'sharedFileId' => $sharedFileId,
                                'cachedFile' => true,
                                'reprocessed' => true,
                                'error' => trim((string)$error->getMessage()),
                            ],
                        ]);
                        $fileUploadFailureLogged = true;
                        throw $error;
                    }
                    jsonResponse(200, ['data' => ['hash' => $fileHash, 'status' => 'transcribed', 'stage' => 'Paso 6/6: guardando contenido del curso']]);
                }
                logAiUsageEvent([
                    'courseId' => $courseId,
                    'eventType' => 'file_upload',
                    'status' => 'success',
                    'metadata' => [
                        'fileHash' => $fileHash,
                        'fileName' => $effectiveFileName,
                        'sharedFileId' => $sharedFileId,
                        'cachedFile' => true,
                        'reprocessed' => false,
                    ],
                ]);
                jsonResponse(200, ['data' => ['hash' => $fileHash, 'status' => 'cached', 'stage' => 'Completado: ya lo tenías procesado']]);
            }
            execSql(
                'INSERT INTO shared_files (file_name, file_content, file_hash, status, total_chunks) VALUES (?, ?, ?, "processing", 0)',
                [$requestedFileName, $fileBuffer, $fileHash]
            );
            $sharedFileId = (int)db()->lastInsertId();
            try {
                $stage = 'Paso 4/6: transcribiendo el archivo';
                $usage = persistTranscriptForHash($sharedFileId, $fileHash, $base64Content, $requestedFileName);
                logAiUsageEvent([
                    'courseId' => $courseId,
                    'eventType' => 'file_upload',
                    'status' => 'success',
                    'modelId' => contentAiModelId(),
                    'inputTokens' => (int)($usage['inputTokens'] ?? 0),
                    'outputTokens' => (int)($usage['outputTokens'] ?? 0),
                    'metadata' => [
                        'fileHash' => $fileHash,
                        'fileName' => $requestedFileName,
                        'sharedFileId' => $sharedFileId,
                        'chunks' => (int)($usage['chunks'] ?? 0),
                        'cachedFile' => false,
                        'reprocessed' => false,
                    ],
                ]);
            } catch (Throwable $error) {
                execSql('UPDATE shared_files SET status = "failed" WHERE id = ?', [$sharedFileId]);
                logAiUsageEvent([
                    'courseId' => $courseId,
                    'eventType' => 'file_upload',
                    'status' => 'failed',
                    'modelId' => contentAiModelId(),
                    'metadata' => [
                        'fileHash' => $fileHash,
                        'fileName' => $requestedFileName,
                        'sharedFileId' => $sharedFileId,
                        'cachedFile' => false,
                        'reprocessed' => false,
                        'error' => trim((string)$error->getMessage()),
                    ],
                ]);
                $fileUploadFailureLogged = true;
                throw $error;
            }
            jsonResponse(200, ['data' => ['hash' => $fileHash, 'status' => 'transcribed', 'stage' => 'Paso 6/6: guardando contenido del curso']]);
        } catch (Throwable $error) {
            $message = trim((string)$error->getMessage());
            if (!$fileUploadFailureLogged) {
                logAiUsageEvent([
                    'courseId' => $courseId,
                    'eventType' => 'file_upload',
                    'status' => 'failed',
                    'metadata' => [
                        'fileName' => $requestedFileName,
                        'stage' => $stage,
                        'error' => $message !== '' ? $message : 'Error interno durante el procesamiento.',
                    ],
                ]);
            }
            if ($message === '') {
                $message = 'Error interno durante el procesamiento.';
            }
            if (str_starts_with($message, 'Paso ')) {
                throw new RuntimeException($message, 0, $error);
            }
            throw new RuntimeException($stage . '. ' . $message, 0, $error);
        }
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
