"use client";

import React, { useState, useRef, useLayoutEffect, useMemo } from 'react';
import { Slide } from '@/types/slide';
import { gsap } from 'gsap';
import SlideRenderer from './slide-templates/SlideRenderer';
import {
    ChevronLeft,
    ChevronRight,
    Check,
    Download,
    RefreshCw,
    ShieldCheck,
    Loader2,
    Pencil,
    Wand2,
    Send,
    X,
    Save,
} from 'lucide-react';

interface SlideEditorProps {
    slides: Slide[];
    onUpdateSlide: (updatedSlide: Slide) => void;
    onNextStep?: () => void;
    onBack?: () => void;
    onAddSlide?: (afterIndex: number) => void;
    onDeleteSlide?: (index: number) => void;
    styleReferenceImages?: string[];
    geminiApiKey?: string;
    onSaveProject?: () => void;
    saveMessage?: string | null;
}

export default function SlideEditor({ slides, onUpdateSlide, onNextStep, onBack, onAddSlide, onDeleteSlide, styleReferenceImages, geminiApiKey, onSaveProject, saveMessage }: SlideEditorProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const currentSlide = slides[currentIndex];
    const slideRef = useRef<HTMLDivElement>(null);
    const skipAnimationRef = useRef(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveProgress, setSaveProgress] = useState({ current: 0, total: 0 });
    const [isRegenerating, setIsRegenerating] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [editInstruction, setEditInstruction] = useState('');
    const [isEditing, setIsEditing] = useState(false);

    const [localText, setLocalText] = useState('');

    // 외부 파라미터(currentSlide) 변경 시 localText 동기화 (단, 사용자가 타이핑 중인 엔터 등은 보존)
    useLayoutEffect(() => {
        if (!currentSlide) return;

        const lines = localText.split('\n');
        const localTitle = lines[0] || '';
        const localBody = lines.slice(1).join('\n');

        const parts: string[] = [];
        if (currentSlide.content && currentSlide.content.length > 0) {
            parts.push(currentSlide.content.join('\n'));
        }
        if (currentSlide.contentBlocks && currentSlide.contentBlocks.length > 0) {
            const blockTexts = currentSlide.contentBlocks.map(b => `${b.subtitle}: ${b.body}`);
            parts.push(blockTexts.join('\n\n'));
        }
        if (currentSlide.bodyText) {
            parts.push(currentSlide.bodyText);
        }
        const slideBody = parts.join('\n\n');

        // 사용자가 타이핑 중인 값과 실제 슬라이드 값이 다를 때만 덮어쓰기 (외부 변경, 슬라이드 전환 감지)
        if (localTitle !== (currentSlide.slideTitle || '') || localBody !== slideBody) {
            setLocalText(slideBody ? `${currentSlide.slideTitle || ''}\n${slideBody}` : (currentSlide.slideTitle || ''));
        }
    }, [currentSlide, localText]);

    // 통합 텍스트 변경 핸들러: 첫 줄 = 제목, 나머지 = 본문 + content
    const handleCombinedTextChange = (value: string) => {
        setLocalText(value); // 즉각적인 UI 상태 반영 (엔터, 띄어쓰기 등 보존)

        const lines = value.split('\n');
        const slideTitle = lines[0] || '';
        const bodyText = lines.slice(1).join('\n');

        onUpdateSlide({
            ...currentSlide,
            slideTitle,
            bodyText,
            content: [],
            contentBlocks: []
        });
    };

    // Partial Edit: 수정 지시 기반 이미지 수정
    const handlePartialEdit = async () => {
        if (isEditing || !currentSlide || !editInstruction.trim()) return;
        setIsEditing(true);

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 180000);

            const res = await fetch('/api/partial-edit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(geminiApiKey && { 'X-Gemini-Key': geminiApiKey }),
                },
                body: JSON.stringify({
                    existingImageUrl: currentSlide.generatedImageUrl || '',
                    instruction: editInstruction.trim(),
                    slideTitle: currentSlide.slideTitle,
                    bodyText: currentSlide.bodyText,
                    bulletPoints: currentSlide.content,
                    slideNumber: currentIndex + 1,
                    totalSlides: slides.length,
                    styleDescription: currentSlide.designStyle || '',
                    referenceImagesBase64: styleReferenceImages,
                }),
                signal: controller.signal,
            });
            clearTimeout(timeoutId);

            if (res.ok) {
                const data = await res.json();
                const newUrl = `${data.imageUrl}?t=${Date.now()}`;
                onUpdateSlide({
                    ...currentSlide,
                    generatedImageUrl: newUrl,
                    generatedImageBase64: data.imageBase64,
                    imageUrl: newUrl,
                    textValidated: false,
                    validationAttempts: 0,
                });
                setEditInstruction('');
                setEditMode(false);
            } else {
                console.error('[Partial Edit] API error:', res.status);
            }
        } catch (error) {
            console.error('[Partial Edit] Error:', error);
        } finally {
            setIsEditing(false);
        }
    };

    // 개별 슬라이드 재생성
    const handleRegenerate = async () => {
        if (isRegenerating || !currentSlide) return;
        setIsRegenerating(true);

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 180000); // 3분

            const res = await fetch('/api/generate-slide-image', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(geminiApiKey && { 'X-Gemini-Key': geminiApiKey }),
                },
                body: JSON.stringify({
                    slideTitle: currentSlide.slideTitle,
                    bodyText: currentSlide.bodyText,
                    bulletPoints: currentSlide.content,
                    slideNumber: currentIndex + 1,
                    totalSlides: slides.length,
                    styleDescription: currentSlide.designStyle || '',
                    referenceImagesBase64: styleReferenceImages,
                }),
                signal: controller.signal,
            });
            clearTimeout(timeoutId);

            if (res.ok) {
                const data = await res.json();
                onUpdateSlide({
                    ...currentSlide,
                    generatedImageUrl: data.imageUrl,
                    generatedImageBase64: data.imageBase64,
                    imageUrl: data.imageUrl,
                    textValidated: false,
                    validationAttempts: 0,
                });
            } else {
                console.error('[Regenerate] API error:', res.status);
            }
        } catch (error) {
            console.error('[Regenerate] Error:', error);
        } finally {
            setIsRegenerating(false);
        }
    };

    useLayoutEffect(() => {
        if (slideRef.current && !skipAnimationRef.current) {
            gsap.fromTo(slideRef.current,
                { opacity: 0, x: 50, filter: 'blur(10px)' },
                { opacity: 1, x: 0, filter: 'blur(0px)', duration: 0.5, ease: "back.out(1.2)" }
            );
        }
    }, [currentIndex]);

    if (!currentSlide) return <div className="p-8 text-center text-slate-500">슬라이드가 없습니다.</div>;

    const captureSlide = async (slide: Slide): Promise<string | null> => {
        if (!slideRef.current) return null;
        try {
            const { toPng } = await import('html-to-image');
            const node = slideRef.current;
            const targetWidth = 1920;
            const scale = targetWidth / node.offsetWidth;
            const imageData = await toPng(node, {
                pixelRatio: scale,
                cacheBust: true,
                style: { margin: '0' },
            });

            // 캡처된 UI 이미지를 상태에 백업 저장 (PDF 내보내기에서 AI 이미지가 없을 경우 대체 사용하기 위함)
            onUpdateSlide({
                ...slide,
                finalCapturedBase64: imageData,
            });

            const res = await fetch('/api/save-slide', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageData, slideId: slide.id }),
            });
            const result = await res.json();
            return result.savedPath || null;
        } catch (err) {
            console.error('[Slide Capture Error]', slide.id, err);
            return null;
        }
    };

    const downloadCurrentSlide = async () => {
        if (isSaving || !slideRef.current) return;
        setIsSaving(true);
        try {
            const { toPng } = await import('html-to-image');
            const node = slideRef.current;
            const targetWidth = 1920;
            const scale = targetWidth / node.offsetWidth;
            const imageData = await toPng(node, {
                pixelRatio: scale,
                cacheBust: true,
                style: { margin: '0' },
            });

            const fileName = `slide_${String(currentIndex + 1).padStart(2, '0')}.png`;

            // File System Access API로 저장 위치 선택
            if ('showSaveFilePicker' in window) {
                try {
                    const handle = await (window as unknown as { showSaveFilePicker: (opts: unknown) => Promise<FileSystemFileHandle> }).showSaveFilePicker({
                        suggestedName: fileName,
                        types: [{ description: 'PNG 이미지', accept: { 'image/png': ['.png'] } }],
                    });
                    const writable = await handle.createWritable();
                    const res = await fetch(imageData);
                    const blob = await res.blob();
                    await writable.write(blob);
                    await writable.close();
                } catch (e) {
                    // 사용자가 취소한 경우 무시
                    if ((e as Error).name !== 'AbortError') throw e;
                }
            } else {
                // 폴백: 브라우저 기본 다운로드
                const link = document.createElement('a');
                link.download = fileName;
                link.href = imageData;
                link.click();
            }
        } catch (err) {
            console.error('[Slide Download Error]', err);
        }
        setIsSaving(false);
    };

    const saveAllSlides = async () => {
        if (isSaving) return;
        setIsSaving(true);
        skipAnimationRef.current = true;
        const originalIndex = currentIndex;

        for (let i = 0; i < slides.length; i++) {
            setSaveProgress({ current: i + 1, total: slides.length });
            setCurrentIndex(i);
            await new Promise(r => setTimeout(r, 500));
            await captureSlide(slides[i]);
        }

        skipAnimationRef.current = false;
        setCurrentIndex(originalIndex);
        await new Promise(r => setTimeout(r, 300));
        setIsSaving(false);
    };

    const handleComplete = async () => {
        await saveAllSlides();
        onNextStep?.();
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-[#1E293B] overflow-hidden">
            {/* Editor Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/15 bg-slate-800/30">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                        disabled={currentIndex === 0}
                        className="p-2 rounded-lg hover:bg-white/5 disabled:opacity-30 text-slate-400"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <span className="text-sm font-bold text-white">
                        슬라이드 {currentIndex + 1} <span className="text-slate-500 font-normal">/ {slides.length}</span>
                    </span>
                    <button
                        onClick={() => setCurrentIndex(prev => Math.min(slides.length - 1, prev + 1))}
                        disabled={currentIndex === slides.length - 1}
                        className="p-2 rounded-lg hover:bg-white/5 disabled:opacity-30 text-slate-400"
                    >
                        <ChevronRight size={20} />
                    </button>
                    <div className="h-4 w-[1px] bg-white/10 mx-1" />
                    {onAddSlide && (
                        <button
                            onClick={() => {
                                onAddSlide(currentIndex);
                                setTimeout(() => setCurrentIndex(currentIndex + 1), 100);
                            }}
                            className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 text-xs font-bold hover:bg-blue-500/20 transition-all border border-blue-500/20"
                            title="현재 슬라이드 뒤에 빈 슬라이드 추가"
                        >
                            + 추가
                        </button>
                    )}
                    {onDeleteSlide && (
                        <button
                            onClick={() => {
                                onDeleteSlide(currentIndex);
                                if (currentIndex === slides.length - 1) {
                                    setCurrentIndex(Math.max(0, currentIndex - 1));
                                }
                            }}
                            disabled={slides.length <= 1}
                            className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors disabled:opacity-30 border border-transparent hover:border-red-500/30"
                            title="현재 슬라이드 삭제"
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    {onBack && (
                        <button
                            onClick={onBack}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/15 hover:bg-white/5 text-slate-400 text-xs font-bold transition-all"
                        >
                            <ChevronLeft size={14} />
                            이전 단계
                        </button>
                    )}
                    {onSaveProject && (
                        <button
                            onClick={onSaveProject}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 text-emerald-400 text-xs font-bold transition-all"
                        >
                            <Save size={14} />
                            프로젝트 저장
                        </button>
                    )}
                    {saveMessage && (
                        <span className="px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold animate-in fade-in duration-300">
                            {saveMessage}
                        </span>
                    )}
                    <button
                        onClick={downloadCurrentSlide}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/15 hover:bg-white/10 text-slate-300 text-xs font-bold transition-all disabled:opacity-50"
                    >
                        <Download size={14} />
                        개별 슬라이드 다운
                    </button>
                    <button
                        onClick={handleComplete}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all active:scale-95 shadow-lg shadow-blue-500/20 disabled:opacity-50"
                    >
                        {isSaving ? '저장 중...' : '편집 완료 및 다음 단계'}
                        <Check size={14} />
                    </button>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Left Side: Unified Text Editor + Partial Edit */}
                <div className="w-[400px] border-r border-white/10 flex flex-col bg-slate-800/60">
                    {/* 슬라이드 텍스트 편집 */}
                    <div className="flex-1 flex flex-col p-6 min-h-0">
                        <label className="flex items-center justify-between gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
                            <div className="flex items-center gap-2">
                                <Pencil size={14} className="text-blue-400" />
                                원본 슬라이드 대본 <span className="text-[10px] text-slate-500 normal-case">(목차 초안)</span>
                            </div>
                        </label>
                        <p className="text-[10px] text-slate-500/80 mb-3 bg-white/5 p-2 rounded border border-white/10">
                            💡 여기에 적힌 내용이 앞 단계에서 확정한 '슬라이드 내용'입니다. 오른쪽 이미지가 이를 정확히 반영했는지 비교해 보세요.
                        </p>
                        <textarea
                            value={localText}
                            onChange={(e) => handleCombinedTextChange(e.target.value)}
                            className="flex-1 w-full bg-white/5 border border-white/15 rounded-xl p-4 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50 transition-all resize-none leading-relaxed"
                            placeholder="슬라이드에 표시할 텍스트를 입력하세요.&#10;첫 줄이 제목이 됩니다."
                        />
                    </div>

                    {/* Partial Edit: 수정 지시 영역 */}
                    <div className="border-t border-white/10 p-6">
                        {editMode ? (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest">
                                        <Wand2 size={14} className="text-violet-400" />
                                        수정 지시
                                    </label>
                                    <button
                                        onClick={() => { setEditMode(false); setEditInstruction(''); }}
                                        className="p-1 rounded-md text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                                <textarea
                                    value={editInstruction}
                                    onChange={(e) => setEditInstruction(e.target.value)}
                                    disabled={isEditing}
                                    rows={3}
                                    placeholder="예) 제목을 '새 제목'으로 변경, 배경색을 파란색으로 변경"
                                    className="w-full bg-white/5 border border-white/15 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-violet-500/50 transition-all resize-none disabled:opacity-50"
                                />
                                <button
                                    onClick={handlePartialEdit}
                                    disabled={isEditing || !editInstruction.trim()}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition-all active:scale-95 shadow-lg shadow-violet-500/20 disabled:opacity-50"
                                >
                                    {isEditing ? (
                                        <Loader2 size={14} className="animate-spin" />
                                    ) : (
                                        <Send size={14} />
                                    )}
                                    {isEditing ? '수정 적용 중...' : '수정 적용'}
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setEditMode(true)}
                                disabled={isRegenerating || isEditing}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/15 hover:bg-violet-500/10 hover:border-violet-500/30 text-slate-400 hover:text-violet-300 text-xs font-bold transition-all disabled:opacity-50"
                            >
                                <Wand2 size={14} />
                                AI 수정 지시
                            </button>
                        )}
                    </div>
                </div>

                {/* Right Side: Preview */}
                <div className="flex-1 p-6 md:p-8 flex flex-col items-center justify-start bg-[#1E293B] relative overflow-y-auto">
                    {isSaving && (
                        <div className="absolute inset-0 bg-[#1E293B] flex flex-col items-center justify-center z-20">
                            <div className="w-14 h-14 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-6" />
                            <p className="text-white text-sm font-bold mb-2">슬라이드 저장 중...</p>
                            <p className="text-blue-400 text-xs font-bold mb-4">
                                {saveProgress.current} / {saveProgress.total}
                            </p>
                            <div className="w-48 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-blue-500 rounded-full transition-all duration-300"
                                    style={{ width: `${(saveProgress.current / Math.max(saveProgress.total, 1)) * 100}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {/* 슬라이드 프리뷰 영역 (크기 제한 및 스크롤 보장) */}
                    <div ref={slideRef} className="w-full max-w-4xl shrink-0 aspect-[1920/1080] rounded-xl overflow-hidden shadow-2xl shadow-black ring-1 ring-white/10 relative">
                        {currentSlide.generatedImageUrl ? (
                            <>
                                <img
                                    src={currentSlide.generatedImageUrl}
                                    alt={currentSlide.slideTitle}
                                    className="w-full h-full object-fill"
                                />
                                {isRegenerating && (
                                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
                                        <Loader2 size={32} className="text-blue-400 animate-spin mb-3" />
                                        <span className="text-sm text-white font-bold">이미지 재생성 중...</span>
                                    </div>
                                )}
                            </>
                        ) : (
                            <SlideRenderer
                                slide={currentSlide}
                                slideIndex={currentIndex}
                                totalSlides={slides.length}
                            />
                        )}
                    </div>

                    {/* 프리뷰 하단 액션 바 */}
                    <div className="mt-4 w-full flex flex-col gap-3">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleRegenerate}
                                disabled={isRegenerating}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition-all active:scale-95 shadow-lg shadow-violet-500/20 disabled:opacity-50"
                            >
                                {isRegenerating ? (
                                    <Loader2 size={14} className="animate-spin" />
                                ) : (
                                    <RefreshCw size={14} />
                                )}
                                {isRegenerating ? '재생성 중...' : '이미지 재생성'}
                            </button>

                            {currentSlide.textValidated !== undefined && (
                                <div className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold ${currentSlide.textValidated
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                    : 'bg-red-500/10 text-red-400 border border-red-500/20'
                                    }`}>
                                    <ShieldCheck size={14} />
                                    {currentSlide.textValidated ? '텍스트 검증 통과' : '텍스트 검증 미통과'}
                                </div>
                            )}
                        </div>

                        {currentSlide.textValidated === false && (
                            <div className="w-full text-left p-3 rounded-xl border border-red-500/20 bg-red-500/10 shrink-0">
                                <p className="text-xs font-bold text-red-400 mb-1">⚠️ 주의: 이미지 내 텍스트가 좌측 대본과 다릅니다!</p>
                                <div className="text-[11px] text-red-300 space-y-1 mb-2">
                                    <p>AI가 이미지를 생성하면서 내용을 멋대로 요약하거나 문장(총알 기호 등)을 임의로 추가했습니다.</p>
                                    <p className="font-semibold text-red-200">💡 해결 방법:</p>
                                    <ul className="list-disc list-inside pl-1 space-y-0.5">
                                        <li><strong>[이미지 재생성]</strong> 버튼을 눌러 다시 올바르게 그려지도록 여러 번 시도합니다.</li>
                                        <li>또는 <strong>[AI 수정 지시]</strong> 버튼을 누르고 <em>"왼쪽 대본과 단어 하나 안 틀리고 똑같이 적어줘"</em>라고 지시합니다.</li>
                                        <li>실제 강의에 지장이 없다면 그냥 무시하고 넘어가셔도 됩니다.</li>
                                    </ul>
                                </div>
                                {currentSlide.validationIssues && currentSlide.validationIssues.length > 0 && (
                                    <div className="mt-2 pt-2 border-t border-red-500/20">
                                        <p className="text-[10px] text-red-400/80 mb-1">상세 불일치 로그:</p>
                                        <ul className="list-disc list-inside text-[10px] text-red-400/80 space-y-0.5 leading-relaxed">
                                            {currentSlide.validationIssues.map((issue, idx) => (
                                                <li key={idx}>{issue}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
