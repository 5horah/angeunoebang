'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { startOfWeek, endOfWeek, format, subDays } from 'date-fns';
import { ko } from 'date-fns/locale';

interface WeeklyStats {
  [key: string]: number;
}

interface AttendanceItem {
  member_name: string;
  check_in_date: string;
  created_at: string;
  image_url: string | null;
  reason: string | null;
}

export default function StatsPage() {
  const [stats, setStats] = useState<WeeklyStats>({});
  const [weeklyItems, setWeeklyItems] = useState<AttendanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [modalImage, setModalImage] = useState<string | null>(null);
  const [modalReason, setModalReason] = useState<{ name: string; date: string; text: string } | null>(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const slideRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);

  useEffect(() => {
    loadWeeklyStats();
  }, []);

  const loadWeeklyStats = async () => {
    const today = new Date();
    const monday = startOfWeek(today, { weekStartsOn: 1 });
    const friday = subDays(endOfWeek(today, { weekStartsOn: 1 }), 2);
    const mondayStr = format(monday, 'yyyy-MM-dd');
    const fridayStr = format(friday, 'yyyy-MM-dd');

    const { data } = await supabase
      .from('attendance')
      .select('member_name, check_in_date, image_url, reason, created_at')
      .gte('check_in_date', mondayStr)
      .lte('check_in_date', fridayStr)
      .order('created_at', { ascending: false });

    if (data) {
      const counts: WeeklyStats = {};
      data.forEach((record) => {
        counts[record.member_name] = (counts[record.member_name] || 0) + 1;
      });
      setStats(counts);

      const items = data
        .filter(
          (r): r is AttendanceItem =>
            (r.image_url != null && r.image_url !== '') || (r.reason != null && r.reason !== '')
        )
        .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
      setWeeklyItems(items);
    }

    setLoading(false);
  };

  const handleSlideSwipe = () => {
    const diff = touchStartX.current - touchEndX.current;
    const threshold = 50;
    if (Math.abs(diff) < threshold) return;
    if (diff > 0) {
      setSlideIndex((i) => (i >= weeklyItems.length - 1 ? 0 : i + 1));
    } else {
      setSlideIndex((i) => (i <= 0 ? weeklyItems.length - 1 : i - 1));
    }
  };

  const generateReportText = () => {
    const sortedStats = Object.entries(stats).sort((a, b) => b[1] - a[1]);

    if (sortedStats.length === 0) {
      return '📖 앙그뇌방 이번 주 필사 출석부\n\n아직 인증 기록이 없습니다.';
    }

    let report = '📖 앙그뇌방 이번 주 필사 출석부\n\n';

    sortedStats.forEach(([name, count]) => {
      const marker = count === 5 ? '🏆' : count >= 3 ? '✅' : '';
      report += `${name}: ${count}회 ${marker}\n`;
    });

    const total = Object.values(stats).reduce((sum, count) => sum + count, 0);
    const avg = sortedStats.length > 0 ? total / sortedStats.length : 0;
    const perfectCount = sortedStats.filter(([_, count]) => count === 5).length;

    report += `\n👥 참여: ${sortedStats.length}명\n`;
    report += `📈 평균: ${avg.toFixed(1)}회\n`;

    if (perfectCount > 0) {
      report += `🏆 완벽 출석: ${perfectCount}명\n`;
    }

    report += `\n💪 다음 주도 화이팅!`;

    return report;
  };

  const handleCopyToClipboard = async () => {
    const report = generateReportText();

    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.error('클립보드 복사 실패:', err);

      const textarea = document.createElement('textarea');
      textarea.value = report;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();

      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      } catch (fallbackErr) {
        alert('복사 실패. 브라우저를 업데이트해주세요.');
      }

      document.body.removeChild(textarea);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent border-t-transparent mx-auto mb-3"></div>
          <p className="text-sm text-gray-text">통계를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  const sortedStats = Object.entries(stats).sort((a, b) => b[1] - a[1]);
  const total = Object.values(stats).reduce((sum, count) => sum + count, 0);
  const avg = sortedStats.length > 0 ? total / sortedStats.length : 0;
  const perfectCount = sortedStats.filter(([_, count]) => count === 5).length;

  return (
    <div className="min-h-screen bg-white">
      {/* 복사 완료 알림 */}
      {copied && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 animate-slide-down">
          <div className="bg-success text-white px-4 py-2 rounded-md shadow-lg flex items-center gap-2 text-sm">
            <span>✓</span>
            <span>클립보드에 복사되었습니다</span>
          </div>
        </div>
      )}

      {/* 헤더 */}
      <div className="border-b border-gray-border">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">📖</span>
            <h1 className="text-xl font-bold text-text-primary">앙그뇌방</h1>
          </div>
          <p className="text-sm text-text-muted">
            앙큼한 그녀들의 뇌가 섹시해지는 방법
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-4">
        <p className="text-sl font-semibold text-text-primary mb-1">
            이번 주 통계
        </p>
          {/* 기간 표시 */}
        <p className="text-sm text-text-muted">
          {format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'M월 d일', { locale: ko })}
          {' - '}
          {format(subDays(endOfWeek(new Date(), { weekStartsOn: 1 }), 2), 'M월 d일', { locale: ko })}
        </p>
        {/* 통계 카드 */}
        <div className="grid grid-cols-3 gap-3 my-6">
          <div className="p-4 bg-gray-panel rounded-lg">
            <div className="text-2xl font-bold text-text-primary">{sortedStats.length}</div>
            <div className="text-xs text-text-muted mt-1">참여 인원</div>
          </div>

          <div className="p-4 bg-gray-panel rounded-lg">
            <div className="text-2xl font-bold text-text-primary">{avg.toFixed(1)}회</div>
            <div className="text-xs text-text-muted mt-1">평균 인증</div>
          </div>

          <div className="p-4 bg-gray-panel rounded-lg">
            <div className="text-2xl font-bold text-text-primary">{perfectCount}명</div>
            <div className="text-xs text-text-muted mt-1">완벽 출석</div>
          </div>
        </div>

        {/* 순위 테이블 */}
        <div className="bg-gray-panel rounded-lg mb-6 py-4">
          <div className="px-4 pb-3">
            <h2 className="text-sm font-semibold text-text-primary">개인별 인증 횟수</h2>
          </div>

          {sortedStats.length > 0 ? (
            <div>
              {sortedStats.map(([name, count], index) => {
                const isPerfect = count === 5;

                return (
                  <div
                    key={name}
                    className="flex items-center justify-between px-4 py-2"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 text-sm text-text-muted">
                        {index + 1}
                      </span>
                      <span className="text-sm text-text-primary">{name}</span>
                      {isPerfect && ( 
                        <span className="px-1.5 py-0.5 bg-success-light text-success-num rounded text-xs">
                          완벽
                        </span>
                      )} 
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex gap-0.5">
                        {[...Array(5)].map((_, i) => (
                          <div
                            key={i}
                            className={`w-2 h-2 rounded-full ${
                              i < count ? 'bg-primary' : 'bg-gray-border-light'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-sm font-medium text-text-primary w-8 text-right">
                        {count}회
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-text">
              <p className="text-sm">아직 인증 기록이 없습니다</p>
            </div>
          )}
        </div>

        {/* 클립보드 복사 버튼 */}
        <button
          type="button"
          onClick={handleCopyToClipboard}
          disabled={sortedStats.length === 0}
          className={`w-full py-3 rounded-md text-sm font-medium cursor-pointer transition-colors mb-2 ${
            sortedStats.length > 0
              ? 'bg-primary text-white'
              : 'bg-gray-border text-gray-text cursor-not-allowed'
          }`}
        >
          카톡으로 공유하기
        </button>

        <p className="text-center text-xs text-gray-text-light mb-8">
          버튼을 누르면 클립보드에 복사됩니다
        </p>

        {/* 이번 주 인증 슬라이드 (사진 + 사유) */}
        {weeklyItems.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-text-primary mb-3">이번 주 인증</h2>
            <div className="relative">
              <div
                ref={slideRef}
                className="overflow-hidden rounded-lg border border-gray-border-alt select-none"
                onTouchStart={(e) => { touchStartX.current = e.targetTouches[0].clientX; }}
                onTouchEnd={(e) => {
                  touchEndX.current = e.changedTouches[0].clientX;
                  handleSlideSwipe();
                }}
              >
                <div
                  className="flex transition-transform duration-300 ease-out"
                  style={{ transform: `translateX(-${slideIndex * 100}%)` }}
                >
                  {weeklyItems.map((item, index) => (
                    <button
                      key={`${item.member_name}-${item.check_in_date}-${index}`}
                      type="button"
                      onClick={() => {
                        if (item.image_url) setModalImage(item.image_url);
                        else if (item.reason) setModalReason({ name: item.member_name, date: item.check_in_date, text: item.reason });
                      }}
                      className="flex-shrink-0 w-full text-left focus:outline-none focus:ring-2 focus:ring-accent focus:ring-inset rounded-lg"
                    >
                      {item.image_url ? (
                        <>
                          <div className="aspect-[4/3] bg-gray-panel relative">
                            <img
                              src={item.image_url}
                              alt={`${item.member_name} ${item.check_in_date}`}
                              className="w-full h-full object-contain"
                              draggable={false}
                            />
                          </div>
                          <div className="px-3 py-2 bg-white border-t border-gray-border">
                            <p className="text-sm font-medium text-foreground">{item.member_name}</p>
                            <p className="text-xs text-gray-text">
                              {format(new Date(item.check_in_date), 'M월 d일', { locale: ko })}
                            </p>
                          </div>
                        </>
                      ) : (
                        <div className="aspect-[4/3] bg-gray-light flex flex-col items-center justify-center px-4 border-b border-gray-border">
                          <span className="text-2xl mb-2">
                            {item.reason === '슈퍼 면제권' ? '⭐' : '✏️'}
                          </span>
                          <p className="text-sm text-foreground line-clamp-3 text-center">
                            {item.reason === '슈퍼 면제권' ? '슈퍼 면제권 사용' : item.reason}
                          </p>
                        </div>
                      )}
                      {!item.image_url && item.reason && (
                        <div className="px-3 py-2 bg-white border-t border-gray-border-alt">
                          <p className="text-sm font-medium text-foreground">{item.member_name}</p>
                          <p className="text-xs text-gray-text">
                            {format(new Date(item.check_in_date), 'M월 d일', { locale: ko })}
                          </p>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* 이전/다음 버튼 */}
              {weeklyItems.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => setSlideIndex((i) => (i <= 0 ? weeklyItems.length - 1 : i - 1))}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 shadow-md flex items-center justify-center text-foreground cursor-pointer"
                    aria-label="이전"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    onClick={() => setSlideIndex((i) => (i >= weeklyItems.length - 1 ? 0 : i + 1))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 shadow-md flex items-center justify-center text-foreground cursor-pointer"
                    aria-label="다음"
                  >
                    ›
                  </button>
                </>
              )}

              {/* 인디케이터 점 */}
              {weeklyItems.length > 1 && (
                <div className="flex justify-center gap-1.5 mt-2">
                  {weeklyItems.map((_, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setSlideIndex(index)}
                      className={`w-2 h-2 rounded-full transition-colors cursor-pointer ${
                        index === slideIndex ? 'bg-primary' : 'bg-gray-border-light'
                      }`}
                      aria-label={`${index + 1}번째`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 이미지 확대 모달 */}
        {modalImage && (
          <div
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
            onClick={() => setModalImage(null)}
          >
            <div className="relative max-w-3xl max-h-[90vh]">
              <img
                src={modalImage}
                alt="인증 사진"
                className="max-w-full max-h-[90vh] object-contain rounded-lg"
                onClick={(e) => e.stopPropagation()}
              />
              <button
                type="button"
                onClick={() => setModalImage(null)}
                className="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full flex items-center justify-center text-foreground shadow-lg cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* 사유 보기 모달 */}
        {modalReason && (
          <div
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
            onClick={() => setModalReason(null)}
          >
            <div
              className="bg-white rounded-lg shadow-xl max-w-sm w-full p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-xs text-gray-text mb-1">
                {modalReason.name} · {format(new Date(modalReason.date), 'M월 d일', { locale: ko })}
              </p>
              <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                {modalReason.text}
              </p>
              <button
                type="button"
                onClick={() => setModalReason(null)}
                className="mt-4 w-full py-2 text-sm font-medium text-accent border border-accent rounded-md"
              >
                닫기
              </button>
            </div>
          </div>
        )}

        {/* 돌아가기 */}
        <div className="text-center border-t border-gray-border pt-6">
          <a
            href="/"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-primary-hover rounded-md"
          >
            <span>←</span>
            <span>체크인 페이지로 돌아가기</span>
          </a>
        </div>
      </div>
    </div>
  );
}
