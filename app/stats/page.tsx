'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { startOfWeek, endOfWeek, format, subDays } from 'date-fns';

interface WeeklyStats {
  [key: string]: number;
}

export default function StatsPage() {
  const [stats, setStats] = useState<WeeklyStats>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWeeklyStats();
  }, []);

  const loadWeeklyStats = async () => {
    const today = new Date();
    const monday = startOfWeek(today, { weekStartsOn: 1 });
    const friday = subDays(endOfWeek(today, { weekStartsOn: 1 }), 2);

    const { data } = await supabase
      .from('attendance')
      .select('member_name')
      .gte('check_in_date', format(monday, 'yyyy-MM-dd'))
      .lte('check_in_date', format(friday, 'yyyy-MM-dd'));

    if (data) {
      const counts: WeeklyStats = {};
      data.forEach(record => {
        counts[record.member_name] = (counts[record.member_name] || 0) + 1;
      });
      setStats(counts);
    }
    
    setLoading(false);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">로딩중...</div>;
  }

  const sortedStats = Object.entries(stats).sort((a, b) => b[1] - a[1]);
  const total = Object.values(stats).reduce((sum, count) => sum + count, 0);
  const avg = sortedStats.length > 0 ? total / sortedStats.length : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            이번 주 필사 출석부
          </h1>
          <p className="text-gray-600">월요일 - 금요일</p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow-md p-4 text-center">
            <div className="text-2xl font-bold text-yellow-600">{sortedStats.length}</div>
            <div className="text-sm text-gray-600">참여 인원</div>
          </div>
          <div className="bg-white rounded-xl shadow-md p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{avg.toFixed(1)}</div>
            <div className="text-sm text-gray-600">평균 인증</div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">개인별 인증 횟수</h2>
          <div className="space-y-3">
            {sortedStats.map(([name, count]) => (
              <div key={name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="font-medium text-gray-800">{name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-yellow-600">{count}회</span>
                  {count === 5 && <span className="text-2xl">🏆</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 text-center">
          <a href="/" className="inline-block px-6 py-3 bg-yellow-400 hover:bg-yellow-500 text-gray-800 font-bold rounded-lg">
            체크인 페이지로 돌아가기
          </a>
        </div>
      </div>
    </div>
  );
}