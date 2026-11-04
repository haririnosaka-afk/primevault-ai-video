'use client';
import { useState } from 'react';

type Result = { taskId?: string; status?: string; videos?: string[]; error?: string };
export default function Home() {
  const [model,setModel] = useState<'2.0'|'2.5'>('2.5');
  const [mode,setMode] = useState<'text'|'image'>('text');
  const [prompt,setPrompt] = useState('');
  const [file,setFile] = useState<File|null>(null);
  const [busy,setBusy] = useState(false);
  const [result,setResult] = useState<Result|null>(null);
  const [message,setMessage] = useState('');

  async function generate() {
    if (!prompt.trim()) return setMessage('Isi prompt terlebih dahulu.');
    if (model === '2.0' && mode === 'text') return setMessage('Seedance 2.0 Text-to-Video belum tersedia sebagai AI App Consumer-Membership yang terverifikasi. Gunakan Seedance 2.5 untuk T2V atau Seedance 2.0 untuk I2V.');
    if (mode === 'image' && !file) return setMessage('Upload gambar referensi untuk Image-to-Video.');
    setBusy(true); setMessage('Menyiapkan permintaan...'); setResult(null);
    try {
      let uploadedFileName: string|undefined;
      if (file) {
        const fd = new FormData(); fd.append('file',file);
        const up = await fetch('/api/upload',{method:'POST',body:fd});
        const uj = await up.json(); if (!up.ok) throw new Error(uj.error || 'Upload gagal');
        uploadedFileName = uj.fileName;
      }
      const res = await fetch('/api/run',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model,mode,prompt,fileName:uploadedFileName})});
      const data = await res.json(); if (!res.ok) throw new Error(data.error || 'Gagal membuat task');
      setResult({taskId:data.taskId,status:data.status}); setMessage('Task diterima RunningHub. Memantau hasil...');
      let done = false;
      for (let i=0;i<90 && !done;i++) {
        await new Promise(r=>setTimeout(r,5000));
        const s = await fetch(`/api/status?taskId=${encodeURIComponent(data.taskId)}`);
        const sj = await s.json(); if (!s.ok) throw new Error(sj.error || 'Gagal memeriksa status');
        setResult({taskId:data.taskId,status:sj.status,videos:sj.videos});
        if (sj.videos?.length) { setMessage('Video selesai.'); done=true; }
        else if (sj.status === 'FAILED' || sj.failed) throw new Error(sj.error || 'Task gagal di RunningHub');
        else setMessage(`Status: ${sj.status || 'RUNNING'}...`);
      }
      if (!done) setMessage('Task masih diproses. Kamu bisa cek lagi menggunakan task ID.');
    } catch(e) { setMessage(e instanceof Error ? e.message : 'Terjadi kesalahan'); }
    finally { setBusy(false); }
  }

  return <main className="shell">
    <header><div className="brandMark">PV</div><div><div className="brand">PRIMEVAULT <span>AI VIDEO</span></div><small>CREATIVE VIDEO STUDIO · RUNNINGHUB</small></div><div className="status"><i/> API CONNECTOR</div></header>
    <section className="hero"><p className="eyebrow">GENERATIVE VIDEO WORKSPACE</p><h1>Turn your ideas<br/><em>into motion.</em></h1><p className="sub">Buat video dengan Seedance 2.0 dan 2.5 melalui akun RunningHub milikmu.</p></section>
    <section className="panel">
      <div className="sectionTop"><div><p className="eyebrow">01 / MODEL ENGINE</p><h2>Pilih model</h2></div><span className="pill">RH COINS BILLING</span></div>
      <div className="models"><button className={model==='2.0'?'model active':'model'} onClick={()=>setModel('2.0')}><b>SEEDANCE 2.0</b><small>Image-to-Video · T2V app belum terverifikasi</small></button><button className={model==='2.5'?'model active':'model'} onClick={()=>setModel('2.5')}><b>SEEDANCE 2.5</b><small>Text-to-Video + Image-to-Video</small></button></div>
      <p className="eyebrow gapTop">02 / GENERATION MODE</p><div className="tabs"><button className={mode==='text'?'selected':''} onClick={()=>setMode('text')}>Text to Video</button><button className={mode==='image'?'selected':''} onClick={()=>setMode('image')}>Image to Video</button></div>
      <label className="fieldLabel">VIDEO PROMPT</label><textarea value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="Describe the scene, movement, camera angle, lighting, and style..." rows={6}/>
      {mode==='image' && <div className="upload"><label htmlFor="ref">REFERENCE IMAGE</label><input id="ref" type="file" accept="image/*" onChange={e=>setFile(e.target.files?.[0]||null)}/>{file && <small>{file.name}</small>}</div>}
      <button className="generate" disabled={busy} onClick={generate}>{busy?'PROCESSING...':'GENERATE VIDEO'} <span>↗</span></button>
      <p className="note">Biaya pemrosesan ditagihkan oleh RunningHub sesuai aplikasi, model, dan parameter yang dikonfigurasi. Periksa saldo sebelum generate.</p>
      {message && <div className="message">{message}{result?.taskId && <small>Task ID: {result.taskId}</small>}</div>}
      {result?.videos?.map((url,i)=><div className="video" key={url}><video controls src={url}/><a href={url} target="_blank" rel="noreferrer">Buka / unduh video {i+1}</a></div>)}
    </section>
    <footer>PRIMEVAULT AI VIDEO <span>POWERED BY RUNNINGHUB</span></footer>
  </main>;
}
