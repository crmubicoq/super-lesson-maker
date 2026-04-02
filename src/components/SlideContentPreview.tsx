import { useState } from 'react';
import { Slide } from '@/types/slide';
import { Edit3, Check, ArrowRight, ArrowLeft, FileText, Layers, Download, ChevronRight, ChevronDown } from 'lucide-react';

interface SlideContentPreviewProps {
    slides: Slide[];
    onUpdateSlide: (updatedSlide: Slide) => void;
    onConfirm: () => void;
    onBack: () => void;
    onRegenerate?: (targetCount: number) => void;
}

const layoutLabels: Record<string, string> = {
    cover: '표지',
    title_body: '본문',
    bullet_list: '불릿',
    grid_2x2: '2×2 그리드',
    grid_1x3: '1×3 그리드',
    content_image: '이미지+텍스트',
    section_divider: '섹션 구분',
};

export default function SlideContentPreview({ slides, onUpdateSlide, onConfirm, onBack, onRegenerate }: SlideContentPreviewProps) {
    const [editingSlideId, setEditingSlideId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState('');
    const [editBody, setEditBody] = useState('');
    const [editNotes, setEditNotes] = useState('');
    const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
    const [targetCount, setTargetCount] = useState<number | string>(slides.length);

    const toggleNotes = (id: string) => {
        setExpandedNotes(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const slidesToMarkdown = (): string => {
        const coverSlide = slides.find(s => s.slideRole === 'cover');
        let md = `# ${coverSlide?.slideTitle || '강의 교안'}\n\n`;

        slides.forEach((slide, idx) => {
            md += `---\n\n## ${idx + 1}. ${slide.slideTitle}\n\n`;

            if (slide.bodyText) {
                md += `${slide.bodyText}\n\n`;
            }
            if (slide.content && slide.content.length > 0 && !slide.bodyText) {
                slide.content.forEach(point => { md += `- ${point}\n`; });
                md += '\n';
            }
            if (slide.contentBlocks && slide.contentBlocks.length > 0) {
                slide.contentBlocks.forEach(block => {
                    md += `### ${block.subtitle}\n${block.body}\n\n`;
                });
            }
            if (slide.speakerNotes) {
                md += `> **발표자 노트:** ${slide.speakerNotes}\n\n`;
            }
        });
        return md;
    };

    const handleDownloadMarkdown = () => {
        const md = slidesToMarkdown();
        const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `교안_초안.md`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const startEdit = (slide: Slide) => {
        setEditingSlideId(slide.id);
        setEditTitle(slide.slideTitle);
        let slideBody = slide.bodyText || '';
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
        setEditNotes(slide.speakerNotes || '');
    };

    const saveEdit = (slide: Slide) => {
        onUpdateSlide({
            ...slide,
            slideTitle: editTitle,
            bodyText: editBody,
            content: [],
            contentBlocks: [],
            speakerNotes: editNotes,
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
                        <h3 className="text-2xl font-bold text-white">슬라이드 초안</h3>
                        <p className="text-xs text-slate-500 mt-1">
                            총 {slides.length}장의 슬라이드 초안입니다. 내용을 확인하고 수정한 후 이미지를 생성하세요.
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleDownloadMarkdown}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/15 hover:bg-emerald-500/10 hover:border-emerald-500/30 text-slate-400 hover:text-emerald-300 text-xs font-bold transition-all"
                        title="초안 내용을 마크다운 파일로 다운로드"
                    >
                        <Download size={14} />
                        MD 다운로드
                    </button>
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
                                        setTargetCount('');
                                    } else {
                                        const val = parseInt(e.target.value);
                                        if (!isNaN(val)) setTargetCount(val);
                                    }
                                }}
                                onBlur={() => {
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

            {/* 슬라이드 카드 리스트 */}
            <div className="space-y-3 mb-10">
                {slides.map((slide, idx) => {
                    const isEditing = editingSlideId === slide.id;
                    const notesExpanded = expandedNotes.has(slide.id);
                    const layoutLabel = layoutLabels[slide.layout] || slide.layout;
                    const hasNotes = !!slide.speakerNotes;

                    return (
                        <div
                            key={slide.id}
                            className={`rounded-2xl border transition-colors ${isEditing ? 'bg-indigo-500/5 border-indigo-500/30' : 'bg-white/[0.03] border-white/10 hover:border-white/20'}`}
                        >
                            {/* 카드 헤더 */}
                            <div className="flex items-center gap-3 px-5 pt-4 pb-3 border-b border-white/[0.06]">
                                <div className="w-7 h-7 rounded-lg bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300 border border-white/15 flex-shrink-0">
                                    {idx + 1}
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                    {layoutLabel}
                                </span>
                                {!isEditing && (
                                    <button
                                        onClick={() => startEdit(slide)}
                                        className="ml-auto p-1.5 rounded-lg hover:bg-white/5 text-slate-500 hover:text-indigo-400 transition-colors"
                                        title="슬라이드 편집"
                                    >
                                        <Edit3 size={15} />
                                    </button>
                                )}
                            </div>

                            {/* 카드 본문 */}
                            <div className="px-5 py-4">
                                {isEditing ? (
                                    <div className="space-y-3">
                                        <div>
                                            <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1.5">제목</p>
                                            <input
                                                autoFocus
                                                value={editTitle}
                                                onChange={(e) => setEditTitle(e.target.value)}
                                                className="w-full bg-slate-700/60 border border-indigo-500/50 rounded-lg px-3 py-2 text-sm text-white font-bold outline-none focus:ring-1 focus:ring-indigo-500/50"
                                                placeholder="슬라이드 제목"
                                            />
                                        </div>
                                        <div>
                                            <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1.5">화면 텍스트</p>
                                            <textarea
                                                value={editBody}
                                                onChange={(e) => setEditBody(e.target.value)}
                                                rows={4}
                                                className="w-full bg-slate-700/60 border border-white/15 rounded-lg px-3 py-2 text-sm text-slate-300 outline-none focus:border-indigo-500/50 resize-none leading-relaxed"
                                                placeholder="본문 내용 (줄바꿈으로 구분)"
                                            />
                                        </div>
                                        <div>
                                            <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1.5">강의 대본</p>
                                            <textarea
                                                value={editNotes}
                                                onChange={(e) => setEditNotes(e.target.value)}
                                                rows={3}
                                                className="w-full bg-slate-700/60 border border-white/15 rounded-lg px-3 py-2 text-sm text-slate-400 outline-none focus:border-indigo-500/50 resize-none leading-relaxed"
                                                placeholder="강사 발표 대본 (구어체)"
                                            />
                                        </div>
                                        <div className="flex gap-2 pt-1">
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
                                        {/* 화면 텍스트 섹션 */}
                                        <div className="mb-1">
                                            <p className="text-[10px] uppercase tracking-wider text-white/35 mb-2">화면 텍스트</p>
                                            <h5 className="text-white font-bold text-base mb-2 leading-snug">{slide.slideTitle}</h5>
                                            {slide.bodyText && (
                                                <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                                                    {slide.bodyText}
                                                </p>
                                            )}
                                            {slide.content?.length > 0 && !slide.bodyText && (
                                                <ul className="space-y-1.5">
                                                    {slide.content.map((point, pIdx) => (
                                                        <li key={pIdx} className="flex items-start gap-2 text-sm text-slate-200">
                                                            <span className="text-indigo-400 mt-0.5 flex-shrink-0">•</span>
                                                            <span className="leading-relaxed">{point}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                            {slide.contentBlocks && slide.contentBlocks.length > 0 && (
                                                <div className="grid grid-cols-2 gap-2 mt-2">
                                                    {slide.contentBlocks.map((block, bIdx) => (
                                                        <div key={bIdx} className="bg-white/5 p-3 rounded-lg border border-white/10">
                                                            <p className="text-xs font-bold text-indigo-300 mb-1">{block.subtitle}</p>
                                                            <p className="text-xs text-slate-300 leading-relaxed">{block.body}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* 강의 대본 섹션 (접기/펼치기) */}
                                        {hasNotes && (
                                            <div className="border-t border-white/[0.06] pt-3 mt-3">
                                                <button
                                                    onClick={() => toggleNotes(slide.id)}
                                                    className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/40 hover:text-white/60 transition-colors"
                                                >
                                                    {notesExpanded
                                                        ? <ChevronDown size={12} />
                                                        : <ChevronRight size={12} />
                                                    }
                                                    강의 대본
                                                </button>
                                                {notesExpanded && (
                                                    <p className="mt-2 text-sm text-slate-400 leading-relaxed whitespace-pre-wrap">
                                                        {slide.speakerNotes}
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
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
        </div>
    );
}
