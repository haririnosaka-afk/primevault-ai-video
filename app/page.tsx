
'use client';

import { useEffect, useState } from 'react';

type Result = {
  taskId?: string;
  status?: string;
  videos?: string[];
  consumeCoins?: number | string | null;
  error?: string;
};

type Balance = {
  rhCoins: number | string | null;
  wallet: number | string | null;
  apiType?: string | null;
};

type HistoryItem = {
  taskId: string;
  model: string;
  mode: string;
  prompt: string;
  status: string;
  consumeCoins: number | string | null;
  videos: string[];
  createdAt: string;
};

const STORAGE_KEY = 'primevault_history_v1';

export default function Home() {
  const [model, setModel] = useState<'2.0' | '2.5'>('2.5');
  const [mode, setMode] = useState<'text' | 'image'>('text');
  const [prompt, setPrompt] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [message, setMessage] = useState('');

  const [balance, setBalance] = useState<Balance | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setHistory(JSON.parse(saved));
    } catch {
      console.error('Gagal membaca riwayat.');
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch {
      console.error('Gagal menyimpan riwayat.');
    }
  }, [history]);

  async function refreshBalance() {
    setBalanceLoading(true);

    try {
      const res = await fetch('/api/balance', { cache: 'no-store' });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.message || 'Gagal membaca saldo.');
      }

      setBalance(data.balance);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Gagal membaca saldo.');
    } finally {
      setBalanceLoading(false);
    }
  }

  useEffect(() => {
    refreshBalance();
  }, []);

  function updateHistory(taskId: string, patch: Partial<HistoryItem>) {
    setHistory(previous =>
      previous.map(item =>
        item.taskId === taskId ? { ...item, ...patch } : item
      )
    );
  }

  async function generate() {
    if (!prompt.trim()) {
      setMessage('Isi prompt terlebih dahulu.');
      return;
    }

    if (model === '2.0' && mode === 'text') {
      setMessage('Seedance 2.0 Text-to-Video belum tersedia. Gunakan Seedance 2.5 untuk T2V.');
      return;
    }

    if (mode === 'image' && !file) {
      setMessage('Upload gambar referensi untuk Image-to-Video.');
      return;
    }

    setBusy(true);
    setMessage('Menyiapkan permintaan...');
    setResult(null);

    try {
      let uploadedFileName: string | undefined;

      if (file) {
        const fd = new FormData();
        fd.append('file', file);

        const up = await fetch('/api/upload', {
          method: 'POST',
          body: fd
        });

        const uj = await up.json();

        if (!up.ok) throw new Error(uj.error || 'Upload gagal');

        uploadedFileName = uj.fileName;
      }

      const res = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          mode,
          prompt,
          fileName: uploadedFileName
        })
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Gagal membuat task');

      const taskId = data.taskId;

      setResult({ taskId, status: data.status });

      setHistory(previous => [
        {
          taskId,
          model,
          mode,
          prompt,
          status: 'RUNNING',
          consumeCoins: null,
          videos: [],
          createdAt: new Date().toISOString()
        },
        ...previous
      ].slice(0, 100));

      setMessage('Task diterima RunningHub. Memantau hasil...');

      let done = false;

      for (let i = 0; i < 90 && !done; i++) {
        await new Promise(r => setTimeout(r, 5000));

        const s = await fetch(
          `/api/status?taskId=${encodeURIComponent(taskId)}`,
          { cache: 'no-store' }
        );

        const sj = await s.json();

        if (!s.ok) throw new Error(sj.error || 'Gagal memeriksa status');

        setResult({
          taskId,
          status: sj.status,
          videos: sj.videos,
          consumeCoins: sj.consumeCoins
        });

        updateHistory(taskId, {
          status: sj.status || 'RUNNING',
          consumeCoins: sj.consumeCoins ?? null,
          videos: sj.videos || []
        });

        if (sj.videos?.length) {
          setMessage('Video selesai.');
          done = true;
          refreshBalance();
        } else if (sj.status === 'FAILED' || sj.failed) {
          throw new Error(sj.error || 'Task gagal di RunningHub');
        } else {
          setMessage(`Status: ${sj.status || 'RUNNING'}...`);
        }
      }

      if (!done) {
        setMessage('Task masih diproses. Kamu bisa cek lagi menggunakan Task ID.');
      }

    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Terjadi kesalahan';

      setMessage(errorMessage);

      if (result?.taskId) {
        updateHistory(result.taskId, { status: 'FAILED' });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="shell">
      <header>
        <div className="brandMark">PV</div>
        <div>
          <div className="brand">PRIMEVAULT <span>AI VIDEO</span></div>
          <small>CREATIVE VIDEO STUDIO · RUNNINGHUB</small>
        </div>
        <div className="status"><i /> API CONNECTOR</div>
      </header>

      <section className="hero">
        <p className="eyebrow">GENERATIVE VIDEO WORKSPACE</p>
        <h1>Turn your ideas<br /><em>into motion.</em></h1>
        <p className="sub">
          Buat video dengan Seedance 2.0 dan 2.5 melalui akun RunningHub milikmu.
        </p>
      </section>

      <section className="panel">
        <div className="sectionTop">
          <div>
            <p className="eyebrow">RH COINS MONITOR</p>
            <h2>Saldo RunningHub</h2>
          </div>
          <button onClick={refreshBalance} disabled={balanceLoading}>
            {balanceLoading ? 'MEMERIKSA...' : '↻ REFRESH'}
          </button>
        </div>

        <div className="balanceCard">
          <small>RH COINS</small>
          <h1>
            {balance?.rhCoins != null
              ? Number(balance.rhCoins).toLocaleString('id-ID')
              : '--'}
          </h1>
          <p>Jenis API: {balance?.apiType || '--'}</p>
          <p>
            Wallet: {balance?.wallet == null
              ? 'Tidak tersedia'
              : balance.wallet}
          </p>
        </div>

        <p className="note">
          Saldo ini adalah angka RH Coins yang dilaporkan API.
          Pembagian Free dan Paid belum tersedia dari endpoint saldo ini.
        </p>
      </section>

      <section className="panel">
        <div className="sectionTop">
          <div>
            <p className="eyebrow">01 / MODEL ENGINE</p>
            <h2>Pilih model</h2>
          </div>
          <span className="pill">RH COINS BILLING</span>
        </div>

        <div className="models">
          <button
            className={model === '2.0' ? 'model active' : 'model'}
            onClick={() => setModel('2.0')}
          >
            <b>SEEDANCE 2.0</b>
            <small>Image-to-Video · T2V belum tersedia</small>
          </button>

          <button
            className={model === '2.5' ? 'model active' : 'model'}
            onClick={() => setModel('2.5')}
          >
            <b>SEEDANCE 2.5</b>
            <small>Text-to-Video + Image-to-Video</small>
          </button>
        </div>

        <p className="eyebrow gapTop">02 / GENERATION MODE</p>

        <div className="tabs">
          <button
            className={mode === 'text' ? 'selected' : ''}
            onClick={() => setMode('text')}
          >
            Text to Video
          </button>

          <button
            className={mode === 'image' ? 'selected' : ''}
            onClick={() => setMode('image')}
          >
            Image to Video
          </button>
        </div>

        <label className="fieldLabel">VIDEO PROMPT</label>

        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="Describe the scene, movement, camera angle, lighting, and style..."
          rows={6}
        />

        {mode === 'image' && (
          <div className="upload">
            <label htmlFor="ref">REFERENCE IMAGE</label>
            <input
              id="ref"
              type="file"
              accept="image/*"
              onChange={e => setFile(e.target.files?.[0] || null)}
            />
            {file && <small>{file.name}</small>}
          </div>
        )}

        <button className="generate" disabled={busy} onClick={generate}>
          {busy ? 'PROCESSING...' : 'GENERATE VIDEO'} <span>↗</span>
        </button>

        <p className="note">
          Biaya pemrosesan ditagihkan oleh RunningHub sesuai aplikasi,
          model, dan parameter yang dikonfigurasi.
        </p>

        {message && (
          <div className="message">
            {message}
            {result?.taskId && <small>Task ID: {result.taskId}</small>}
            {result?.consumeCoins != null && (
              <small>RH Coins terpakai: {result.consumeCoins}</small>
            )}
          </div>
        )}

        {result?.videos?.map((url, i) => (
          <div className="video" key={url}>
            <video controls src={url} />
            <a href={url} target="_blank" rel="noreferrer">
              Buka / unduh video {i + 1}
            </a>
          </div>
        ))}
      </section>

      <section className="panel">
        <div className="sectionTop">
          <div>
            <p className="eyebrow">03 / GENERATION LOG</p>
            <h2>Riwayat Generasi</h2>
          </div>
          <span className="pill">{history.length} TASK</span>
        </div>

        {history.length === 0 ? (
          <p className="note">Belum ada riwayat generasi.</p>
        ) : (
          <div className="historyList">
            {history.map(item => (
              <div
                className="historyItem"
                key={item.taskId}
                style={{
                  padding: '14px',
                  marginBottom: '12px',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '12px'
                }}
              >
                <b>{item.model === '2.5' ? 'SEEDANCE 2.5' : 'SEEDANCE 2.0'}</b>
                <p>{item.mode === 'image' ? 'Image-to-Video' : 'Text-to-Video'}</p>
                <p>{item.prompt}</p>
                <small>Task ID: {item.taskId}</small>
                <p>Status: <b>{item.status}</b></p>
                <p>
                  RH Coins terpakai:{' '}
                  <b>{item.consumeCoins ?? 'Belum tersedia'}</b>
                </p>
                <small>
                  {new Date(item.createdAt).toLocaleString('id-ID')}
                </small>

                {item.videos.map((url, i) => (
                  <p key={url}>
                    <a href={url} target="_blank" rel="noreferrer">
                      Buka video {i + 1}
                    </a>
                  </p>
                ))}
              </div>
            ))}
          </div>
        )}

        {history.length > 0 && (
          <button
            onClick={() => {
              if (confirm('Hapus semua riwayat di browser ini?')) {
                setHistory([]);
              }
            }}
          >
            HAPUS RIWAYAT
          </button>
        )}
      </section>

      <footer>
        PRIMEVAULT AI VIDEO <span>POWERED BY RUNNINGHUB</span>
      </footer>
    </main>
  );
}
