START TRANSACTION;

UPDATE file_transcript_chunks
SET input_tokens = 0
WHERE input_tokens IS NULL;

UPDATE file_transcript_chunks
SET output_tokens = 0
WHERE output_tokens IS NULL;

UPDATE file_transcripts ft
LEFT JOIN (
    SELECT
        file_hash,
        COALESCE(SUM(input_tokens), 0) AS total_input_tokens,
        COALESCE(SUM(output_tokens), 0) AS total_output_tokens
    FROM file_transcript_chunks
    GROUP BY file_hash
) chunk_totals ON chunk_totals.file_hash = ft.file_hash
SET
    ft.input_tokens = COALESCE(ft.input_tokens, chunk_totals.total_input_tokens, 0),
    ft.output_tokens = COALESCE(ft.output_tokens, chunk_totals.total_output_tokens, 0)
WHERE ft.input_tokens IS NULL
   OR ft.output_tokens IS NULL;

UPDATE shared_files sf
LEFT JOIN (
    SELECT file_hash, COUNT(*) AS chunk_count
    FROM file_transcript_chunks
    GROUP BY file_hash
) chunk_counts ON chunk_counts.file_hash = sf.file_hash
SET sf.total_chunks = COALESCE(chunk_counts.chunk_count, 0)
WHERE sf.total_chunks IS NULL
   OR sf.total_chunks <> COALESCE(chunk_counts.chunk_count, 0);

UPDATE shared_files sf
LEFT JOIN file_transcripts ft ON ft.file_hash = sf.file_hash
LEFT JOIN (
    SELECT file_hash, COUNT(*) AS chunk_count
    FROM file_transcript_chunks
    GROUP BY file_hash
) chunk_counts ON chunk_counts.file_hash = sf.file_hash
SET sf.status = 'completed'
WHERE ft.file_hash IS NOT NULL
  AND COALESCE(chunk_counts.chunk_count, 0) > 0
  AND sf.status IN ('pending', 'processing', 'failed');

UPDATE shared_files sf
LEFT JOIN file_transcripts ft ON ft.file_hash = sf.file_hash
LEFT JOIN (
    SELECT file_hash, COUNT(*) AS chunk_count
    FROM file_transcript_chunks
    GROUP BY file_hash
) chunk_counts ON chunk_counts.file_hash = sf.file_hash
SET sf.status = 'failed'
WHERE ft.file_hash IS NULL
  AND COALESCE(chunk_counts.chunk_count, 0) = 0
  AND sf.status = 'processing';

COMMIT;

SELECT
    (SELECT COUNT(*) FROM shared_files WHERE status = 'processing') AS status_processing,
    (SELECT COUNT(*) FROM shared_files sf LEFT JOIN file_transcripts ft ON ft.file_hash = sf.file_hash WHERE ft.file_hash IS NULL) AS without_transcript,
    (SELECT COUNT(*) FROM (
        SELECT sf.id
        FROM shared_files sf
        LEFT JOIN file_transcript_chunks fc ON fc.file_hash = sf.file_hash
        GROUP BY sf.id
        HAVING COUNT(fc.chunk_index) = 0
    ) rows_without_chunks) AS without_chunks,
    (SELECT COUNT(*) FROM file_transcripts WHERE input_tokens IS NULL OR output_tokens IS NULL) AS transcripts_without_tokens,
    (SELECT COUNT(*) FROM shared_files WHERE status = 'completed' AND COALESCE(total_chunks, 0) = 0) AS completed_with_zero_chunks;
