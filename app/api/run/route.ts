
import { NextRequest, NextResponse } from 'next/server';
import {
  appId,
  getAppInputs,
  rhPost,
  requireKey
} from '@/lib/runninghub';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const model = body.model === '2.0' ? '2.0' : '2.5';
    const mode = body.mode === 'image' ? 'image' : 'text';
    const prompt = String(body.prompt || '').trim();

    if (!prompt) {
      return NextResponse.json(
        { ok: false, error: 'Prompt wajib diisi.' },
        { status: 400 }
      );
    }

    if (model === '2.5' && mode === 'text') {
      return NextResponse.json(
        {
          ok: false,
          error: 'Seedance 2.5 harus menggunakan mode multimodal.'
        },
        { status: 400 }
      );
    }

    const images = Array.isArray(body.images)
      ? body.images.filter(
          (x: unknown) => typeof x === 'string' && x.trim()
        )
      : [];

    const videoFileName =
      typeof body.videoFileName === 'string'
        ? body.videoFileName
        : '';

    const audioFileName =
      typeof body.audioFileName === 'string'
        ? body.audioFileName
        : '';

    const maxImages = model === '2.0' ? 4 : 5;

    if (images.length > maxImages) {
      return NextResponse.json(
        {
          ok: false,
          error: `Maksimal ${maxImages} gambar untuk Seedance ${model}.`
        },
        { status: 400 }
      );
    }

    if (mode === 'image' && images.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Upload minimal satu gambar.' },
        { status: 400 }
      );
    }

    if (model === '2.0' && (videoFileName || audioFileName)) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Input video dan audio tersedia pada konfigurasi Seedance 2.5.'
        },
        { status: 400 }
      );
    }

    const key = requireKey();
    const webappId = appId(model, mode);
    const inputs = await getAppInputs(webappId, key);

    const textNode = inputs.find(
      node => node.fieldName?.toLowerCase() === 'text'
    );

    if (!textNode) {
      return NextResponse.json(
        { ok: false, error: 'Input prompt tidak ditemukan.' },
        { status: 422 }
      );
    }

    const imageNodes = inputs.filter(
      node => node.fieldType === 'IMAGE'
    );

    const videoNode = inputs.find(
      node => node.fieldType === 'VIDEO'
    );

    const audioNode = inputs.find(
      node => node.fieldType === 'AUDIO'
    );

    if (images.length > imageNodes.length) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Jumlah gambar melebihi slot gambar AI App.'
        },
        { status: 422 }
      );
    }

    if (videoFileName && !videoNode) {
      return NextResponse.json(
        { ok: false, error: 'Input video tidak tersedia pada AI App.' },
        { status: 422 }
      );
    }

    if (audioFileName && !audioNode) {
      return NextResponse.json(
        { ok: false, error: 'Input audio tidak tersedia pada AI App.' },
        { status: 422 }
      );
    }

    const nodeInfoList = inputs.flatMap(node => {
      if (node.fieldType === 'IMAGE') {
        if (mode !== 'image') return [];

        const index = imageNodes.indexOf(node);
        const fileName = images[index];

        if (!fileName) return [];

        return [{
          nodeId: node.nodeId,
          fieldName: node.fieldName,
          fieldValue: fileName
        }];
      }

      if (node.fieldType === 'VIDEO') {
        if (!videoFileName) return [];

        return [{
          nodeId: node.nodeId,
          fieldName: node.fieldName,
          fieldValue: videoFileName
        }];
      }

      if (node.fieldType === 'AUDIO') {
        if (!audioFileName) return [];

        return [{
          nodeId: node.nodeId,
          fieldName: node.fieldName,
          fieldValue: audioFileName
        }];
      }

      if (node.fieldName?.toLowerCase() === 'text') {
        return [{
          nodeId: node.nodeId,
          fieldName: node.fieldName,
          fieldValue: prompt
        }];
      }

      // Kirim pengaturan bawaan seperti ratio,
      // duration, resolution, bitrateMode, dan outputFormat.
      if (
        node.fieldType === 'LIST' &&
        node.fieldValue !== undefined &&
        node.fieldValue !== null
      ) {
        return [{
          nodeId: node.nodeId,
          fieldName: node.fieldName,
          fieldValue: String(node.fieldValue)
        }];
      }

      // Jangan kirim file contoh bawaan AI App.
      return [];
    });

    const result: any = await rhPost(
      '/task/openapi/ai-app/run',
      {
        webappId,
        apiKey: key,
        nodeInfoList
      },
      key
    );

    const taskId = result?.data?.taskId || result?.taskId;

    if (!taskId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            result?.msg ||
            result?.message ||
            'RunningHub tidak mengembalikan Task ID.',
          details: result
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      taskId,
      status: result?.data?.taskStatus || 'RUNNING',
      webappId,
      message: 'Task berhasil dikirim ke RunningHub.'
    });

  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error
          ? error.message
          : 'Terjadi kesalahan saat menjalankan video.'
      },
      { status: 500 }
    );
  }
}
