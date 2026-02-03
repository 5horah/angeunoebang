'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { startOfWeek, endOfWeek, format, subDays } from 'date-fns';
import { ko } from 'date-fns/locale';

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
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">통계를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  const sortedStats = Object.entries(stats).sort((a, b) => b[1] - a[1]);
  const total = Object.values(stats).reduce((sum, count) => sum + count, 0);
  const avg = sortedStats.length > 0 ? total / sortedStats.length : 0;
  const perfectCount = sortedStats.filter(([_, count]) => count === 5).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* 헤더 */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-blue-100">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent text-center">
            📊 이번 주 통계
          </h1>
          <p className="text-center text-gray-600 mt-2">
            {format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'M월 d일', { locale: ko })} - {format(subDays(endOfWeek(new Date(), { weekStartsOn: 1 }), 2), 'M월 d일', { locale: ko })}
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        
        {/* 통계 카드 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl p-6 border-2 border-yellow-200 transform hover:scale-105 transition-all duration-300">
            <div className="text-4xl mb-2">👥</div>
            <div className="text-3xl font-bold text-yellow-600">{sortedStats.length}</div>
            <div className="text-sm text-gray-600 font-medium">참여 인원</div>
          </div>
          
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl p-6 border-2 border-blue-200 transform hover:scale-105 transition-all duration-300">
            <div className="text-4xl mb-2">📈</div>
            <div className="text-3xl font-bold text-blue-600">{avg.toFixed(1)}회</div>
            <div className="text-sm text-gray-600 font-medium">평균 인증</div>
          </div>
          
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl p-6 border-2 border-green-200 transform hover:scale-105 transition-all duration-300">
            <div className="text-4xl mb-2">🏆</div>
            <div className="text-3xl font-bold text-green-600">{perfectCount}명</div>
            <div className="text-sm text-gray-600 font-medium">완벽 출석</div>
          </div>
        </div>

        {/* 순위 */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl p-6 border border-blue-100">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
            <span>🎯</span>
            <span>개인별 인증 횟수</span>
          </h2>
          
          <div className="space-y-4">
            {sortedStats.map(([name, count], index) => {
              const isFirst = index === 0;
              const isPerfect = count === 5;
              
              return (
                <div 
                  key={name} 
                  className={`
                    relative flex items-center justify-between p-5 rounded-2xl
                    transition-all duration-300 transform hover:scale-102
                    ${isFirst 
                      ? 'bg-gradient-to-r from-yellow-100 to-amber-100 border-2 border-yellow-400 shadow-lg' 
                      : isPerfect
                      ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300'
                      : 'bg-gray-50 border-2 border-gray-200'
                    }
                  `}
                >
                  {/* 순위 배지 */}
                  <div className={`
                    flex items-center justify-center w-12 h-12 rounded-full font-bold text-lg
                    ${isFirst 
                      ? 'bg-gradient-to-br from-yellow-400 to-amber-500 text-white shadow-lg' 
                      : 'bg-white text-gray-600 border-2 border-gray-300'
                    }
                  `}>
                    {isFirst ? '👑' : `#${index + 1}`}
                  </div>
                  
                  {/* 이름 */}
                  <div className="flex-1 ml-4">
                    <div className="font-bold text-lg text-gray-800">{name}</div>
                    {isPerfect && (
                      <div className="text-sm text-green-600 font-medium">완벽 출석!</div>
                    )}
                  </div>
                  
                  {/* 별 표시 */}
                  <div className="flex gap-1 mr-4">
                    {[...Array(5)].map((_, i) => (
                      <span key={i} className="text-2xl">
                        {i < count ? '⭐' : '☆'}
                      </span>
                    ))}
                  </div>
                  
                  {/* 횟수 */}
                  <div className={`
                    px-4 py-2 rounded-xl font-bold text-lg
                    ${isFirst 
                      ? 'bg-gradient-to-r from-yellow-500 to-amber-600 text-white' 
                      : isPerfect
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-200 text-gray-700'
                    }
                  `}>
                    {count}회
                  </div>
                  
                  {/* 트로피 */}
                  {isPerfect && (
                    <div className="absolute -top-3 -right-3 text-4xl animate-bounce">
                      🏆
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 격려 메시지 */}
        <div className="mt-8 p-6 bg-gradient-to-r from-purple-500 to-pink-500 rounded-3xl shadow-xl text-white text-center">
          <p className="text-2xl font-bold mb-2">💪 다음 주도 화이팅!</p>
          <p className="text-purple-100">꾸준함이 만드는 변화, 함께 만들어가요</p>
        </div>

        {/* 돌아가기 버튼 */}
        <div className="mt-8 text-center">
          
            <a href="/"
            className="inline-flex items-center gap-2 px-8 py-4 bg-white hover:bg-gray-50 text-gray-800 font-bold rounded-2xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300"
          >
            <span>←</span>
            <span>체크인 페이지로 돌아가기</span>
          </a>
        </div>
      </div>
    </div>
  );
}