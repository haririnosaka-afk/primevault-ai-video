
import { NextResponse } from 'next/server';
import { HOST, requireKey } from '@/lib/runninghub';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const key = requireKey();

    const response = await fetch(
      `${HOST}/uc/openapi/accountStatus`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          apikey: key
        }),
        cache: 'no-store'
      }
    );

    const raw = await response.text();

    let result: any;

    try {
      result = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        {
          ok: false,
          message: 'RunningHub mengembalikan respons bukan JSON.',
          details: raw.slice(0, 500)
        },
        { status: 502 }
      );
    }

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          message: result?.msg || `RunningHub HTTP ${response.status}`,
          details: result
        },
        { status: 502 }
      );
    }

    if (
      typeof result?.code === 'number' &&
      ![0, 200].includes(result.code)
    ) {
      return NextResponse.json(
        {
          ok: false,
          message: result?.msg || 'Gagal membaca saldo RunningHub.',
          details: result
        },
        { status: 502 }
      );
    }

    const data = result?.data;

    if (!data) {
      return NextResponse.json(
        {
          ok: false,
          message: 'Data saldo tidak ditemukan.',
          details: result
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      balance: {
        rhCoins: data.remainCoins ?? null,
        wallet: data.remainMoney ?? null,
        currency: data.currency ?? null,
        apiType: data.apiType ?? null,
        runningTasks: data.currentTaskCounts ?? null
      }
    });

  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error
          ? error.message
          : 'Gagal memeriksa saldo RunningHub.'
      },
      { status: 500 }
    );
  }
}
