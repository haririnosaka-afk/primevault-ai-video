import { NextRequest, NextResponse } from 'next/server';
import { appId, getAppInputs, rhPost, requireKey } from '@/lib/runninghub';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const model = body.model === '2.0' ? '2.0' : '2.5';
    const mode = body.mode === 'image' ? 'image' : 'text';
    const prompt = String(body.prompt || '').trim();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt wajib diisi.' }, { status: 400 });
    }

    if (mode === 'image' && !body.fileName) {
      return NextResponse.json({ error: 'Gambar referensi belum diunggah.' }, { status: 400 });
    }

    const key = requireKey();
    const webappId = appId(model, mode);
    const inputs = await getAppInputs(webappId, key);

    const promptNode = inputs.find(n =>
      n.fieldName?.toLowerCase() === 'prompt'
    ) || inputs.find(n =>
      `${n.description || ''} ${n.descriptionEn || ''}`.toLowerCase().includes('prompt')
    );

    const imageNode = inputs.find(n => n.fieldType === 'IMAGE');

    if (!promptNode) {
      return NextResponse.json({ error: 'Node prompt tidak ditemukan.' }, { status: 422 });
    }

    if (mode === 'image' && !imageNode) {
      return NextResponse.json({ error: 'Input gambar tidak ditemukan.' }, { status: 422 });
    }

    const nodeInfoList = [
      {
        nodeId: promptNode.nodeId,
        fieldName: promptNode.fieldName,
        fieldValue: prompt
      },
      ...(mode === 'image' && imageNode ? [{
        nodeId: imageNode.nodeId,
        fieldName: imageNode.fieldName,
        fieldValue: String(body.fileName)
      }] : [])
    ];

    const result: any = await rhPost(
      '/task/openapi/ai-app/run',
      { webappId, apiKey: key, nodeInfoList },
      key
    );

    const taskId = result?.data?.taskId || result?.taskId;

    if (!taskId) {
      return NextResponse.json({
        error: result?.msg || 'Task ID tidak ditemukan.',
        details: result
      }, { status: 502 });
    }

    return NextResponse.json({
      taskId,
      status: result?.data?.taskStatus || 'RUNNING',
      webappId
    });

  } catch (e) {
    return NextResponse.json({
      error: e instanceof Error ? e.message : 'Run error'
    }, { status: 500 });
  }
}
