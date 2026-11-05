
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

    const images = Array.isArray(body.images)
      ? body.images.filter((x: unknown) => typeof x === 'string' && x)
      : [body.fileName, body.endFileName].filter(
          (x: unknown) => typeof x === 'string' && x
        );

    if (mode === 'image' && images.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Gambar referensi belum diunggah.' },
        { status: 400 }
      );
    }

    if (model === '2.5' && mode === 'text') {
      return NextResponse.json(
        {
          ok: false,
          error: 'Seedance 2.5 ini menggunakan mode multimodal.'
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
        { ok: false, error: 'Input text tidak ditemukan.' },
        { status: 422 }
      );
    }

    const imageNodes = inputs.filter(
      node => node.fieldType === 'IMAGE'
    );

    if (mode === 'image' && imageNodes.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Input gambar tidak ditemukan.' },
        { status: 422 }
      );
    }

    const nodeInfoList = inputs.flatMap(node => {
      const type = node.fieldType;

      if (type === 'IMAGE') {
        if (mode !== 'image') return [];

        const index = imageNodes.indexOf(node);
        const file = images[index];

        if (!file) return [];

        return [{
          nodeId: node.nodeId,
          fieldName: node.fieldName,
          fieldValue: file
        }];
      }

      if (type === 'VIDEO') {
        if (!body.videoFileName) return [];

        return [{
          nodeId: node.nodeId,
          fieldName: node.fieldName,
          fieldValue: String(body.videoFileName)
        }];
      }

      if (type === 'AUDIO') {
        if (!body.audioFileName) return [];

        return [{
          nodeId: node.nodeId,
          fieldName: node.fieldName,
          fieldValue: String(body.audioFileName)
        }];
      }

      if (
        node.fieldName?.toLowerCase() === 'text'
      ) {
        return [{
          nodeId: node.nodeId,
          fieldName: node.fieldName,
          fieldValue: prompt
        }];
      }

      if (
        node.fieldValue !== undefined &&
        node.fieldValue !== null
      ) {
        return [{
          nodeId: node.nodeId,
          fieldName: node.fieldName,
          fieldValue: String(node.fieldValue)
        }];
      }

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
          error: result?.msg || result?.message ||
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
