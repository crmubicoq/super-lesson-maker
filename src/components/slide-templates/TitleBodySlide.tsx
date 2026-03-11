import { SlideTemplateProps } from './SlideRenderer';
import SlideFooter from './SlideFooter';

export default function TitleBodySlide({ slide, slideIndex, totalSlides }: SlideTemplateProps) {
    return (
        <div className="w-full h-full flex flex-col bg-gradient-to-br from-slate-50 to-blue-50">
            <div className="flex-1 flex flex-col justify-center px-16 py-12">
                <div
                    className="w-12 h-1 rounded-full mb-6"
                    style={{ backgroundColor: slide.accentColor || '#3B82F6' }}
                />
                <h2 className="text-3xl font-black text-slate-800 tracking-tight mb-6">
                    {slide.slideTitle}
                </h2>
                {slide.bodyText && (
                    <p className="text-base text-slate-600 leading-relaxed max-w-[85%]">
                        {slide.bodyText}
                    </p>
                )}
                {slide.content.length > 0 && (
                    <ul className="mt-6 space-y-3">
                        {slide.content.map((point, i) => (
                            <li key={i} className="flex gap-3 items-start">
                                <div
                                    className="w-1.5 h-1.5 rounded-full mt-2 shrink-0"
                                    style={{ backgroundColor: slide.accentColor || '#3B82F6' }}
                                />
                                <p className="text-sm text-slate-600 leading-relaxed">{point}</p>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            <SlideFooter chapter={slide.chapterTitle} index={slideIndex} total={totalSlides} />
        </div>
    );
}
