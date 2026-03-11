import { SlideTemplateProps } from './SlideRenderer';
import SlideFooter from './SlideFooter';

export default function SectionDividerSlide({ slide, slideIndex, totalSlides }: SlideTemplateProps) {
    const accent = slide.accentColor || '#3B82F6';

    return (
        <div className="w-full h-full flex flex-col bg-gradient-to-br from-slate-800 to-slate-900">
            <div className="flex-1 flex flex-col items-center justify-center px-16 text-center">
                <div
                    className="w-16 h-1 rounded-full mb-8"
                    style={{ backgroundColor: accent }}
                />
                <h2 className="text-4xl font-black text-white tracking-tight mb-4">
                    {slide.slideTitle}
                </h2>
                {slide.bodyText && (
                    <p className="text-lg text-slate-400 leading-relaxed max-w-[70%]">
                        {slide.bodyText}
                    </p>
                )}
            </div>
            <div className="px-8 py-4 border-t border-white/5 flex justify-between items-center">
                <span className="text-[10px] font-black text-slate-600 tracking-widest">
                    &copy; LECTURE SLIDE MAKER
                </span>
                <span className="text-[10px] font-bold text-slate-500">
                    {slideIndex + 1} / {totalSlides}
                </span>
            </div>
        </div>
    );
}
