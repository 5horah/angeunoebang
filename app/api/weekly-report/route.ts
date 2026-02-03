// app/api/weekly-report/route.ts
import { supabase } from '@/lib/supabase';
import { startOfWeek, format, subDays } from 'date-fns';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    // 지난 주 월~금 계산
    const today = new Date();
    const lastSaturday = subDays(today, (today.getDay() + 1) % 7 || 7);
    const lastMonday = startOfWeek(lastSaturday, { weekStartsOn: 1 });
    const lastFriday = subDays(lastSaturday, 1);

    // 출석 데이터 조회
    const { data, error } = await supabase
      .from('attendance')
      .select('member_name')
      .gte('check_in_date', format(lastMonday, 'yyyy-MM-dd'))
      .lte('check_in_date', format(lastFriday, 'yyyy-MM-dd'));

    if (error) throw error;

    // 집계
    const counts: { [key: string]: number } = {};
    data?.forEach(record => {
      counts[record.member_name] = (counts[record.member_name] || 0) + 1;
    });

    // 정렬
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

    // 리포트 생성
    let report = '📊 이번 주 필사 출석부\n\n';
    
    sorted.forEach(([name, count]) => {
      const emoji = count === 5 ? '🏆' : count >= 3 ? '✅' : '📝';
      report += `${emoji} ${name}: ${count}회\n`;
    });

    const total = Object.values(counts).reduce((sum, c) => sum + c, 0);
    const avg = sorted.length > 0 ? total / sorted.length : 0;
    const perfect = sorted.filter(([_, c]) => c === 5).length;

    report += `\n👥 참여: ${sorted.length}명\n`;
    report += `📈 평균: ${avg.toFixed(1)}회\n`;
    if (perfect > 0) {
      report += `🏆 퍼펙트: ${perfect}명\n`;
    }
    report += `\n💪 다음 주도 화이팅!`;

    return NextResponse.json({
      success: true,
      report,
      stats: counts,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { success: false, error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}