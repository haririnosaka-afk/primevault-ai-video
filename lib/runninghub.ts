
const HOST = (
  process.env.RUNNINGHUB_HOST || 'https://www.runninghub.ai'
).replace(/\/$/, '');

export function requireKey() {
  const key = process.env.RUNNINGHUB_API_KEY;

  if (!key) {
    throw new Error(
      'RUNNINGHUB_API_KEY belum dipasang di Vercel Environment Variables.'
    );
  }

  return key;
}

export function appId(
  model: '2.0' | '2.5',
  mode: 'text' | 'image'
) {
  if (model === '2.0' && mode === 'image') {
    return '2118074377400840194';
  }

  const key = model === '2.0'
    ? (mode === 'image'
        ? 'SEEDANCE20_I2V_WEBAPP_ID'
        : 'SEEDANCE20_T2V_WEBAPP_ID')
    : (mode === 'image'
        ? 'SEEDANCE25_I2V_WEBAPP_ID'
        : 'SEEDANCE25_T2V_WEBAPP_ID');

  const id = process.env[key];

  if (!id) {
    throw new Error(`${key} belum dikonfigurasi di Vercel.`);
  }

  return id;
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
    (
      typeof json.code === 'number' &&
      ![0, 200].includes(json.code)
    )
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
    (
      typeof json.code === 'number' &&
      ![0, 200].includes(json.code)
    )
  ) {
    throw new Error(
      json.msg ||
      `Gagal membaca konfigurasi AI App (${res.status})`
    );
  }

  const nodes = json?.data?.nodeInfoList;

  if (!Array.isArray(nodes) || !nodes.length) {
    throw new Error(
      'RunningHub tidak mengembalikan konfigurasi input AI App.'
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
