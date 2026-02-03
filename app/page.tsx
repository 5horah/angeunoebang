'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';

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
  const today = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    loadMembers();
    loadTodayStatus();
  }, []);

  const loadMembers = async () => {
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .order('name');
    
    if (data) setMembers(data);
  };

  const loadTodayStatus = async () => {
    const { data, error } = await supabase
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
    setLoading(true);
    
    try {
      const { data, error } = await supabase
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
        
        setTimeout(() => {
          alert(`✅ ${memberName}님 오늘 필사 인증 완료!\n내일도 화이팅! 💪`);
        }, 100);
      }
    } catch (err) {
      console.error(err);
      alert('오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-white to-yellow-50">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            📚 필사 모임 출석부
          </h1>
          <p className="text-gray-600">
            {format(new Date(), 'yyyy년 MM월 dd일')}
          </p>
          <p className="text-sm text-gray-500 mt-2">
            오늘 필사를 완료하셨나요? 버튼을 눌러주세요!
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {members.map(member => {
            const isCheckedIn = todayStatus[member.name];
            
            return (
              <button
                key={member.id}
                onClick={() => handleCheckIn(member.name)}
                disabled={loading || isCheckedIn}
                className={`
                  relative p-6 rounded-2xl font-bold text-xl
                  transition-all duration-300 transform
                  ${isCheckedIn
                    ? 'bg-green-100 text-green-700 cursor-not-allowed'
                    : 'bg-yellow-400 text-gray-800 hover:bg-yellow-500 hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl'
                  }
                  ${loading ? 'opacity-50 cursor-wait' : ''}
                `}
              >
                <div className="flex items-center justify-between">
                  <span className="text-3xl">{member.emoji}</span>
                  <span>{member.name}</span>
                  {isCheckedIn && (
                    <span className="text-2xl">✅</span>
                  )}
                </div>
                
                {isCheckedIn && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-normal text-green-600">
                      인증 완료!
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">
            📊 오늘의 인증 현황
          </h2>
          <div className="space-y-2">
            {members.map(member => (
              <div key={member.id} className="flex items-center justify-between py-2 border-b last:border-b-0">
                <span className="text-gray-700">
                  {member.emoji} {member.name}
                </span>
                <span>
                  {todayStatus[member.name] ? (
                    <span className="text-green-600 font-medium">✅ 완료</span>
                  ) : (
                    <span className="text-gray-400">⏳ 대기중</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 text-center">
          
            href="/stats"
            className="text-yellow-600 hover:text-yellow-700 font-medium underline"
          >
            📈 이번 주 통계 보기
          </a>
        </div>
      </div>
    </div>
  );
}