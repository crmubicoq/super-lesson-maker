import { SlideTemplateProps } from './SlideRenderer';
import SlideFooter from './SlideFooter';

export default function ContentImageSlide({ slide, slideIndex, totalSlides }: SlideTemplateProps) {
    const accent = slide.accentColor || '#3B82F6';

    return (
        <div className="w-full h-full flex flex-col bg-gradient-to-br from-slate-50 to-blue-50">
            <div className="flex-1 flex items-center gap-8 px-12 py-10">
                {/* 텍스트 영역 */}
                <div className="w-1/2 space-y-5">
                    <div
                        className="w-10 h-1 rounded-full"
                        style={{ backgroundColor: accent }}
                    />
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight leading-tight">
                        {slide.slideTitle}
                    </h2>
                    <ul className="space-y-3">
                        {slide.content.map((point, i) => (
                            <li key={i} className="flex gap-3 items-start">
                                <div
                                    className="w-1.5 h-1.5 rounded-full mt-2 shrink-0"
                                    style={{ backgroundColor: accent }}
                                />
                                <p className="text-sm text-slate-600 leading-relaxed">{point}</p>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* 이미지 영역 */}
                <div className="w-1/2 h-full rounded-2xl overflow-hidden bg-white border border-slate-100 shadow-sm">
                    {slide.imageUrl ? (
                        <img
                            src={slide.imageUrl}
                            alt={slide.slideTitle}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                                (e.target as HTMLImageElement).src = `https://picsum.photos/seed/fallback/800/600`;
                            }}
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <p className="text-xs text-slate-400 uppercase tracking-widest">
                                이미지 생성 중...
                            </p>
                        </div>
                    )}
                </div>
            </div>
            <SlideFooter chapter={slide.chapterTitle} index={slideIndex} total={totalSlides} />
        </div>
    );
}
