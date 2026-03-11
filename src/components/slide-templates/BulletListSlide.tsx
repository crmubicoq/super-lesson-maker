import { SlideTemplateProps } from './SlideRenderer';
import SlideFooter from './SlideFooter';

export default function BulletListSlide({ slide, slideIndex, totalSlides }: SlideTemplateProps) {
    return (
        <div className="w-full h-full flex flex-col bg-gradient-to-br from-slate-50 to-blue-50">
            <div className="flex-1 flex flex-col justify-center px-16 py-12">
                <div
                    className="w-12 h-1 rounded-full mb-6"
                    style={{ backgroundColor: slide.accentColor || '#3B82F6' }}
                />
                <h2 className="text-3xl font-black text-slate-800 tracking-tight mb-8">
                    {slide.slideTitle}
                </h2>
                <ul className="space-y-5">
                    {slide.content.map((point, i) => (
                        <li key={i} className="flex gap-4 items-start">
                            <div
                                className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-white font-bold text-sm"
                                style={{ backgroundColor: slide.accentColor || '#3B82F6' }}
                            >
                                {i + 1}
                            </div>
                            <p className="text-base text-slate-700 leading-relaxed pt-1">{point}</p>
                        </li>
                    ))}
                </ul>
            </div>
            <SlideFooter chapter={slide.chapterTitle} index={slideIndex} total={totalSlides} />
        </div>
    );
}
