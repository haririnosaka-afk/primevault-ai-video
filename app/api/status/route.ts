
import { NextRequest, NextResponse } from 'next/server';
import { HOST, requireKey } from '@/lib/runninghub';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const taskId = req.nextUrl.searchParams.get('taskId');

    if (!taskId) {
      return NextResponse.json(
        { error: 'taskId wajib diisi.' },
        { status: 400 }
      );
    }

    const key = requireKey();

    const response = await fetch(
      `${HOST}/task/openapi/outputs`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          apiKey: key,
          taskId
        }),
        cache: 'no-store'
      }
    );

    const result: any = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        {
          status: 'FAILED',
          error: result?.msg || `RunningHub HTTP ${response.status}`
        },
        { status: 502 }
      );
    }

    const code = Number(result?.code);
    const data = Array.isArray(result?.data)
      ? result.data
      : [];

    // Task masih dalam antrean.
    if (code === 813) {
      return NextResponse.json({
        status: 'QUEUED',
        videos: [],
        files: [],
        consumeCoins: null
      });
    }

    // Task masih diproses.
    if (code === 804) {
      return NextResponse.json({
        status: 'RUNNING',
        videos: [],
        files: [],
        consumeCoins: null
      });
    }

    // Task gagal.
    if (code !== 0 && code !== 200) {
      const reason =
        result?.data?.failedReason ||
        result?.msg ||
        'Task gagal diproses.';

      return NextResponse.json({
        status: 'FAILED',
        failed: true,
        error: typeof reason === 'string'
          ? reason
          : JSON.stringify(reason),
        videos: [],
        files: [],
        consumeCoins: null
      });
    }

    const files = data
      .filter((item: any) => item?.fileUrl)
      .map((item: any) => item.fileUrl);

    const videos = data
      .filter((item: any) =>
        /mp4|video/i.test(
          `${item?.fileType || ''} ${item?.fileUrl || ''}`
        )
      )
      .map((item: any) => item.fileUrl);

    const coinValues = data
      .map((item: any) => Number(item?.consumeCoins))
      .filter((value: number) => Number.isFinite(value));

    const consumeCoins = coinValues.length
      ? coinValues.reduce((total: number, value: number) => total + value, 0)
      : null;

    // Jangan anggap sukses sebelum hasil benar-benar tersedia.
    if (!files.length) {
      return NextResponse.json({
        status: 'RUNNING',
        videos: [],
        files: [],
        consumeCoins
      });
    }

    return NextResponse.json({
      status: 'SUCCESS',
      videos,
      files,
      consumeCoins
    });

  } catch (error) {
    return NextResponse.json(
      {
        status: 'FAILED',
        error: error instanceof Error
          ? error.message
          : 'Status error'
      },
      { status: 500 }
    );
  }
}
