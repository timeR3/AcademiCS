import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { query } from '@/lib/db';

type CacheFilePayload = {
  dataUri?: string;
  fileName?: string;
};

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as CacheFilePayload;
    if (!payload.dataUri) {
      return NextResponse.json({ error: 'dataUri is required.' }, { status: 400 });
    }

    const base64Content = payload.dataUri.substring(payload.dataUri.indexOf(',') + 1);
    const fileBuffer = Buffer.from(base64Content, 'base64');
    const fileHash = createHash('sha256').update(fileBuffer).digest('hex');

    const [existingRows]: any[] = await query('SELECT id FROM shared_files WHERE file_hash = ? LIMIT 1', [fileHash]);
    if (existingRows.length > 0) {
      return NextResponse.json({ data: { hash: fileHash, status: 'cached' } }, { status: 200 });
    }

    await query(
      'INSERT INTO shared_files (file_name, file_content, file_hash, status, total_chunks) VALUES (?, ?, ?, "completed", 0)',
      [payload.fileName || `source-${fileHash.slice(0, 8)}.pdf`, fileBuffer, fileHash]
    );

    return NextResponse.json({ data: { hash: fileHash, status: 'transcribed' } }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'No se pudo procesar el archivo.' }, { status: 400 });
  }
}
