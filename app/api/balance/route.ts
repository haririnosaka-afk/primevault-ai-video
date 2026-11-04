import { NextResponse } from 'next/server';
import { requireKey, rhPost } from '../../../lib/runninghub';

export async function GET() {
  try {
    const key = requireKey();

    const result: any = await rhPost(
      '/uc/openapi/accountStatus',
      { apikey: key },
      key
    );

    const data = result?.data;

    if (!data) {
      return NextResponse.json(
        { ok: false, message: 'Data saldo tidak ditemukan.' },
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
    const message = error instanceof Error
      ? error.message
      : 'Gagal memeriksa saldo RunningHub.';

    return NextResponse.json(
      { ok: false, message },
      { status: 500 }
    );
  }
}
