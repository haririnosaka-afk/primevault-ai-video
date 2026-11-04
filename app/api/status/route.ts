import { NextRequest, NextResponse } from 'next/server';
import { rhPost, requireKey } from '@/lib/runninghub';
export const runtime = 'nodejs';
export async function GET(req: NextRequest) {
  try {
    const taskId = req.nextUrl.searchParams.get('taskId');
    if (!taskId) return NextResponse.json({error:'taskId wajib diisi.'},{status:400});
    const result:any = await rhPost('/task/openapi/outputs',{apiKey:requireKey(),taskId});
    const data = Array.isArray(result?.data) ? result.data : [];
    const videos = data.filter((x:any)=>/mp4|video/i.test(`${x.fileType||''} ${x.fileUrl||''}`) && x.fileUrl).map((x:any)=>x.fileUrl);
    const files = data.filter((x:any)=>x.fileUrl).map((x:any)=>x.fileUrl);
    const failed = result?.code !== 0 && result?.code !== 200;
    const status = failed ? 'FAILED' : data.length ? 'SUCCESS' : 'RUNNING';
    const usage = data.find((x:any)=>x.consumeCoins != null)?.consumeCoins ?? null;
    return NextResponse.json({status,videos:videos.length?videos:files,failed,error:failed?result?.msg:null,consumeCoins:usage});
  } catch(e) { return NextResponse.json({error:e instanceof Error?e.message:'Status error'},{status:500}); }
}
