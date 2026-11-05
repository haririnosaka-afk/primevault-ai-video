
import { NextRequest, NextResponse } from 'next/server';
import { HOST, requireKey } from '@/lib/runninghub';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const key = requireKey();
    const incoming = await req.formData();
    const file = incoming.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'File tidak ditemukan.' },
        { status: 400 }
      );
    }

    const type = file.type;

    const isImage = type.startsWith('image/');
    const isVideo = type.startsWith('video/');
    const isAudio = type.startsWith('audio/');

    if (!isImage && !isVideo && !isAudio) {
      return NextResponse.json(
        { error: 'Format file tidak didukung.' },
        { status: 400 }
      );
    }

    const maxSize = 100 * 1024 * 1024;

    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'Ukuran file maksimal 100 MB.' },
        { status: 400 }
      );
    }

    const form = new FormData();
    form.append('apiKey', key);
    form.append('fileType', 'input');
    form.append('file', file, file.name);

    const upstream = await fetch(
      `${HOST}/task/openapi/upload`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`
        },
        body: form,
        cache: 'no-store'
      }
    );

    const json = await upstream.json();
    const fileName = json?.data?.fileName;

    if (!upstream.ok || json?.code !== 0 || !fileName) {
      return NextResponse.json(
        {
          error: json?.msg || 'RunningHub gagal mengunggah file.',
          details: json
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      fileName,
      fileType: isImage ? 'image' : isVideo ? 'video' : 'audio'
    });

  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : 'Upload error'
      },
      { status: 500 }
    );
  }
}
