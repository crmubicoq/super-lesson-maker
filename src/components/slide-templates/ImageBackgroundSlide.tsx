import { SlideTemplateProps } from './SlideRenderer';
import SlideFooter from './SlideFooter';

export default function ImageBackgroundSlide({ slide, slideIndex, totalSlides }: SlideTemplateProps) {
    return (
        <div className="w-full h-full flex flex-col relative">
            {/* 배경 이미지 */}
            {slide.imageUrl && (
                <img
                    src={slide.imageUrl}
                    alt={slide.slideTitle}
                    className="absolute inset-0 w-full h-full object-cover"
                    onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://picsum.photos/seed/fallback/800/600`;
                    }}
                />
            )}

            {/* 오버레이 */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />

            {/* 콘텐츠 */}
            <div className="relative flex-1 flex flex-col justify-end px-16 pb-8">
                <h2 className="text-3xl font-black text-white tracking-tight mb-4 drop-shadow-lg">
                    {slide.slideTitle}
                </h2>
                {slide.content.length > 0 && (
                    <ul className="space-y-2 mb-4">
                        {slide.content.map((point, i) => (
                            <li key={i} className="flex gap-3 items-start">
                                <div className="w-1.5 h-1.5 rounded-full bg-white/60 mt-2 shrink-0" />
                                <p className="text-sm text-white/80 leading-relaxed">{point}</p>
                            </li>
                        ))}
                    </ul>
                )}
                {slide.bodyText && (
                    <p className="text-sm text-white/70 leading-relaxed">{slide.bodyText}</p>
                )}
            </div>

            {/* 푸터 */}
            <div className="relative px-8 py-4 border-t border-white/10 flex justify-between items-center">
                <span className="text-[10px] font-black text-white/40 tracking-widest">
                    &copy; LECTURE SLIDE MAKER
                </span>
                <div className="flex gap-4">
                    <span className="text-[10px] font-bold text-white/40 uppercase">{slide.chapterTitle}</span>
                    <span className="text-[10px] font-bold text-white/30">
                        {slideIndex + 1} / {totalSlides}
                    </span>
                </div>
            </div>
        </div>
    );
}
