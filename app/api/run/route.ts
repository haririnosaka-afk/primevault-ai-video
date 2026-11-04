
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

    if (mode === 'image' && !body.fileName) {
      return NextResponse.json(
        { ok: false, error: 'Gambar referensi belum diunggah.' },
        { status: 400 }
      );
    }

    const key = requireKey();
    const webappId = appId(model, mode);
    const inputs = await getAppInputs(webappId, key);

    const promptNode = inputs.find(
      node => node.fieldName?.toLowerCase() === 'prompt'
    );

    if (!promptNode) {
      return NextResponse.json(
        { ok: false, error: 'Input prompt tidak ditemukan.' },
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

    const nodeInfoList = inputs.flatMap((node, index) => {
      // Input gambar dari pengguna
      if (node.fieldType === 'IMAGE') {
        if (mode !== 'image') {
          return [];
        }

        const imageIndex = imageNodes.indexOf(node);

        if (imageIndex === 0) {
          return [{
            nodeId: node.nodeId,
            fieldName: node.fieldName,
            fieldValue: String(body.fileName)
          }];
        }

        if (imageIndex === 1 && body.endFileName) {
          return [{
            nodeId: node.nodeId,
            fieldName: node.fieldName,
            fieldValue: String(body.endFileName)
          }];
        }

        // Jangan kirim gambar contoh dari konfigurasi.
        return [];
      }

      // Prompt pengguna
      if (
        node.fieldName?.toLowerCase() ===
        promptNode.fieldName?.toLowerCase()
      ) {
        return [{
          nodeId: node.nodeId,
          fieldName: node.fieldName,
          fieldValue: prompt
        }];
      }

      // Pengaturan bawaan AI App
      if (node.fieldValue !== undefined && node.fieldValue !== null) {
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
