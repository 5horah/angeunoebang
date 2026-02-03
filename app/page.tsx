'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface Member {
  id: number;
  name: string;
  emoji: string;
}

interface TodayStatus {
  [key: string]: {
    checked: boolean;
    imageUrl?: string;
  };
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

  // 이미지 확대 모달
  const [showImageModal, setShowImageModal] = useState(false);
  const [modalImage, setModalImage] = useState<string | null>(null);

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
      .select('member_name, image_url')
      .eq('check_in_date', today);

    if (data) {
      const status: TodayStatus = {};
      data.forEach(record => {
        status[record.member_name] = {
          checked: true,
          imageUrl: record.image_url
        };
      });
      setTodayStatus(status);
    }
  };

  const handleButtonClick = (member: Member) => {
    if (todayStatus[member.name]?.checked) return;

    setSelectedMember(member);
    setShowConfirmModal(true);
    setSelectedImage(null);
    setImagePreview(null);
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
    if (!selectedMember || !selectedImage) {
      alert('필사 인증 사진을 선택해주세요!');
      return;
    }

    setLoading(true);
    setUploading(true);

    try {
      let imageUrl: string | null = null;

      // 이미지 업로드
      if (selectedImage) {
        imageUrl = await uploadImage(selectedImage, selectedMember.name);
      }

      const { error } = await supabase
        .from('attendance')
        .insert({
          member_name: selectedMember.name,
          check_in_date: today,
          image_url: imageUrl,
        });

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
            imageUrl: imageUrl || undefined
          }
        }));

        setShowConfirmModal(false);
        setSelectedMember(null);
        setSelectedImage(null);
        setImagePreview(null);
      }
    } catch (err) {
      console.error(err);
      alert('오류가 발생했습니다.');
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
          <div className="relative max-w-3xl max-h-[90vh]">
            <img
              src={modalImage}
              alt="필사 인증"
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
            />
            <button
              onClick={() => setShowImageModal(false)}
              className="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full flex items-center justify-center text-[#37352f] shadow-lg"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 확인 모달 */}
      {showConfirmModal && selectedMember && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6 animate-scale-in border border-[#e3e2de] max-h-[90vh] overflow-y-auto">
            <div className="text-center mb-5">
              <span className="text-5xl">{selectedMember.emoji}</span>
              <h2 className="text-lg font-semibold text-[#37352f] mt-3">
                {selectedMember.name}
              </h2>
            </div>

            {/* 이미지 업로드 영역 */}
            <div className="mb-5">
              <p className="text-sm font-medium text-[#37352f] mb-2">
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
                    onClick={() => {
                      setSelectedImage(null);
                      setImagePreview(null);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                      }
                    }}
                    className="absolute top-2 right-2 w-6 h-6 bg-white/90 rounded-full flex items-center justify-center text-[#e03e3e] text-sm"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-32 border-2 border-dashed border-[#e3e2de] rounded-md flex flex-col items-center justify-center gap-2 hover:bg-[#f7f6f3] transition-colors"
                >
                  <span className="text-2xl">📷</span>
                  <span className="text-sm text-[#787774]">사진 선택하기</span>
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

            {/* 버튼 */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  setSelectedMember(null);
                  setSelectedImage(null);
                  setImagePreview(null);
                }}
                disabled={loading}
                className="flex-1 px-4 py-2 text-sm font-medium text-[#37352f] bg-white border border-[#e3e2de] rounded-md hover:bg-[#f7f6f3] transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleConfirmCheckIn}
                disabled={!selectedImage || loading}
                className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  selectedImage && !loading
                    ? 'bg-[#2eaadc] text-white hover:bg-[#2898c7]'
                    : 'bg-[#e3e2de] text-[#a4a4a0] cursor-not-allowed'
                }`}
              >
                {uploading ? '업로드중...' : loading ? '처리중...' : '인증하기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 헤더 (고정) - 블러(글래스) 효과 */}
      <div className="border-b border-[#e3e2de] sticky top-0 z-10 bg-white/70 backdrop-blur-md">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-3xl">📖</span>
            <h1 className="text-2xl font-bold text-[#37352f]">앙그뇌방</h1>
          </div>
          <p className="text-xs text-[#787774]">
            앙큼한 그녀들의 뇌가 섹시해지는 방법
          </p>

          {/* 오늘 날짜 & 진행률 */}
          <div className="flex items-center justify-between mt-3 mb-2">
            <p className="text-sm text-[#787774]">
              {format(new Date(), 'M월 d일 EEEE', { locale: ko })}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-[#37352f]">{checkedInCount}/{members.length}</span>
              <span className="text-xs text-[#787774]">인증 완료</span>
            </div>
          </div>

          <div className="bg-[#e3e2de] rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full bg-[#2eaadc] transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* 안내 문구 */}
        <div className="mb-6 p-4 bg-[#f1f1ef] rounded-md border-l-4 border-[#2eaadc]">
          <p className="text-sm text-[#37352f]">
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
                  relative p-4 rounded-md text-center transition-all
                  ${isCheckedIn
                    ? 'bg-[#dbf4e7] border border-[#c3e9d3] cursor-default'
                    : 'bg-white border border-[#e3e2de] hover:bg-[#f7f6f3] cursor-pointer'
                  }
                `}
              >
                {isCheckedIn && (
                  <div className="absolute top-1 right-1 text-[#0f7b4c] text-sm">✓</div>
                )}
                {status?.imageUrl && (
                  <div className="absolute top-1 left-1 text-[#2eaadc] text-sm">📷</div>
                )}
                <div className="text-3xl mb-1">{member.emoji}</div>
                <div className={`text-sm font-medium ${isCheckedIn ? 'text-[#0f7b4c]' : 'text-[#37352f]'}`}>
                  {member.name}
                </div>
              </button>
            );
          })}
        </div>

        {/* 오늘의 현황 */}
        <div className="border border-[#e3e2de] rounded-md mb-6">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#e3e2de] bg-[#f7f6f3]">
            <h2 className="text-sm font-semibold text-[#37352f]">
              오늘의 현황
            </h2>
            <div className="flex gap-2">
              <span className="px-2 py-0.5 bg-[#dbf4e7] text-[#0f7b4c] rounded text-xs font-medium">
                {checkedInCount}명 완료
              </span>
              {members.length - checkedInCount > 0 && (
                <span className="px-2 py-0.5 bg-[#e3e2de] text-[#787774] rounded text-xs font-medium">
                  {members.length - checkedInCount}명 대기
                </span>
              )}
            </div>
          </div>

          <div className="divide-y divide-[#e3e2de]">
            {members.map(member => {
              const status = todayStatus[member.name];
              const isCheckedIn = status?.checked;

              return (
                <div
                  key={member.id}
                  className="flex items-center justify-between px-4 py-3 hover:bg-[#f7f6f3] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{member.emoji}</span>
                    <span className={`text-sm ${isCheckedIn ? 'text-[#0f7b4c]' : 'text-[#37352f]'}`}>
                      {member.name}
                    </span>
                    {status?.imageUrl && (
                      <button
                        onClick={() => openImageModal(status.imageUrl!)}
                        className="text-xs text-[#2eaadc] hover:underline"
                      >
                        📷 사진보기
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {isCheckedIn ? (
                      <>
                        <span className="px-2 py-0.5 bg-[#dbf4e7] text-[#0f7b4c] rounded text-xs font-medium">
                          완료
                        </span>
                        <button
                          onClick={() => handleUndo(member.name)}
                          className="px-2 py-0.5 text-[#e03e3e] hover:bg-[#fbe4e4] rounded text-xs transition-colors"
                        >
                          취소
                        </button>
                      </>
                    ) : (
                      <span className="px-2 py-0.5 bg-[#e3e2de] text-[#787774] rounded text-xs">
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
        <div className="border border-[#e3e2de] rounded-md mb-6">
          <button
            onClick={() => setShowRules(!showRules)}
            className="w-full flex items-center justify-between px-4 py-3 bg-[#f7f6f3] hover:bg-[#eeeeec] transition-colors"
          >
            <h2 className="text-sm font-semibold text-[#37352f]">
              필사모임 규칙
            </h2>
            <span className="text-[#787774] text-sm">{showRules ? '▲' : '▼'}</span>
          </button>

          {showRules && (
            <div className="px-4 py-4 space-y-4 text-sm">
              {/* 출석 */}
              <div>
                <h3 className="font-semibold text-[#37352f] mb-1">출석</h3>
                <p className="text-[#787774] pl-3">• &lt;월-금&gt; 필사 후 사진찍고 카톡방에 인증</p>
              </div>

              {/* 벌금 규정 */}
              <div>
                <h3 className="font-semibold text-[#37352f] mb-1">벌금 규정</h3>
                <div className="text-[#787774] pl-3 space-y-0.5">
                  <p>• 미인증 1회당 1,000원 벌금 부과</p>
                  <p>• 벌금 통장 명의: 최초 벌금 발생자</p>
                </div>
              </div>

              {/* 벌금 감면 */}
              <div>
                <h3 className="font-semibold text-[#37352f] mb-1">벌금 감면</h3>
                <div className="text-[#787774] pl-3 space-y-0.5">
                  <p>• 다음의 경우 사전 공지 시 벌금 감면</p>
                  <p>• 여행, 질병, 업무 사유(야근 및 회식 포함) 등</p>
                </div>
              </div>

              {/* 면제권 */}
              <div>
                <h3 className="font-semibold text-[#37352f] mb-1">면제권</h3>
                <div className="text-[#787774] pl-3 space-y-0.5">
                  <p>• 주 1회 슈퍼 면제권 사용가능</p>
                  <p>• 면제권 사용 방법: 당일 자정(24시) 이전까지 &quot;면제권 사용&quot;을 손글씨로 작성하여 카톡방에 인증</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 명언 */}
        <div className="mb-6 p-4 bg-white border-l-4 border-[#37352f] rounded-r-md">
          <p className="text-sm font-semibold text-[#37352f] mb-1">
            성공은 매일 반복한<br />작은 노력들의 합이다.
          </p>
          <p className="text-xs text-[#787774]">- 로버트 콜리어</p>
        </div>

        {/* 통계 링크 */}
        <div className="text-center border-t border-[#e3e2de] pt-6">
          <a
            href="/stats"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-[#2eaadc] hover:bg-[#f7f6f3] rounded-md transition-colors"
          >
            <span>이번 주 통계 보기</span>
            <span>→</span>
          </a>
        </div>
      </div>
    </div>
  );
}
