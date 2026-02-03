'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface Member {
  id: number;
  name: string;
  emoji: string;
}

interface TodayStatus {
  [key: string]: boolean;
}

export default function CheckInPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [todayStatus, setTodayStatus] = useState<TodayStatus>({});
  const [loading, setLoading] = useState(false);
  const [clickedMember, setClickedMember] = useState<string | null>(null);
  const today = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    loadMembers();
    loadTodayStatus();
  }, []);

  const loadMembers = async () => {
    const { data } = await supabase
      .from('members')
      .select('*')
      .order('name');
    
    if (data) setMembers(data);
  };

  const loadTodayStatus = async () => {
    const { data } = await supabase
      .from('attendance')
      .select('member_name')
      .eq('check_in_date', today);
    
    if (data) {
      const status: TodayStatus = {};
      data.forEach(record => {
        status[record.member_name] = true;
      });
      setTodayStatus(status);
    }
  };

  const handleCheckIn = async (memberName: string) => {
    if (todayStatus[memberName]) return;
    
    setLoading(true);
    setClickedMember(memberName);
    
    try {
      const { error } = await supabase
        .from('attendance')
        .insert({
          member_name: memberName,
          check_in_date: today,
        });
      
      if (error) {
        if (error.code === '23505') {
          alert(`${memberName}님은 오늘 이미 인증하셨습니다! ✅`);
        } else {
          throw error;
        }
      } else {
        setTodayStatus(prev => ({ ...prev, [memberName]: true }));
        
        // 성공 애니메이션
        setTimeout(() => {
          setClickedMember(null);
        }, 1000);
      }
    } catch (err) {
      console.error(err);
      alert('오류가 발생했습니다.');
      setClickedMember(null);
    } finally {
      setLoading(false);
    }
  };

  const checkedInCount = Object.values(todayStatus).filter(Boolean).length;
  const progress = members.length > 0 ? (checkedInCount / members.length) * 100 : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50">
      {/* 헤더 */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-amber-100 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                📚 앙그뇌방
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {format(new Date(), 'PPP EEEE', { locale: ko })}
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-amber-600">{checkedInCount}/{members.length}</div>
              <div className="text-xs text-gray-500">인증 완료</div>
            </div>
          </div>
          
          {/* 프로그레스 바 */}
          <div className="mt-4 bg-gray-200 rounded-full h-2 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-1000 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        
        {/* 안내 메시지 */}
        <div className="mb-8 p-4 bg-white/60 backdrop-blur-sm rounded-2xl border border-amber-200">
          <p className="text-center text-gray-700">
            ✍️ 오늘 필사를 완료하셨나요? <br className="md:hidden" />
            <span className="font-bold text-amber-600">본인 이름을 눌러주세요!</span>
          </p>
        </div>

        {/* 체크인 버튼들 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          {members.map(member => {
            const isCheckedIn = todayStatus[member.name];
            const isAnimating = clickedMember === member.name;
            
            return (
              <button
                key={member.id}
                onClick={() => handleCheckIn(member.name)}
                disabled={loading || isCheckedIn}
                className={`
                  group relative overflow-hidden
                  p-6 rounded-3xl font-bold text-lg
                  transition-all duration-300 ease-out
                  ${isCheckedIn
                    ? 'bg-gradient-to-br from-green-400 to-emerald-500 text-white shadow-lg shadow-green-200'
                    : 'bg-white hover:bg-gradient-to-br hover:from-amber-400 hover:to-orange-400 text-gray-800 hover:text-white shadow-md hover:shadow-xl hover:shadow-amber-200'
                  }
                  ${isAnimating ? 'scale-110 rotate-3' : 'scale-100 hover:scale-105'}
                  ${loading && !isCheckedIn ? 'opacity-50 cursor-wait' : ''}
                  ${isCheckedIn ? 'cursor-default' : 'cursor-pointer active:scale-95'}
                `}
              >
                {/* 배경 그라데이션 효과 */}
                <div className={`
                  absolute inset-0 bg-gradient-to-br from-amber-300/20 to-orange-300/20
                  opacity-0 group-hover:opacity-100 transition-opacity duration-300
                  ${isCheckedIn ? 'hidden' : ''}
                `} />
                
                {/* 체크 완료 배지 */}
                {isCheckedIn && (
                  <div className="absolute -top-2 -right-2 bg-white rounded-full p-2 shadow-lg animate-bounce">
                    <span className="text-2xl">✅</span>
                  </div>
                )}
                
                {/* 컨텐츠 */}
                <div className="relative z-10 flex flex-col items-center gap-3">
                  <span className="text-5xl transform group-hover:scale-110 transition-transform duration-300">
                    {member.emoji}
                  </span>
                  <span className="text-xl">{member.name}</span>
                  
                  {isCheckedIn && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="bg-white/90 backdrop-blur-sm rounded-2xl px-4 py-2">
                        <span className="text-sm font-semibold text-green-600">
                          인증 완료! 🎉
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Ripple 효과 */}
                {isAnimating && (
                  <span className="absolute inset-0 animate-ping bg-amber-400 opacity-75 rounded-3xl" />
                )}
              </button>
            );
          })}
        </div>

        {/* 오늘의 현황 */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl p-6 border border-amber-100">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-800">
              📊 오늘의 현황
            </h2>
            <div className="flex gap-2">
              <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                {checkedInCount}명 완료
              </span>
              {members.length - checkedInCount > 0 && (
                <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm font-medium">
                  {members.length - checkedInCount}명 대기
                </span>
              )}
            </div>
          </div>
          
          <div className="space-y-3">
            {members.map(member => {
              const isCheckedIn = todayStatus[member.name];
              
              return (
                <div 
                  key={member.id} 
                  className={`
                    flex items-center justify-between p-4 rounded-2xl
                    transition-all duration-300
                    ${isCheckedIn 
                      ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200' 
                      : 'bg-gray-50 border-2 border-transparent'
                    }
                  `}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{member.emoji}</span>
                    <span className={`font-medium ${isCheckedIn ? 'text-green-700' : 'text-gray-700'}`}>
                      {member.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {isCheckedIn ? (
                      <>
                        <span className="px-3 py-1 bg-green-500 text-white rounded-full text-sm font-bold">
                          완료
                        </span>
                        <span className="text-xl">🎉</span>
                      </>
                    ) : (
                      <span className="px-3 py-1 bg-gray-200 text-gray-500 rounded-full text-sm">
                        대기중
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 통계 링크 */}
        <div className="mt-8 text-center">
          
            <a href="/stats"
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold rounded-2xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300"
          >
            <span>📈</span>
            <span>이번 주 통계 보기</span>
            <span>→</span>
          </a>
        </div>
      </div>
    </div>
  );
}