'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { format, startOfWeek, endOfWeek, subDays, parseISO, eachDayOfInterval } from 'date-fns';
import { ko } from 'date-fns/locale';

const SUPER_EXEMPTION_REASON = '슈퍼 면제권';

interface Member {
  id: number;
  name: string;
  emoji: string;
}

interface TodayStatus {
  [key: string]: {
    checked: boolean;
    imageUrl?: string;
    reason?: string;
  };
}

interface ReasonPeriod {
  id: number;
  member_name: string;
  start_date: string;
  end_date: string;
  default_reason: string;
}

export default function CheckInPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [todayStatus, setTodayStatus] = useState<TodayStatus>({});
  const [loading, setLoading] = useState(false);
  const [showRules, setShowRules] = useState(false);

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

  // 이미지 관련 상태
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalScrollRef = useRef<HTMLDivElement>(null);
  const [modalContentOverflows, setModalContentOverflows] = useState(false);

  // 이미지 확대 모달
  const [showImageModal, setShowImageModal] = useState(false);
  const [modalImage, setModalImage] = useState<string | null>(null);

  // 인증 방식: 사진 / 사유 / 슈퍼 면제권
  const [certifyMode, setCertifyMode] = useState<'image' | 'reason' | 'super'>('image');
  const [reasonText, setReasonText] = useState('');
  const [reasonCertifyStart, setReasonCertifyStart] = useState('');
  const [reasonCertifyEnd, setReasonCertifyEnd] = useState('');
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [modalReasonText, setModalReasonText] = useState('');
  const [usedSuperExemptionThisWeek, setUsedSuperExemptionThisWeek] = useState(false);
  const [superExemptionChecking, setSuperExemptionChecking] = useState(false);

  // 사유 기간: 해당 기간 각 날짜마다 출석 저장 + 저장된 기간 목록 관리
  const [periodSaving, setPeriodSaving] = useState(false);
  const [memberReasonPeriods, setMemberReasonPeriods] = useState<ReasonPeriod[]>([]);
  const [showReasonPeriodManage, setShowReasonPeriodManage] = useState(false);
  const [periodsLoading, setPeriodsLoading] = useState(false);

  const today = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    loadMembers();
    loadTodayStatus();
  }, []);

  // 팝업 열릴 때 body 스크롤 막기
  const modalOpen = showConfirmModal || showImageModal || showReasonModal;
  useEffect(() => {
    if (modalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [modalOpen]);

  // 팝업 내용이 최대 높이를 넘으면 하단에 border-top 표시
  useEffect(() => {
    if (!showConfirmModal || !selectedMember) {
      setModalContentOverflows(false);
      return;
    }
    const timer = setTimeout(() => {
      const el = modalScrollRef.current;
      setModalContentOverflows(Boolean(el && el.scrollHeight > el.clientHeight));
    }, 0);
    return () => clearTimeout(timer);
  }, [showConfirmModal, selectedMember, certifyMode]);

  useEffect(() => {
    if (!showConfirmModal || !selectedMember) {
      setUsedSuperExemptionThisWeek(false);
      setShowReasonPeriodManage(false);
      return;
    }
    let cancelled = false;
    setSuperExemptionChecking(true);
    const run = async () => {
      const name = selectedMember!.name;
      const now = new Date();
      const monday = startOfWeek(now, { weekStartsOn: 1 });
      const friday = subDays(endOfWeek(now, { weekStartsOn: 1 }), 2);
      const mondayStr = format(monday, 'yyyy-MM-dd');
      const fridayStr = format(friday, 'yyyy-MM-dd');
      const { data } = await supabase
        .from('attendance')
        .select('id')
        .eq('member_name', name)
        .eq('reason', SUPER_EXEMPTION_REASON)
        .gte('check_in_date', mondayStr)
        .lte('check_in_date', fridayStr);
      if (!cancelled) {
        setUsedSuperExemptionThisWeek((data?.length ?? 0) > 0);
        setSuperExemptionChecking(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [showConfirmModal, selectedMember]);

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
      .select('member_name, image_url, reason')
      .eq('check_in_date', today);

    if (data) {
      const status: TodayStatus = {};
      data.forEach(record => {
        status[record.member_name] = {
          checked: true,
          imageUrl: record.image_url ?? undefined,
          reason: record.reason ?? undefined
        };
      });
      setTodayStatus(status);
    }
  };

  const loadMemberReasonPeriods = async () => {
    if (!selectedMember) return;
    setPeriodsLoading(true);
    const { data } = await supabase
      .from('reason_periods')
      .select('id, member_name, start_date, end_date, default_reason')
      .eq('member_name', selectedMember.name)
      .order('start_date', { ascending: false });
    setMemberReasonPeriods(Array.isArray(data) ? data : []);
    setPeriodsLoading(false);
  };

  const handleButtonClick = (member: Member) => {
    if (todayStatus[member.name]?.checked) return;

    setSelectedMember(member);
    setShowConfirmModal(true);
    setSelectedImage(null);
    setImagePreview(null);
    setCertifyMode('image');
    setReasonText('');
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // 파일 크기 체크 (5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('이미지 크기는 5MB 이하로 선택해주세요.');
        return;
      }

      setSelectedImage(file);

      // 미리보기 생성
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async (file: File, memberName: string): Promise<string | null> => {
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'png';
    // Supabase Storage key는 영숫자, 하이픈, 언더스코어만 허용 (한글·공백 불가)
    const safeName = memberName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `${today}_${safeName}_${Date.now()}.${fileExt}`;
    const filePath = `attendance/${fileName}`;

    const { error } = await supabase.storage
      .from('attendance-images')
      .upload(filePath, file);

    if (error) {
      console.error('이미지 업로드 오류:', error);
      return null;
    }

    const { data } = supabase.storage
      .from('attendance-images')
      .getPublicUrl(filePath);

    return data.publicUrl;
  };

  const handleConfirmCheckIn = async () => {
    const withImage = certifyMode === 'image' && selectedImage;
    const withReason = certifyMode === 'reason' && reasonText.trim().length > 0;
    const withSuper = certifyMode === 'super' && selectedImage;
    if (!selectedMember || (!withImage && !withReason && !withSuper)) {
      if (certifyMode === 'image' || certifyMode === 'super') alert('필사 인증 사진을 선택해주세요!');
      else if (certifyMode === 'reason') alert('사유를 입력해주세요.');
      return;
    }
    if (certifyMode === 'super' && usedSuperExemptionThisWeek) {
      alert('이번 주에는 이미 슈퍼 면제권을 사용하셨습니다.');
      return;
    }

    setLoading(true);
    setUploading(true);

    try {
      let imageUrl: string | null = null;
      if (selectedImage) {
        imageUrl = await uploadImage(selectedImage, selectedMember.name);
      }

      const reasonStr = reasonText.trim();
      const payload: { member_name: string; check_in_date: string; image_url: string | null; reason?: string } = {
        member_name: selectedMember.name,
        check_in_date: today,
        image_url: withReason ? null : imageUrl,
      };
      if (withReason) payload.reason = reasonStr;
      if (withSuper) payload.reason = SUPER_EXEMPTION_REASON;

      const { error } = await supabase.from('attendance').insert(payload);

      if (error) {
        if (error.code === '23505') {
          alert(`${selectedMember.name}님은 오늘 이미 인증하셨습니다!`);
        } else {
          throw error;
        }
      } else {
        setTodayStatus(prev => ({
          ...prev,
          [selectedMember.name]: {
            checked: true,
            imageUrl: imageUrl || undefined,
            reason: withReason ? reasonStr : withSuper ? SUPER_EXEMPTION_REASON : undefined,
          },
        }));

        setShowConfirmModal(false);
        setSelectedMember(null);
        setSelectedImage(null);
        setImagePreview(null);
        setReasonText('');
        setReasonCertifyStart('');
        setReasonCertifyEnd('');
        setCertifyMode('image');
      }
    } catch (err) {
      console.error(err);
      const message = err && typeof err === 'object' && 'message' in err ? String((err as Error).message) : '';
      if (message.includes('reason') || message.includes('column')) {
        alert('오류가 발생했습니다. Supabase attendance 테이블에 reason 컬럼을 추가해 주세요.');
      } else {
        alert('오류가 발생했습니다.');
      }
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  const handleUndo = async (memberName: string) => {
    const confirmed = window.confirm(
      `${memberName}님의 오늘 인증을 취소하시겠습니까?`
    );

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('attendance')
        .delete()
        .eq('member_name', memberName)
        .eq('check_in_date', today);

      if (error) throw error;

      setTodayStatus(prev => {
        const newStatus = { ...prev };
        delete newStatus[memberName];
        return newStatus;
      });

      alert(`${memberName}님의 인증이 취소되었습니다.`);
    } catch (err) {
      console.error(err);
      alert('취소 중 오류가 발생했습니다.');
    }
  };

  const openImageModal = (imageUrl: string) => {
    setModalImage(imageUrl);
    setShowImageModal(true);
  };

  const checkedInCount = Object.values(todayStatus).filter(s => s.checked).length;
  const progress = members.length > 0 ? (checkedInCount / members.length) * 100 : 0;

  return (
    <div className="min-h-screen bg-white">
      {/* 이미지 확대 모달 */}
      {showImageModal && modalImage && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setShowImageModal(false)}
        >
          <div className="relative max-w-3xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <img
              src={modalImage}
              alt="필사 인증"
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
            />
            <button
              type="button"
              onClick={() => setShowImageModal(false)}
              className="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full flex items-center justify-center text-[#37352f] shadow-lg"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 사유 보기 모달 */}
      {showReasonModal && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setShowReasonModal(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-sm w-full p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-[#37352f] mb-2">인증 사유</h3>
            <p className="text-sm text-[#37352f] whitespace-pre-wrap break-words">
              {modalReasonText}
            </p>
            <button
              type="button"
              onClick={() => setShowReasonModal(false)}
              className="mt-4 w-full py-2 text-sm font-medium text-[#2eaadc] border border-[#2eaadc] rounded-md hover:bg-[#f0f9fd]"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 확인 모달 */}
      {showConfirmModal && selectedMember && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => {
            setShowConfirmModal(false);
            setSelectedMember(null);
            setSelectedImage(null);
            setImagePreview(null);
            setReasonText('');
            setReasonCertifyStart('');
            setReasonCertifyEnd('');
            setCertifyMode('image');
          }}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-sm w-full max-h-[90vh] flex flex-col animate-scale-in border border-[#e3e2de]"
            onClick={(e) => e.stopPropagation()}
          >
            <div ref={modalScrollRef} className="flex-1 min-h-0 overflow-y-auto p-6">
            <div className="text-center mb-6">
              <span className="text-5xl">{selectedMember.emoji}</span>
              <h2 className="text-xl font-semibold text-[#37352f] mt-2">
                {selectedMember.name}
              </h2>
            </div>

            {/* 인증 방식 선택 */}
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={() => setCertifyMode('image')}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                  certifyMode === 'image' ? 'bg-[#2B7FFF] text-white' : 'bg-[#F3F4F6] text-[#364153]'
                }`}
              >
                📷 사진
              </button>
              <button
                type="button"
                onClick={() => setCertifyMode('reason')}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                  certifyMode === 'reason' ? 'bg-[#2B7FFF] text-white' : 'bg-[#F3F4F6] text-[#364153]'
                }`}
              >
                ✏️ 사유
              </button>
            </div>
            <button
              type="button"
              onClick={() => !usedSuperExemptionThisWeek && setCertifyMode('super')}
              disabled={usedSuperExemptionThisWeek}
              className={`w-full py-3 text-sm font-medium rounded-md border transition-colors mb-4 ${
                certifyMode === 'super'
                  ? 'bg-[#FEFCE8] border-[#FDC700] text-[#894B00]'
                  : usedSuperExemptionThisWeek
                    ? 'bg-[#F9FAFB] border-[#E5E7EB] text-[#4A5565] cursor-not-allowed'
                    : 'border-[#E5E7EB] text-[#364153]'
              }`}
              title={usedSuperExemptionThisWeek ? '이번 주 이미 사용함' : '주 1회 사용 가능'}
            >
              {superExemptionChecking ? '확인 중...' : usedSuperExemptionThisWeek ? '⭐ 슈퍼 면제권 (이번 주 사용함)' : '⭐ 슈퍼 면제권 (주 1회)'}
            </button>

            {(certifyMode === 'image' || certifyMode === 'super') && (
              /* 이미지 업로드 영역 (사진 인증 / 슈퍼 면제권 공통) */
              <div>
                <p className="text-sm font-medium text-[#0A0A0A] mb-2">
                  필사 인증 사진 <span className="text-[#e03e3e]">*</span>
                </p>
                {imagePreview ? (
                  <div className="relative">
                    <img
                      src={imagePreview}
                      alt="미리보기"
                      className="w-full h-48 object-cover rounded-md border border-[#e3e2de]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedImage(null);
                        setImagePreview(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="absolute top-2 right-2 w-6 h-6 bg-white/90 rounded-full flex items-center justify-center text-[#e03e3e] text-sm"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-48 border-2 border-dashed border-[#D1D5DC] rounded-md flex flex-col items-center justify-center gap-2 hover:bg-[#f7f6f3] transition-colors"
                  >
                    <span className="text-2xl">📷</span>
                    <span className="text-sm text-[#6A7282]">사진 선택하기</span>
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
              </div>
            )}
            {certifyMode === 'reason' && (
              <div className="mb-5 space-y-4">
                <div>
                  <p className="text-sm font-medium text-[#0A0A0A] mb-2">
                    사유 <span className="text-[#e03e3e]">*</span>
                  </p>
                  <textarea
                    value={reasonText}
                    onChange={(e) => setReasonText(e.target.value)}
                    placeholder="예: 병으로 인해 필사 생략"
                    className="w-full min-h-[100px] px-3 py-2 text-sm border border-[#e3e2de] rounded-md resize-y focus:outline-none focus:ring-2 focus:ring-[#2B7FFF] focus:border-transparent"
                    maxLength={500}
                  />
                  <p className="text-xs text-[#6A7282] mt-1">{reasonText.length}/500</p>
                </div>
                <div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="min-w-0">
                      <label className="block text-xs text-[#4A5565] mb-1">시작일</label>
                      <input
                        type="date"
                        min={today}
                        value={reasonCertifyStart}
                        onChange={(e) => setReasonCertifyStart(e.target.value)}
                        className="w-full min-w-0 px-2 py-1.5 text-sm border border-[#e3e2de] rounded focus:outline-none focus:ring-2 focus:ring-[#2B7FFF]"
                      />
                    </div>
                    <div className="min-w-0">
                      <label className="block text-xs text-[#4A5565] mb-1">종료일</label>
                      <input
                        type="date"
                        min={today}
                        value={reasonCertifyEnd}
                        onChange={(e) => setReasonCertifyEnd(e.target.value)}
                        className="w-full min-w-0 px-2 py-1.5 text-sm border border-[#e3e2de] rounded focus:outline-none focus:ring-2 focus:ring-[#2B7FFF]"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={periodSaving || !reasonText.trim() || !reasonCertifyStart || !reasonCertifyEnd}
                    onClick={async () => {
                      if (!selectedMember) return;
                      const start = parseISO(reasonCertifyStart);
                      const end = parseISO(reasonCertifyEnd);
                      if (start > end) {
                        alert('시작일이 종료일보다 늦을 수 없습니다.');
                        return;
                      }
                      setPeriodSaving(true);
                      try {
                        const days = eachDayOfInterval({ start, end });
                        const rows = days.map((d) => ({
                          member_name: selectedMember.name,
                          check_in_date: format(d, 'yyyy-MM-dd'),
                          image_url: null,
                          reason: reasonText.trim(),
                        }));
                        const { error: attErr } = await supabase.from('attendance').upsert(rows, {
                          onConflict: 'member_name,check_in_date',
                        });
                        if (attErr) throw attErr;
                        const { error: periodErr } = await supabase.from('reason_periods').insert({
                          member_name: selectedMember.name,
                          start_date: reasonCertifyStart,
                          end_date: reasonCertifyEnd,
                          default_reason: reasonText.trim(),
                        });
                        if (periodErr) console.error('reason_periods 저장 실패:', periodErr);
                        await loadMemberReasonPeriods();
                        const todayInRange = days.some((d) => format(d, 'yyyy-MM-dd') === today);
                        if (todayInRange) await loadTodayStatus();
                        alert(`${days.length}일치 사유가 저장되었습니다. (${reasonCertifyStart} ~ ${reasonCertifyEnd})`);
                      } catch (err) {
                        console.error(err);
                        alert('저장 중 오류가 발생했습니다.');
                      } finally {
                        setPeriodSaving(false);
                      }
                    }}
                    className="mt-4 w-full py-2 text-sm font-medium text-[#155DFC] border border-[#155DFC] rounded hover:bg-[#f0f9fd] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {periodSaving ? '저장 중...' : '해당 사유 기간 저장'}
                  </button>
                </div>
                <div className="border border-[#e3e2de] rounded-md overflow-hidden mt-3">
                  <button
                    type="button"
                    onClick={async () => {
                      setShowReasonPeriodManage((b) => !b);
                      if (!showReasonPeriodManage) await loadMemberReasonPeriods();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 bg-[#f7f6f3] hover:bg-[#eeeeec] text-left text-sm"
                  >
                    <span className="font-medium text-[#37352f]">저장된 사유 기간 관리</span>
                    <span className="text-[#787774]">{showReasonPeriodManage ? '▲' : '▼'}</span>
                  </button>
                  {showReasonPeriodManage && (
                    <div className="p-3 border-t border-[#e3e2de] max-h-40 overflow-y-auto">
                      {periodsLoading ? (
                        <p className="text-xs text-[#787774]">불러오는 중...</p>
                      ) : memberReasonPeriods.length === 0 ? (
                        <p className="text-xs text-[#787774]">저장된 기간이 없습니다.</p>
                      ) : (
                        <ul className="space-y-2">
                          {memberReasonPeriods.map((p) => (
                            <li key={p.id} className="flex items-start justify-between gap-2 text-xs border-b border-[#e3e2de] pb-2 last:border-0 last:pb-0">
                              <div>
                                <span className="text-[#37352f]">{p.start_date} ~ {p.end_date}</span>
                                <p className="text-[#787774] truncate mt-0.5">{p.default_reason}</p>
                              </div>
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!confirm(`이 사유 기간을 삭제할까요?\n${p.start_date} ~ ${p.end_date} 기간의 출석 기록도 함께 삭제됩니다.`)) return;
                                  const { error: attErr } = await supabase
                                    .from('attendance')
                                    .delete()
                                    .eq('member_name', p.member_name)
                                    .gte('check_in_date', p.start_date)
                                    .lte('check_in_date', p.end_date);
                                  if (attErr) { console.error(attErr); alert('출석 기록 삭제 실패'); return; }
                                  const { error } = await supabase.from('reason_periods').delete().eq('id', p.id);
                                  if (error) { console.error(error); alert('기간 목록 삭제 실패'); return; }
                                  await loadMemberReasonPeriods();
                                  setMemberReasonPeriods((prev) => prev.filter((x) => x.id !== p.id));
                                  const todayInRange = today >= p.start_date && today <= p.end_date;
                                  if (todayInRange) await loadTodayStatus();
                                }}
                                className="text-[#e03e3e] hover:underline shrink-0"
                              >
                                삭제
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
            {certifyMode === 'super' && (
              <div className="mb-5 p-3 bg-[#f7f4eb] border border-[#e3e2de] rounded-md">
                <p className="text-sm text-[#37352f]">
                &quot;<strong>면제권 사용</strong>&quot;을 손글씨로 작성하여 이미지를 올려주세요.
                </p>
              </div>
            )}
            </div>

            {/* 하단 버튼 영역 (고정) - 내용이 넘칠 때만 border-top */}
            <div
              className={`shrink-0 p-6 pt-0 bg-white rounded-b-lg ${
                modalContentOverflows ? 'border-t border-[#E5E7EB] pl-4 pr-4 pb-4 pt-4' : ''
              }`}
            >
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowConfirmModal(false);
                    setSelectedMember(null);
                    setSelectedImage(null);
                    setImagePreview(null);
                    setReasonText('');
                    setReasonCertifyStart('');
                    setReasonCertifyEnd('');
                    setCertifyMode('image');
                    setUsedSuperExemptionThisWeek(false);
                  }}
                  disabled={loading}
                  className="flex-1 px-4 py-2 text-sm font-medium text-[#0A0A0A] bg-white border border-[#e6e6e6] rounded-md hover:bg-[#f7f6f3] transition-colors"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCheckIn}
                  disabled={
                    loading ||
                    (certifyMode === 'image' && !selectedImage) ||
                    (certifyMode === 'reason' && !reasonText.trim()) ||
                    (certifyMode === 'super' && (!selectedImage || usedSuperExemptionThisWeek))
                  }
                  className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    ((certifyMode === 'image' || certifyMode === 'super') && selectedImage) || (certifyMode === 'reason' && reasonText.trim())
                      ? !loading ? 'bg-[#2B7FFF] text-white' : 'bg-[#E5E7EB] text-[#364153] cursor-not-allowed'
                      : 'bg-[#E5E7EB] text-[#364153] cursor-not-allowed'
                  }`}
                >
                  {uploading ? '업로드중...' : loading ? '처리중...' : certifyMode === 'super' ? '면제권 사용' : '인증하기'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 헤더 (고정) - 블러(글래스) 효과 */}
      <div className="border-b border-[#E5E7EB] sticky top-0 z-10 bg-white/70 backdrop-blur-md">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">📖</span>
            <h1 className="text-xl font-bold text-[#0A0A0A]">앙그뇌방</h1>
          </div>
          <p className="text-sm text-[#4A5565]">
            앙큼한 그녀들의 뇌가 섹시해지는 방법
          </p>

          {/* 오늘 날짜 & 진행률 */}
          <div className="flex items-center justify-between mt-4 mb-2">
            <p className="text-sm text-[#0A0A0A]">
              {format(new Date(), 'M월 d일 EEEE', { locale: ko })}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-[#0A0A0A]">{checkedInCount}/{members.length}</span>
              <span className="text-sm text-[#4A5565]">인증 완료</span>
            </div>
          </div>

          <div className="bg-[#F3F4F6] rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full bg-[#2B7FFF] transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* 안내 문구 */}
        <div className="mb-6 p-4 bg-[#F3F4F6] rounded-md border-l-4 border-[#2B7FFF]">
          <p className="text-sm text-[#0A0A0A]">
            오늘 필사를 완료하셨나요? <span className="font-semibold">본인 이름을 눌러 인증하세요!</span>
          </p>
        </div>

        {/* 체크인 버튼들 */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
          {members.map(member => {
            const status = todayStatus[member.name];
            const isCheckedIn = status?.checked;

            return (
              <button
                key={member.id}
                onClick={() => handleButtonClick(member)}
                disabled={isCheckedIn}
                className={`
                  relative p-4 rounded-lg text-center transition-all
                  ${isCheckedIn
                    ? 'bg-[#F0FDF4] border-2 border-[#00C950] cursor-default'
                    : 'bg-white border-2 border-[#E5E7EB] hover:bg-[#f7f6f3] cursor-pointer'
                  }
                `}
              >
                {isCheckedIn && (
                  <div className="absolute top-1 right-1 text-[#0f7b4c] text-sm">✓</div>
                )}
                {status?.imageUrl && (
                  <div className="absolute top-1 left-1 text-[#2eaadc] text-sm">
                    {status.reason === SUPER_EXEMPTION_REASON ? '⭐' : '📷'}
                  </div>
                )}
                {status?.reason && !status?.imageUrl && (
                  <div className="absolute top-1 left-1 text-sm">
                    ✏️
                  </div>
                )}
                <div className="text-3xl mb-1">{member.emoji}</div>
                <div className={`text-sm font-medium ${isCheckedIn ? 'text-[#0A0A0A]' : 'text-[#0A0A0A]'}`}>
                  {member.name}
                </div>
              </button>
            );
          })}
        </div>

        {/* 오늘의 현황 */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xm font-bold text-[#37352f]">
              오늘의 현황
            </h2>
            <div className="flex gap-2">
              <span className="py-0.5 text-[#00A63E] text-xs font-medium">
                {checkedInCount}명 완료
              </span>
              {members.length - checkedInCount > 0 && (
                <span className="py-0.5 text-[#99A1AF] text-xs font-medium">
                  {members.length - checkedInCount}명 대기
                </span>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2">
            {members.map(member => {
              const status = todayStatus[member.name];
              const isCheckedIn = status?.checked;

              return (
                <div
                  key={member.id}
                  className="flex items-center rounded-lg justify-between bg-[#F9FAFB] px-3 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{member.emoji}</span>
                    <span className={`text-sm ${isCheckedIn ? 'text-[#0A0A0A]' : 'text-[#0A0A0A]'}`}>
                      {member.name}
                    </span>
                    {status?.reason === SUPER_EXEMPTION_REASON ? (
                      <button
                        type="button"
                        onClick={() => status.imageUrl && openImageModal(status.imageUrl)}
                        className="text-xs text-[#8b6914] font-medium hover:underline"
                      >
                        ⭐ 슈퍼 면제권
                      </button>
                    ) : status?.imageUrl ? (
                      <button
                        type="button"
                        onClick={() => openImageModal(status.imageUrl!)}
                        className="text-xs text-[#155DFC] font-medium hover:underline"
                      >
                        📷 사진보기
                      </button>
                    ) : status?.reason ? (
                      <button
                        type="button"
                        onClick={() => {
                          setModalReasonText(status.reason!);
                          setShowReasonModal(true);
                        }}
                        className="text-xs text-[#787774] font-medium hover:underline"
                      >
                        ✏️ 사유보기
                      </button>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    {isCheckedIn ? (
                      <>
                        <span className="px-3 py-2 border border-[#00A63E] bg-[#F0FDF4] text-[#00A63E] rounded-md text-xs font-medium">
                          완료
                        </span>
                        <button
                          onClick={() => handleUndo(member.name)}
                          className="px-3 py-2 border border-[#E7000B] text-[#E7000B] bg-[#ffffff] rounded-md text-xs transition-colors"
                        >
                          취소
                        </button>
                      </>
                    ) : (
                      <span className="px-3 py-2 bg-[#ffffff] border border-[#c8c8c8] text-[#0A0A0A] opacity-50 rounded-md font-medium text-xs">
                        대기중
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 필사모임 규칙 */}
        <div className="border border-[#E5E7EB] rounded-md overflow-hidden mb-6">
          <button
            type="button"
            onClick={() => setShowRules(!showRules)}
            className="w-full flex items-center justify-between px-4 py-4 bg-[#F9FAFB]"
          >
            <h2 className="text-sm font-semibold text-[#0A0A0A]">
              필사모임 규칙
            </h2>
            <span className="text-[#0A0A0A] text-sm">{showRules ? '▲' : '▼'}</span>
          </button>

          {showRules && (
            <div className="px-4 py-4 space-y-4 text-sm">
              {/* 출석 */}
              <div>
                <h3 className="font-semibold text-[#4A5565] mb-1">출석</h3>
                <p className="text-[#4A5565] pl-3">• &lt;월-금&gt; 필사 후 사진찍고 카톡방에 인증</p>
              </div>

              {/* 벌금 규정 */}
              <div>
                <h3 className="font-semibold text-[#4A5565] mb-1">벌금 규정</h3>
                <div className="text-[#4A5565] pl-3 space-y-0.5">
                  <p>• 미인증 1회당 1,000원 벌금 부과</p>
                  <p>• 벌금 통장 명의: 최초 벌금 발생자</p>
                </div>
              </div>

              {/* 벌금 감면 */}
              <div>
                <h3 className="font-semibold text-[#4A5565] mb-1">벌금 감면</h3>
                <div className="text-[#4A5565] pl-3 space-y-0.5">
                  <p>• 다음의 경우 사전 공지 시 벌금 감면</p>
                  <p>• 여행, 질병, 업무 사유(야근 및 회식 포함) 등</p>
                </div>
              </div>

              {/* 면제권 */}
              <div>
                <h3 className="font-semibold text-[#4A5565] mb-1">면제권</h3>
                <div className="text-[#4A5565] pl-3 space-y-0.5">
                  <p>• 주 1회 슈퍼 면제권 사용가능</p>
                  <p>• 면제권 사용 방법: 당일 자정(24시) 이전까지 &quot;면제권 사용&quot;을 손글씨로 작성하여 카톡방에 인증</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 명언 */}
        <div className="mb-6 pl-4 bg-white border-l-4 border-[#D1D5DC] rounded-r-md">
          <p className="text-sm font-semibold text-[#0A0A0A] mb-1">
            성공은 매일 반복한<br />작은 노력들의 합이다.
          </p>
          <p className="text-xs text-[#6A7282]">- 로버트 콜리어</p>
        </div>

        {/* 통계 링크 */}
        <div className="text-center border-t border-[#e3e2de] pt-6">
          <a
            href="/stats"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-[#155DFC] rounded-md"
          >
            <span>이번 주 통계 보기</span>
            <span>→</span>
          </a>
        </div>
      </div>
    </div>
  );
}
