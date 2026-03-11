interface SlideFooterProps {
    chapter: string;
    index: number;
    total: number;
}

export default function SlideFooter({ chapter }: SlideFooterProps) {
    return (
        <div className="px-8 py-4 border-t border-black/5 flex justify-between items-center">
            <span className="text-[10px] font-black text-slate-400 tracking-widest">
                &copy; LECTURE SLIDE MAKER
            </span>
            <div className="flex gap-4">
                <span className="text-[10px] font-bold text-slate-400 uppercase">{chapter}</span>
            </div>
        </div>
    );
}
