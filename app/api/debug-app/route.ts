
import { NextResponse } from 'next/server';
import { getAppInputs, requireKey } from '@/lib/runninghub';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const key = requireKey();

    const apps = [
      {
        model: 'Seedance 2.0',
        webappId: '2104435502584987649'
      },
      {
        model: 'Seedance 2.5',
        webappId: '2085913383404068865'
      }
    ];

    const results = await Promise.all(
      apps.map(async (app) => {
        const nodes = await getAppInputs(app.webappId, key);

        return {
          model: app.model,
          webappId: app.webappId,
          nodeInfoList: nodes.map((node) => ({
            nodeId: node.nodeId,
            fieldName: node.fieldName,
            fieldType: node.fieldType,
            description: node.description,
            descriptionEn: node.descriptionEn,
            fieldValue: node.fieldValue
          }))
        };
      })
    );

    return NextResponse.json({
      ok: true,
      apps: results
    });

  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error
        ? error.message
        : 'Debug error'
    }, { status: 500 });
  }
}
