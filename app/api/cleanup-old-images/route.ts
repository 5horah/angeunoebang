import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { format, subMonths } from 'date-fns';
import { NextResponse } from 'next/server';

const BUCKET = 'attendance-images';

/** image_url에서 Storage 객체 경로 추출 (attendance/파일명.png) */
function getStoragePathFromUrl(imageUrl: string): string | null {
  const match = imageUrl.match(/\/attendance-images\/(.+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * 한 달이 지난 출석 기록의 이미지 정리:
 * - Storage에서 해당 이미지 파일 삭제
 * - attendance 테이블의 image_url만 NULL로 갱신 (출석 기록은 유지)
 * Vercel Cron으로 월 1회 호출 권장.
 */
export async function GET() {
  try {
    const admin = createSupabaseAdmin();
    const oneMonthAgo = format(subMonths(new Date(), 1), 'yyyy-MM-dd');

    const { data: rows, error: fetchError } = await admin
      .from('attendance')
      .select('id, image_url')
      .lt('check_in_date', oneMonthAgo)
      .not('image_url', 'is', null);

    if (fetchError) throw fetchError;
    if (!rows?.length) {
      return NextResponse.json({
        success: true,
        message: '정리할 이미지가 없습니다.',
        cleaned: 0,
      });
    }

    const pathsToRemove: string[] = [];
    for (const row of rows) {
      const url = row.image_url;
      if (typeof url !== 'string') continue;
      const path = getStoragePathFromUrl(url);
      if (path) pathsToRemove.push(path);
    }

    if (pathsToRemove.length > 0) {
      await admin.storage.from(BUCKET).remove(pathsToRemove);
    }

    const ids = rows.map((r) => r.id);
    const { error: updateError } = await admin
      .from('attendance')
      .update({ image_url: null })
      .in('id', ids);

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      message: `${ids.length}건 이미지 정리 완료 (기준: ${oneMonthAgo} 이전)`,
      cleaned: ids.length,
      storageRemoved: pathsToRemove.length,
    });
  } catch (err) {
    console.error('cleanup-old-images error:', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to cleanup old images',
      },
      { status: 500 }
    );
  }
}
