import { NextRequest, NextResponse } from 'next/server';
import { HOST, requireKey } from '@/lib/runninghub';
export const runtime = 'nodejs';
export async function POST(req: NextRequest) {
  try {
    const key = requireKey(); const incoming = await req.formData(); const file = incoming.get('file');
    if (!(file instanceof File)) return NextResponse.json({error:'File gambar tidak ditemukan.'},{status:400});
    if (!file.type.startsWith('image/')) return NextResponse.json({error:'Hanya file gambar yang didukung pada tahap ini.'},{status:400});
    if (file.size > 15*1024*1024) return NextResponse.json({error:'Ukuran gambar maksimal 15 MB.'},{status:400});
    const form = new FormData(); form.append('apiKey',key); form.append('fileType','input'); form.append('file',file,file.name);
    const upstream = await fetch(`${HOST}/task/openapi/upload`,{method:'POST',headers:{Authorization:`Bearer ${key}`},body:form,cache:'no-store'});
    const json = await upstream.json();
    const fileName = json?.data?.fileName;
    if (!upstream.ok || json?.code !== 0 || !fileName) return NextResponse.json({error:json?.msg||'RunningHub gagal mengunggah file.',details:json},{status:502});
    return NextResponse.json({fileName});
  } catch(e) { return NextResponse.json({error:e instanceof Error?e.message:'Upload error'},{status:500}); }
}
