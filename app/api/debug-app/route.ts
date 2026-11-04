
import { NextResponse } from 'next/server';
import { getAppInputs, requireKey } from '@/lib/runninghub';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const webappId = '2037048798156951553';
    const nodes = await getAppInputs(webappId, requireKey());

    return NextResponse.json({
      ok: true,
      webappId,
      nodeInfoList: nodes.map((node) => ({
        nodeId: node.nodeId,
        fieldName: node.fieldName,
        fieldType: node.fieldType,
        description: node.description,
        descriptionEn: node.descriptionEn,
        fieldValue: node.fieldValue
      }))
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Debug error'
    }, { status: 500 });
  }
}
