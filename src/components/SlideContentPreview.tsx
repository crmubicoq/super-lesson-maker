import React, { useState } from 'react';
import { Slide } from '@/types/slide';
import { Edit3, Check, ArrowRight, ArrowLeft, FileText, Layers } from 'lucide-react';

interface SlideContentPreviewProps {
    slides: Slide[];
    onUpdateSlide: (updatedSlide: Slide) => void;
    onConfirm: () => void;
    onBack: () => void;
    onRegenerate?: (targetCount: number) => void;
}

export default function SlideContentPreview({ slides, onUpdateSlide, onConfirm, onBack, onRegenerate }: SlideContentPreviewProps) {
    const [editingSlideId, setEditingSlideId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState('');
    const [editBody, setEditBody] = useState('');
    const [targetCount, setTargetCount] = useState<number | string>(slides.length);

    const startEdit = (slide: Slide) => {
        setEditingSlideId(slide.id);
        setEditTitle(slide.slideTitle);
        let slideBody = slide.bodyText || '';
        // bodyText가 비어있을 경우 (주로 목차 단계의 bulletPoints 또는 그리드형 contentBlocks 데이터) 복원
        if (!slideBody) {
            const parts: string[] = [];
            if (slide.content && slide.content.length > 0) {
                parts.push(slide.content.join('\n'));
            }
            if (slide.contentBlocks && slide.contentBlocks.length > 0) {
                const blockTexts = slide.contentBlocks.map(b => `${b.subtitle}: ${b.body}`);
                parts.push(blockTexts.join('\n\n'));
            }
            slideBody = parts.join('\n\n');
        }
        setEditBody(slideBody);
    };

    const saveEdit = (slide: Slide) => {
        onUpdateSlide({
            ...slide,
            slideTitle: editTitle,
            bodyText: editBody,
            content: [],
            contentBlocks: []
        });
        setEditingSlideId(null);
    };

    return (
        <div className="flex-1 flex flex-col max-w-5xl mx-auto w-full">
            {/* 헤더 */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-indigo-600/20 text-indigo-400">
                        <Layers size={24} />
                    </div>
                    <div>
                        <h3 className="text-2xl font-bold text-white">슬라이드 콘텐츠 미리보기</h3>
                        <p className="text-xs text-slate-500 mt-1">
                            총 {slides.length}장의 슬라이드가 생성됩니다. 내용을 확인하고 수정한 후 이미지를 생성하세요.
                        </p>
                    </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20">
                        <FileText size={14} className="text-indigo-400" />
                        <span className="text-xs font-bold text-indigo-400">현재 {slides.length}장</span>
                    </div>
                </div>
            </div>

            {/* 컨트롤 바 - 슬라이드 재생성 옵션 */}
            {onRegenerate && (
                <div className="flex items-center justify-between p-4 mb-6 rounded-2xl bg-white/5 border border-white/15">
                    <div className="flex items-center gap-4">
                        <span className="text-sm font-bold text-white">목표 슬라이드 장수 설정</span>
                        <div className="flex items-center gap-3 bg-slate-700/60 rounded-xl p-1 border border-white/10">
                            <button
                                onClick={() => {
                                    const num = Number(targetCount) || 5;
                                    setTargetCount(Math.max(5, num - 1));
                                }}
                                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 text-slate-300 font-bold"
                            >
                                -
                            </button>
                            <input
                                type="number"
                                min={5}
                                max={50}
                                value={targetCount}
                                onChange={(e) => {
                                    if (e.target.value === '') {
                                        setTargetCount(''); // 빈칸 허용
                                    } else {
                                        const val = parseInt(e.target.value);
                                        if (!isNaN(val)) setTargetCount(val); // 타이핑 중 보정하지 않음 (1 -> 15 연속입력 보장)
                                    }
                                }}
                                onBlur={() => {
                                    // 포커스를 잃을 때 최종 보정
                                    let val = Number(targetCount);
                                    if (!val || val < 5) val = 5;
                                    if (val > 50) val = 50;
                                    setTargetCount(val);
                                }}
                                className="text-sm font-bold w-12 text-center bg-transparent text-blue-400 border-none outline-none focus:bg-white/10 rounded px-1"
                                style={{ MozAppearance: 'textfield' }}
                            />
                            <button
                                onClick={() => {
                                    const num = Number(targetCount) || 5;
                                    setTargetCount(Math.min(50, num + 1));
                                }}
                                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 text-slate-300 font-bold"
                            >
                                +
                            </button>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            const val = Number(targetCount);
                            const finalTarget = !val || val < 5 ? 5 : val > 50 ? 50 : val;
                            setTargetCount(finalTarget);
                            onRegenerate(finalTarget);
                        }}
                        className="flex items-center gap-2 px-6 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold shadow-lg shadow-violet-500/20 active:scale-95 transition-all"
                    >
                        <Layers size={16} />
                        이 장수에 맞춰 다시 생성하기
                    </button>
                </div>
            )}

            {/* 슬라이드 플랫 리스트 */}
            <div className="rounded-2xl glass-card border-white/10 overflow-hidden mb-10">
                {slides.map((slide, idx) => {
                    const isEditing = editingSlideId === slide.id;

                    return (
                        <div
                            key={slide.id}
                            className={`flex gap-4 p-5 border-t border-white/10 first:border-t-0 group transition-colors ${isEditing ? 'bg-indigo-500/5' : 'hover:bg-white/[0.02]'
                                }`}
                        >
                            {/* 슬라이드 번호 */}
                            <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-400 border border-white/15 flex-shrink-0 mt-0.5">
                                {idx + 1}
                            </div>

                            {/* 슬라이드 내용 */}
                            <div className="flex-1 min-w-0">
                                {isEditing ? (
                                    <div className="space-y-3">
                                        <input
                                            autoFocus
                                            value={editTitle}
                                            onChange={(e) => setEditTitle(e.target.value)}
                                            className="w-full bg-slate-700/60 border border-indigo-500/50 rounded-lg px-3 py-2 text-sm text-white font-bold outline-none focus:ring-1 focus:ring-indigo-500/50"
                                            placeholder="슬라이드 제목"
                                        />
                                        <textarea
                                            value={editBody}
                                            onChange={(e) => setEditBody(e.target.value)}
                                            rows={4}
                                            className="w-full bg-slate-700/60 border border-white/15 rounded-lg px-3 py-2 text-xs text-slate-300 outline-none focus:border-indigo-500/50 resize-none leading-relaxed"
                                            placeholder="본문 내용 (줄바꿈으로 구분)"
                                        />
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => saveEdit(slide)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-500 transition-colors"
                                            >
                                                <Check size={12} /> 저장
                                            </button>
                                            <button
                                                onClick={() => setEditingSlideId(null)}
                                                className="px-3 py-1.5 rounded-lg text-slate-400 text-xs font-bold hover:bg-white/5 transition-colors"
                                            >
                                                취소
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <h5 className="text-white font-bold text-sm mb-1.5">{slide.slideTitle}</h5>
                                        {slide.bodyText && (
                                            <p className="text-xs text-slate-400 leading-relaxed mb-1.5 whitespace-pre-wrap">
                                                {slide.bodyText.length > 200
                                                    ? slide.bodyText.substring(0, 200) + '...'
                                                    : slide.bodyText}
                                            </p>
                                        )}
                                        {slide.content?.length > 0 && !slide.bodyText && (
                                            <ul className="space-y-1 mb-2">
                                                {slide.content.slice(0, 5).map((point, pIdx) => (
                                                    <li key={pIdx} className="flex items-start gap-2 text-xs text-slate-400">
                                                        <span className="text-indigo-500 mt-0.5">•</span>
                                                        <span className="leading-relaxed">
                                                            {point.length > 100 ? point.substring(0, 100) + '...' : point}
                                                        </span>
                                                    </li>
                                                ))}
                                                {slide.content.length > 5 && (
                                                    <li className="text-xs text-slate-500 pl-4">
                                                        +{slide.content.length - 5}개 더...
                                                    </li>
                                                )}
                                            </ul>
                                        )}
                                        {slide.contentBlocks && slide.contentBlocks.length > 0 && (
                                            <div className="grid grid-cols-2 gap-2 mt-2">
                                                {slide.contentBlocks.map((block, bIdx) => (
                                                    <div key={bIdx} className="bg-white/5 p-2 rounded border border-white/10">
                                                        <p className="text-xs font-bold text-indigo-300 mb-1">{block.subtitle}</p>
                                                        <p className="text-[10px] text-slate-400 leading-relaxed">{block.body}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            {/* 편집 버튼 */}
                            {
                                !isEditing && (
                                    <button
                                        onClick={() => startEdit(slide)}
                                        className="p-2 rounded-lg hover:bg-white/5 text-slate-500 hover:text-indigo-400 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                                        title="슬라이드 편집"
                                    >
                                        <Edit3 size={16} />
                                    </button>
                                )
                            }
                        </div>
                    );
                })}
            </div>

            {/* 하단 버튼 */}
            <div className="flex items-center justify-center gap-6 pb-8">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 px-8 py-4 rounded-2xl border border-white/15 text-slate-400 font-bold hover:bg-white/5 transition-all"
                >
                    <ArrowLeft size={18} />
                    처음으로
                </button>
                <button
                    onClick={onConfirm}
                    className="flex items-center gap-3 px-10 py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-lg shadow-blue-500/20 transition-all active:scale-95 group"
                >
                    비주얼 설정으로 진행
                    <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </button>
            </div>
        </div >
    );
}
