import { SlideTemplateProps } from './SlideRenderer';
import SlideFooter from './SlideFooter';

export default function CoverSlide({ slide, slideIndex, totalSlides }: SlideTemplateProps) {
    return (
        <div className="w-full h-full flex flex-col bg-gradient-to-br from-slate-50 to-blue-50">
            <div className="flex-1 flex flex-col items-center justify-center px-16 text-center">
                <div
                    className="w-16 h-1 rounded-full mb-8"
                    style={{ backgroundColor: slide.accentColor || '#3B82F6' }}
                />
                <h1 className="text-4xl font-black text-slate-800 tracking-tight leading-tight mb-6">
                    {slide.slideTitle}
                </h1>
                {slide.bodyText && (
                    <p className="text-lg text-slate-500 leading-relaxed max-w-[80%]">
                        {slide.bodyText}
                    </p>
                )}
                <div className="mt-8 px-4 py-2 rounded-full bg-white/60 border border-slate-200">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                        {slide.chapterTitle}
                    </span>
                </div>
            </div>
            <SlideFooter chapter={slide.chapterTitle} index={slideIndex} total={totalSlides} />
        </div>
    );
}
