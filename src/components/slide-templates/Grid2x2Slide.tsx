import { SlideTemplateProps } from './SlideRenderer';
import SlideFooter from './SlideFooter';

export default function Grid2x2Slide({ slide, slideIndex, totalSlides }: SlideTemplateProps) {
    const blocks = slide.contentBlocks || [];
    const accent = slide.accentColor || '#3B82F6';

    return (
        <div className="w-full h-full flex flex-col bg-gradient-to-br from-slate-50 to-blue-50">
            <div className="flex-1 flex flex-col px-12 py-10">
                {/* 제목 */}
                <h2 className="text-2xl font-black text-slate-800 tracking-tight mb-6">
                    {slide.slideTitle}
                </h2>

                {/* 2x2 그리드 */}
                <div className="flex-1 grid grid-cols-2 gap-4">
                    {blocks.slice(0, 4).map((block, i) => (
                        <div
                            key={i}
                            className="rounded-2xl bg-white/80 border border-slate-100 p-5 flex flex-col gap-3 shadow-sm"
                        >
                            {/* 아이콘 */}
                            <div
                                className="w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden"
                                style={{ backgroundColor: accent + '15' }}
                            >
                                {block.iconUrl ? (
                                    <img
                                        src={block.iconUrl}
                                        alt={block.subtitle}
                                        className="w-10 h-10 object-contain"
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).style.display = 'none';
                                        }}
                                    />
                                ) : (
                                    <div
                                        className="w-6 h-6 rounded-full"
                                        style={{ backgroundColor: accent }}
                                    />
                                )}
                            </div>

                            {/* 소제목 */}
                            <h3 className="text-sm font-bold text-slate-800 leading-tight">
                                {block.subtitle}
                            </h3>

                            {/* 설명 */}
                            <p className="text-xs text-slate-500 leading-relaxed line-clamp-3">
                                {block.body}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
            <SlideFooter chapter={slide.chapterTitle} index={slideIndex} total={totalSlides} />
        </div>
    );
}
