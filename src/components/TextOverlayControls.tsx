"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { TextOverlay, OverlayRect, OCRAnalysisResult, VerticalAlign, HorizontalAlign } from '@/types/slide';
import {
    Loader2,
    Type as TypeIcon,
    Info,
    CheckCircle2,
    Sparkles,
    AlignLeft,
    AlignCenter,
    AlignRight,
    AlignVerticalJustifyStart,
    AlignVerticalJustifyCenter,
    AlignVerticalJustifyEnd,
    MoveHorizontal,
    Trash2,
    Undo2,
} from 'lucide-react';

interface TextOverlayControlsProps {
    imageUrl: string;
    selection: OverlayRect | null;
    selectedOverlayId: string | null;
    overlays: TextOverlay[];
    onApplyOverlay: (overlay: TextOverlay) => void;
    onUpdateOverlays: (overlays: TextOverlay[]) => void;
    onDeleteOverlay: (id: string) => void;
    onUndo: () => void;
    geminiApiKey?: string;
}

const FONTS = [
    { name: 'Sans-serif (기본)', value: 'sans-serif' },
    { name: 'Arial', value: 'Arial' },
    { name: 'Roboto', value: 'Roboto' },
    { name: 'Serif', value: 'serif' },
    { name: 'Monospace', value: 'monospace' },
];

export default function TextOverlayControls({
    imageUrl,
    selection,
    selectedOverlayId,
    overlays,
    onApplyOverlay,
    onUpdateOverlays,
    onDeleteOverlay,
    onUndo,
    geminiApiKey,
}: TextOverlayControlsProps) {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [ocrResult, setOcrResult] = useState<OCRAnalysisResult | null>(null);

    const [replacementText, setReplacementText] = useState('');
    const [fontSize, setFontSize] = useState(16);
    const [fontWeight, setFontWeight] = useState('normal');
    const [fontColor, setFontColor] = useState('#000000');
    const [fontFamily, setFontFamily] = useState('sans-serif');
    const [vAlign, setVAlign] = useState<VerticalAlign>('top');
    const [hAlign, setHAlign] = useState<HorizontalAlign>('left');
    const [letterSpacing, setLetterSpacing] = useState(0);
    const [backgroundColor, setBackgroundColor] = useState('#ffffff');
    const [isTransparent, setIsTransparent] = useState(false);

    const selectedOverlay = overlays.find(o => o.id === selectedOverlayId);

    // 선택 초기화 시 상태 리셋
    useEffect(() => {
        if (!selection && !selectedOverlayId) {
            setOcrResult(null);
            setReplacementText('');
            setBackgroundColor('#ffffff');
            setIsTransparent(false);
        }
    }, [selection, selectedOverlayId]);

    // 기존 오버레이 선택 시 값 로드
    useEffect(() => {
        if (selectedOverlay) {
            setReplacementText(selectedOverlay.newText);
            setFontSize(selectedOverlay.fontSize);
            setFontWeight(selectedOverlay.fontWeight);
            setFontColor(selectedOverlay.fontColor);
            setFontFamily(selectedOverlay.fontFamily);
            setVAlign(selectedOverlay.vAlign || 'top');
            setHAlign(selectedOverlay.hAlign || 'left');
            setLetterSpacing(selectedOverlay.letterSpacing || 0);

            const bg = selectedOverlay.backgroundColor;
            if (bg === 'rgba(0,0,0,0)' || bg === 'transparent') {
                setIsTransparent(true);
                setBackgroundColor('#ffffff');
            } else {
                setIsTransparent(false);
                setBackgroundColor(bg || '#ffffff');
            }
        }
    }, [selectedOverlayId, selectedOverlay]);

    // 배경색 자동 감지 (선택 영역 테두리 픽셀 샘플링)
    const detectBackgroundColor = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number): string => {
        try {
            const data = ctx.getImageData(0, 0, width, height).data;
            const colorCounts: Record<string, { count: number; r: number; g: number; b: number }> = {};

            const addPixel = (x: number, y: number) => {
                const i = (y * width + x) * 4;
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                const a = data[i + 3];
                if (a < 50) return;

                const bucket = 10;
                const key = `${Math.round(r / bucket)},${Math.round(g / bucket)},${Math.round(b / bucket)}`;
                if (!colorCounts[key]) colorCounts[key] = { count: 0, r: 0, g: 0, b: 0 };
                colorCounts[key].count++;
                colorCounts[key].r += r;
                colorCounts[key].g += g;
                colorCounts[key].b += b;
            };

            const depth = 5;
            for (let x = 0; x < width; x++) {
                for (let y = 0; y < Math.min(depth, height); y++) addPixel(x, y);
                for (let y = Math.max(0, height - depth); y < height; y++) addPixel(x, y);
            }
            for (let y = depth; y < height - depth; y++) {
                for (let x = 0; x < Math.min(depth, width); x++) addPixel(x, y);
                for (let x = Math.max(0, width - depth); x < width; x++) addPixel(x, y);
            }

            let maxCount = 0;
            let dominantColor = null;
            for (const key in colorCounts) {
                if (colorCounts[key].count > maxCount) {
                    maxCount = colorCounts[key].count;
                    dominantColor = {
                        r: Math.round(colorCounts[key].r / maxCount),
                        g: Math.round(colorCounts[key].g / maxCount),
                        b: Math.round(colorCounts[key].b / maxCount),
                    };
                }
            }
            if (!dominantColor) return '#ffffff';

            const toHex = (c: number) => c.toString(16).padStart(2, '0');
            return `#${toHex(dominantColor.r)}${toHex(dominantColor.g)}${toHex(dominantColor.b)}`;
        } catch {
            return '#ffffff';
        }
    }, []);

    // 이미지 크롭 유틸리티
    const getCroppedCanvas = useCallback(async (rect: OverlayRect, usePadding: boolean) => {
        const padding = usePadding ? 10 : 0;

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = imageUrl;
        await new Promise(resolve => { img.onload = resolve; });

        const startX = Math.max(0, Math.floor(rect.x - padding));
        const startY = Math.max(0, Math.floor(rect.y - padding));
        const endX = Math.min(img.width, Math.ceil(rect.x + rect.width + padding));
        const endY = Math.min(img.height, Math.ceil(rect.y + rect.height + padding));
        const w = endX - startX;
        const h = endY - startY;

        if (w <= 0 || h <= 0) return null;

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        ctx.drawImage(img, startX, startY, w, h, 0, 0, w, h);
        return { canvas, ctx, width: w, height: h };
    }, [imageUrl]);

    // 선택 영역 변경 시 배경색 자동 감지
    useEffect(() => {
        if (selection && !selectedOverlayId) {
            const detect = async () => {
                const result = await getCroppedCanvas(selection, true);
                if (!result) return;
                const detectedBg = detectBackgroundColor(result.ctx, result.width, result.height);
                setBackgroundColor(detectedBg);
                setIsTransparent(false);
            };
            detect();
        }
    }, [selection, selectedOverlayId, getCroppedCanvas, detectBackgroundColor]);

    // AI OCR 분석
    const handleAnalyze = async () => {
        if (!selection) return;
        setIsAnalyzing(true);
        try {
            // 배경색 재확인
            const bgResult = await getCroppedCanvas(selection, true);
            if (bgResult) {
                const detectedBg = detectBackgroundColor(bgResult.ctx, bgResult.width, bgResult.height);
                setBackgroundColor(detectedBg);
                setIsTransparent(false);
            }

            // OCR 분석용 크롭 (패딩 없이)
            const ocrCanvas = await getCroppedCanvas(selection, false);
            if (!ocrCanvas) return;

            const cropDataUrl = ocrCanvas.canvas.toDataURL('image/png');

            const res = await fetch('/api/ocr-analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(geminiApiKey && { 'X-Gemini-Key': geminiApiKey }),
                },
                body: JSON.stringify({ imageBase64: cropDataUrl }),
            });

            if (!res.ok) throw new Error('OCR 분석 실패');

            const result: OCRAnalysisResult = await res.json();
            setOcrResult(result);
            setReplacementText(result.text);
            setFontSize(result.fontSize);
            setFontWeight(result.fontWeight);
            setFontColor(result.fontColor);
            setFontFamily(result.fontFamily);
            setVAlign('middle');
            setHAlign('center');
            setLetterSpacing(0);
        } catch (err) {
            console.error('[OCR Analyze]', err);
        } finally {
            setIsAnalyzing(false);
        }
    };

    // 오버레이 실시간 업데이트
    const updateSelectedOverlay = (updates: Partial<TextOverlay>) => {
        if (!selectedOverlayId) return;
        const newOverlays = overlays.map(ov =>
            ov.id === selectedOverlayId ? { ...ov, ...updates } : ov
        );
        onUpdateOverlays(newOverlays);
    };

    // 새 오버레이 적용
    const handleApply = () => {
        if (!selection) return;
        onApplyOverlay({
            id: Math.random().toString(36).substring(2, 11),
            rect: { ...selection },
            originalText: ocrResult?.text || '',
            newText: replacementText,
            fontSize,
            fontWeight,
            fontColor,
            fontFamily,
            backgroundColor: isTransparent ? 'rgba(0,0,0,0)' : backgroundColor,
            vAlign,
            hAlign,
            letterSpacing,
        });
    };

    const isEditing = !!selectedOverlayId;

    return (
        <div className="w-full h-full flex flex-col overflow-y-auto">
            {/* 헤더 */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <TypeIcon size={14} className="text-blue-400" />
                    {isEditing ? '텍스트 수정' : '텍스트 교체'}
                </h2>
                <div className="flex items-center gap-1">
                    <button
                        onClick={onUndo}
                        className="p-1.5 rounded-lg hover:bg-white/5 text-slate-500 hover:text-slate-300 transition-colors"
                        title="실행 취소"
                    >
                        <Undo2 size={14} />
                    </button>
                    {isEditing && (
                        <button
                            onClick={() => onDeleteOverlay(selectedOverlayId!)}
                            className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-colors"
                            title="선택 삭제"
                        >
                            <Trash2 size={14} />
                        </button>
                    )}
                </div>
            </div>

            {!selection && !isEditing ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-500 p-6">
                    <div className="w-14 h-14 rounded-xl bg-white/5 flex items-center justify-center mb-4 border border-white/10">
                        <Info size={28} className="opacity-40" />
                    </div>
                    <p className="text-xs leading-relaxed">
                        이미지 위에서 드래그하여<br />교체할 텍스트 영역을 선택하세요
                    </p>
                </div>
            ) : (
                <div className="p-4 space-y-4">
                    {/* AI 분석 섹션 (새 선택일 때만) */}
                    {!isEditing && (
                        <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">AI 텍스트 분석</h3>
                            {isAnalyzing ? (
                                <div className="flex items-center gap-2 py-3 text-blue-400">
                                    <Loader2 className="animate-spin" size={16} />
                                    <span className="text-xs">분석 중...</span>
                                </div>
                            ) : ocrResult ? (
                                <div className="p-2 bg-white/5 rounded-lg text-xs text-slate-300 italic border border-white/10">
                                    &quot;{ocrResult.text}&quot;
                                </div>
                            ) : (
                                <button
                                    onClick={handleAnalyze}
                                    className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all"
                                >
                                    <Sparkles size={14} className="text-blue-400" /> AI 분석 (OCR)
                                </button>
                            )}
                        </div>
                    )}

                    {/* 텍스트 입력 */}
                    <div className="space-y-1.5">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">내용</label>
                        <textarea
                            value={replacementText}
                            onChange={(e) => {
                                setReplacementText(e.target.value);
                                if (isEditing) updateSelectedOverlay({ newText: e.target.value });
                            }}
                            className="w-full bg-white/5 border border-white/15 rounded-lg p-2.5 text-xs h-20 resize-none focus:outline-none focus:border-blue-500/50 text-slate-200"
                        />
                    </div>

                    {/* 수평/수직 정렬 */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">수평 정렬</label>
                            <div className="flex bg-white/5 p-0.5 rounded-lg border border-white/10">
                                {(['left', 'center', 'right'] as const).map(align => (
                                    <button
                                        key={align}
                                        onClick={() => { setHAlign(align); if (isEditing) updateSelectedOverlay({ hAlign: align }); }}
                                        className={`flex-1 p-1.5 rounded flex justify-center transition-colors ${hAlign === align ? 'bg-white/10 text-blue-400' : 'text-slate-500'}`}
                                    >
                                        {align === 'left' ? <AlignLeft size={14} /> : align === 'center' ? <AlignCenter size={14} /> : <AlignRight size={14} />}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">수직 정렬</label>
                            <div className="flex bg-white/5 p-0.5 rounded-lg border border-white/10">
                                {(['top', 'middle', 'bottom'] as const).map(align => (
                                    <button
                                        key={align}
                                        onClick={() => { setVAlign(align); if (isEditing) updateSelectedOverlay({ vAlign: align }); }}
                                        className={`flex-1 p-1.5 rounded flex justify-center transition-colors ${vAlign === align ? 'bg-white/10 text-blue-400' : 'text-slate-500'}`}
                                    >
                                        {align === 'top' ? <AlignVerticalJustifyStart size={14} /> : align === 'middle' ? <AlignVerticalJustifyCenter size={14} /> : <AlignVerticalJustifyEnd size={14} />}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* 글꼴 */}
                    <div className="space-y-1.5">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">글꼴</label>
                        <select
                            value={fontFamily}
                            onChange={(e) => {
                                setFontFamily(e.target.value);
                                if (isEditing) updateSelectedOverlay({ fontFamily: e.target.value });
                            }}
                            className="w-full bg-white/5 border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500/50"
                        >
                            {FONTS.map(f => <option key={f.value} value={f.value}>{f.name}</option>)}
                        </select>
                    </div>

                    {/* 크기 + 글자 색상 */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">크기</label>
                            <input
                                type="number"
                                value={fontSize}
                                onChange={(e) => {
                                    const val = parseInt(e.target.value);
                                    setFontSize(val);
                                    if (isEditing) updateSelectedOverlay({ fontSize: val });
                                }}
                                className="w-full bg-white/5 border border-white/15 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-500/50"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">글자 색상</label>
                            <div className="flex gap-1.5 items-center bg-white/5 border border-white/15 rounded-lg px-2 py-0.5">
                                <input
                                    type="color"
                                    value={fontColor}
                                    onChange={(e) => {
                                        setFontColor(e.target.value);
                                        if (isEditing) updateSelectedOverlay({ fontColor: e.target.value });
                                    }}
                                    className="w-6 h-6 bg-transparent cursor-pointer"
                                />
                                <span className="text-[10px] font-mono text-slate-400 uppercase">{fontColor}</span>
                            </div>
                        </div>
                    </div>

                    {/* 배경 색상 */}
                    <div className="space-y-1.5">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">배경 색상</label>
                        <div className="flex items-center justify-between bg-white/5 border border-white/15 rounded-lg px-2.5 py-1.5">
                            <div className="flex items-center gap-2">
                                <input
                                    type="color"
                                    value={backgroundColor}
                                    disabled={isTransparent}
                                    onChange={(e) => {
                                        setBackgroundColor(e.target.value);
                                        if (isEditing) updateSelectedOverlay({ backgroundColor: e.target.value });
                                    }}
                                    className={`w-5 h-5 bg-transparent cursor-pointer ${isTransparent ? 'opacity-20' : ''}`}
                                />
                                <span className={`text-[10px] font-mono uppercase ${isTransparent ? 'text-slate-600' : 'text-slate-400'}`}>
                                    {backgroundColor}
                                </span>
                            </div>
                            <label className="flex items-center gap-1.5 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={isTransparent}
                                    onChange={(e) => {
                                        const checked = e.target.checked;
                                        setIsTransparent(checked);
                                        if (isEditing) updateSelectedOverlay({ backgroundColor: checked ? 'rgba(0,0,0,0)' : backgroundColor });
                                    }}
                                    className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-800"
                                />
                                <span className="text-[10px] text-slate-400">투명</span>
                            </label>
                        </div>
                    </div>

                    {/* 두께 + 자간 */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">두께</label>
                            <div className="flex p-0.5 bg-white/5 rounded-lg border border-white/10">
                                <button
                                    onClick={() => { setFontWeight('normal'); if (isEditing) updateSelectedOverlay({ fontWeight: 'normal' }); }}
                                    className={`flex-1 py-1 text-[10px] rounded transition-all ${fontWeight === 'normal' ? 'bg-white/10 text-white' : 'text-slate-500'}`}
                                >
                                    Normal
                                </button>
                                <button
                                    onClick={() => { setFontWeight('bold'); if (isEditing) updateSelectedOverlay({ fontWeight: 'bold' }); }}
                                    className={`flex-1 py-1 text-[10px] font-bold rounded transition-all ${fontWeight === 'bold' ? 'bg-white/10 text-white' : 'text-slate-500'}`}
                                >
                                    Bold
                                </button>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">자간</label>
                            <div className="flex items-center bg-white/5 border border-white/15 rounded-lg px-2">
                                <MoveHorizontal size={12} className="text-slate-500 mr-1.5" />
                                <input
                                    type="number"
                                    step="0.1"
                                    value={letterSpacing}
                                    onChange={(e) => {
                                        const val = parseFloat(e.target.value);
                                        setLetterSpacing(val);
                                        if (isEditing) updateSelectedOverlay({ letterSpacing: val });
                                    }}
                                    className="w-full bg-transparent py-1.5 text-xs focus:outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* 적용 버튼 (새 오버레이일 때만) */}
                    {!isEditing && (
                        <button
                            onClick={handleApply}
                            disabled={!selection}
                            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 text-xs shadow-lg active:scale-95 transition-all"
                        >
                            <CheckCircle2 size={14} /> 텍스트 적용
                        </button>
                    )}
                </div>
            )}

            {/* 오버레이 목록 */}
            {overlays.length > 0 && (
                <div className="mt-auto border-t border-white/10 p-4">
                    <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                        적용된 오버레이 ({overlays.length})
                    </h3>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                        {overlays.map((ov, idx) => (
                            <div
                                key={ov.id}
                                className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                                    ov.id === selectedOverlayId
                                        ? 'bg-blue-500/20 border border-blue-500/30 text-blue-300'
                                        : 'bg-white/5 border border-white/5 text-slate-400 hover:bg-white/10'
                                }`}
                            >
                                <span className="truncate flex-1">
                                    #{idx + 1} {ov.newText.substring(0, 20)}{ov.newText.length > 20 ? '...' : ''}
                                </span>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onDeleteOverlay(ov.id); }}
                                    className="p-0.5 rounded hover:bg-red-500/20 hover:text-red-400 transition-colors ml-1"
                                >
                                    <Trash2 size={10} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
