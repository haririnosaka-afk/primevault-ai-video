
'use client';

import { useEffect, useState } from 'react';

type Result = {
  taskId?: string;
  status?: string;
  videos?: string[];
  consumeCoins?: number | string | null;
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
  const [mode, setMode] = useState<'text' | 'image'>('image');
  const [prompt, setPrompt] = useState('');

  const [images, setImages] = useState<File[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);

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
      const res = await fetch('/api/balance', {
        cache: 'no-store'
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.message || 'Gagal membaca saldo.');
      }

      setBalance(data.balance);
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : 'Gagal membaca saldo.'
      );
    } finally {
      setBalanceLoading(false);
    }
  }

  useEffect(() => {
    refreshBalance();
  }, []);

  function updateHistory(
    taskId: string,
    patch: Partial<HistoryItem>
  ) {
    setHistory(previous =>
      previous.map(item =>
        item.taskId === taskId
          ? { ...item, ...patch }
          : item
      )
    );
  }

  async function uploadFile(file: File): Promise<string> {
    const fd = new FormData();
    fd.append('file', file);

    const res = await fetch('/api/upload', {
      method: 'POST',
      body: fd
    });

    const data = await res.json();

    if (!res.ok || !data.fileName) {
      throw new Error(data.error || `Gagal upload ${file.name}`);
    }

    return data.fileName;
  }

  async function generate() {
    if (!prompt.trim()) {
      setMessage('Isi prompt terlebih dahulu.');
      return;
    }

    if (mode === 'image' && images.length === 0) {
      setMessage('Upload minimal satu gambar referensi.');
      return;
    }

    if (model === '2.5' && mode !== 'image') {
      setMessage('Seedance 2.5 menggunakan mode multimodal.');
      return;
    }

    const maxImages = model === '2.0' ? 4 : 5;

    if (images.length > maxImages) {
      setMessage(`Maksimal ${maxImages} gambar.`);
      return;
    }

    setBusy(true);
    setMessage('Menyiapkan file...');
    setResult(null);

    let currentTaskId = '';

    try {
      const uploadedImages: string[] = [];

      for (let i = 0; i < images.length; i++) {
        setMessage(`Mengunggah gambar ${i + 1}/${images.length}...`);
        uploadedImages.push(await uploadFile(images[i]));
      }

      let uploadedVideo: string | undefined;
      let uploadedAudio: string | undefined;

      if (model === '2.5' && videoFile) {
        setMessage('Mengunggah video...');
        uploadedVideo = await uploadFile(videoFile);
      }

      if (model === '2.5' && audioFile) {
        setMessage('Mengunggah audio...');
        uploadedAudio = await uploadFile(audioFile);
      }

      setMessage('Mengirim permintaan ke RunningHub...');

      const res = await fetch('/api/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          mode,
          prompt,
          images: uploadedImages,
          videoFileName: uploadedVideo,
          audioFileName: uploadedAudio
        })
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Gagal membuat task.');
      }

      currentTaskId = data.taskId;

      setResult({
        taskId: currentTaskId,
        status: data.status
      });

      setHistory(previous => [
        {
          taskId: currentTaskId,
          model,
          mode,
          prompt,
          status: 'QUEUED',
          consumeCoins: null,
          videos: [],
          createdAt: new Date().toISOString()
        },
        ...previous
      ].slice(0, 100));

      setMessage('Task diterima. Menunggu hasil video...');

      let done = false;

      for (let i = 0; i < 90 && !done; i++) {
        await new Promise(resolve => setTimeout(resolve, 5000));

        const statusResponse = await fetch(
          `/api/status?taskId=${encodeURIComponent(currentTaskId)}`,
          { cache: 'no-store' }
        );

        const statusData = await statusResponse.json();

        if (!statusResponse.ok) {
          throw new Error(
            statusData.error || 'Gagal memeriksa status.'
          );
        }

        const taskStatus = statusData.status || 'RUNNING';
        const taskVideos = statusData.videos || [];
        const coins = statusData.consumeCoins ?? null;

        setResult({
          taskId: currentTaskId,
          status: taskStatus,
          videos: taskVideos,
          consumeCoins: coins
        });

        updateHistory(currentTaskId, {
          status: taskStatus,
          consumeCoins: coins,
          videos: taskVideos
        });

        if (taskStatus === 'SUCCESS' && taskVideos.length > 0) {
          setMessage('Video berhasil dibuat!');
          done = true;
          await refreshBalance();
        } else if (taskStatus === 'FAILED' || statusData.failed) {
          throw new Error(
            statusData.error || 'Task gagal di RunningHub.'
          );
        } else {
          setMessage(
            taskStatus === 'QUEUED'
              ? 'Task sedang mengantre...'
              : `Task sedang diproses... (${i + 1}/90)`
          );
        }
      }

      if (!done) {
        setMessage(
          'Task masih diproses. Gunakan Task ID untuk memeriksa kembali.'
        );
      }

    } catch (e) {
      const errorMessage = e instanceof Error
        ? e.message
        : 'Terjadi kesalahan.';

      setMessage(errorMessage);

      if (currentTaskId) {
        updateHistory(currentTaskId, {
          status: 'FAILED'
        });
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
          <div className="brand">
            PRIMEVAULT <span>AI VIDEO</span>
          </div>
          <small>CREATIVE VIDEO STUDIO · RUNNINGHUB</small>
        </div>
        <div className="status"><i /> API CONNECTOR</div>
      </header>

      <section className="hero">
        <p className="eyebrow">GENERATIVE VIDEO WORKSPACE</p>
        <h1>
          Turn your ideas<br />
          <em>into motion.</em>
        </h1>
        <p className="sub">
          Buat video dengan Seedance 2.0 dan 2.5 melalui RunningHub.
        </p>
      </section>

      <section className="panel">
        <div className="sectionTop">
          <div>
            <p className="eyebrow">RH COINS MONITOR</p>
            <h2>Saldo RunningHub</h2>
          </div>
          <button
            onClick={refreshBalance}
            disabled={balanceLoading}
          >
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
          Saldo menampilkan angka RH Coins dari RunningHub.
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
            onClick={() => {
              setModel('2.0');
              setMode('image');
              setImages([]);
              setVideoFile(null);
              setAudioFile(null);
            }}
          >
            <b>SEEDANCE 2.0</b>
            <small>Text / Image · Maksimal 4 gambar</small>
          </button>

          <button
            className={model === '2.5' ? 'model active' : 'model'}
            onClick={() => {
              setModel('2.5');
              setMode('image');
              setImages([]);
              setVideoFile(null);
              setAudioFile(null);
            }}
          >
            <b>SEEDANCE 2.5</b>
            <small>Multimodal · Image, Video, Audio</small>
          </button>
        </div>

        <p className="eyebrow gapTop">02 / GENERATION MODE</p>

        {model === '2.0' && (
          <div className="tabs">
            <button
              className={mode === 'text' ? 'selected' : ''}
              onClick={() => {
                setMode('text');
                setImages([]);
              }}
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
        )}

        {model === '2.5' && (
          <p className="note">
            Mode multimodal: minimal satu gambar, video dan audio opsional.
          </p>
        )}

        <label className="fieldLabel">VIDEO PROMPT</label>

        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="Describe the scene, movement, camera angle, lighting, and style..."
          rows={6}
        />

        {(mode === 'image' || model === '2.5') && (
          <div className="upload">
            <label>REFERENCE IMAGES</label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={e => {
                const selected = Array.from(e.target.files || []);
                const limit = model === '2.0' ? 4 : 5;

                setImages(selected.slice(0, limit));

                if (selected.length > limit) {
                  setMessage(`Maksimal ${limit} gambar.`);
                }
              }}
            />
            <small>
              {images.length} gambar dipilih · Maksimal {model === '2.0' ? 4 : 5}
            </small>

            {images.map((img, i) => (
              <small key={`${img.name}-${i}`}>
                {i + 1}. {img.name}
              </small>
            ))}
          </div>
        )}

        {model === '2.5' && (
          <>
            <div className="upload">
              <label>REFERENCE VIDEO (OPSIONAL)</label>
              <input
                type="file"
                accept="video/*"
                onChange={e =>
                  setVideoFile(e.target.files?.[0] || null)
                }
              />
              {videoFile && <small>{videoFile.name}</small>}
            </div>

            <div className="upload">
              <label>REFERENCE AUDIO (OPSIONAL)</label>
              <input
                type="file"
                accept="audio/*"
                onChange={e =>
                  setAudioFile(e.target.files?.[0] || null)
                }
              />
              {audioFile && <small>{audioFile.name}</small>}
            </div>
          </>
        )}

        <button
          className="generate"
          disabled={busy}
          onClick={generate}
        >
          {busy ? 'PROCESSING...' : 'GENERATE VIDEO'} <span>↗</span>
        </button>

        <p className="note">
          Biaya mengikuti konfigurasi AI App RunningHub.
        </p>

        {message && (
          <div className="message">
            {message}
            {result?.taskId && (
              <small>Task ID: {result.taskId}</small>
            )}
            {result?.status && (
              <small>Status: {result.status}</small>
            )}
            {result?.consumeCoins != null && (
              <small>
                RH Coins terpakai: {result.consumeCoins}
              </small>
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
                <b>SEEDANCE {item.model}</b>
                <p>
                  {item.mode === 'image'
                    ? 'Image / Multimodal'
                    : 'Text-to-Video'}
                </p>
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
