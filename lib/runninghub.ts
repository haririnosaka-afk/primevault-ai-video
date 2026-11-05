
const HOST = (
  process.env.RUNNINGHUB_HOST || 'https://www.runninghub.cn'
).replace(/\/$/, '');

export function requireKey() {
  const key = process.env.RUNNINGHUB_API_KEY;

  if (!key) {
    throw new Error(
      'RUNNINGHUB_API_KEY belum dipasang di Vercel.'
    );
  }

  return key;
}

export function appId(
  model: '2.0' | '2.5',
  mode: 'text' | 'image'
) {
  if (model === '2.0') {
    return '2104435502584987649';
  }

  if (mode === 'text') {
    throw new Error(
      'Seedance 2.5 menggunakan mode multimodal.'
    );
  }

  return '2085913383404068865';
}

export async function rhPost(
  path: string,
  body: unknown,
  key = requireKey()
) {
  const res = await fetch(`${HOST}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body),
    cache: 'no-store'
  });

  const json: any = await res.json().catch(() => ({}));

  if (
    !res.ok ||
    (typeof json.code === 'number' &&
      ![0, 200].includes(json.code))
  ) {
    throw new Error(
      json.msg ||
      json.message ||
      `RunningHub HTTP ${res.status}`
    );
  }

  return json;
}

export async function getAppInputs(
  webappId: string,
  key = requireKey()
) {
  const url = new URL(`${HOST}/api/webapp/apiCallDemo`);

  url.searchParams.set('apiKey', key);
  url.searchParams.set('webappId', webappId);

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${key}`
    },
    cache: 'no-store'
  });

  const json: any = await res.json().catch(() => ({}));

  if (
    !res.ok ||
    (typeof json.code === 'number' &&
      ![0, 200].includes(json.code))
  ) {
    throw new Error(
      json.msg ||
      `Gagal membaca konfigurasi AI App (${res.status})`
    );
  }

  const nodes = json?.data?.nodeInfoList;

  if (!Array.isArray(nodes) || !nodes.length) {
    throw new Error(
      'Konfigurasi input AI App tidak ditemukan.'
    );
  }

  return nodes as Array<{
    nodeId: string;
    nodeName?: string;
    fieldName: string;
    fieldValue?: string;
    fieldType?: string;
    description?: string;
    descriptionEn?: string;
  }>;
}

export { HOST };
