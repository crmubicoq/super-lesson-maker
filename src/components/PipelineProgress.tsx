'use client';

import { PipelineProgress as PipelineProgressType, PipelineStage } from '@/types/slide';
import { Check, Loader2, Image, Palette, FileText, Sparkles, ShieldCheck, CheckCircle } from 'lucide-react';

interface Props {
    progress: PipelineProgressType | null;
}

const STAGES: { key: PipelineStage; label: string; icon: typeof Check }[] = [
    { key: 'normalizing', label: '이미지 정규화', icon: Image },
    { key: 'analyzing_style', label: '스타일 분석', icon: Palette },
    { key: 'analyzing_content', label: '콘텐츠 분석', icon: FileText },
    { key: 'generating', label: '이미지 생성', icon: Sparkles },
    { key: 'validating_text', label: '텍스트 검증', icon: ShieldCheck },
    { key: 'completed', label: '완료', icon: CheckCircle },
];

function getStageIndex(stage: PipelineStage): number {
    return STAGES.findIndex(s => s.key === stage);
}

export default function PipelineProgress({ progress }: Props) {
    if (!progress) return null;

    const currentIdx = getStageIndex(progress.stage);

    return (
        <div className="w-full max-w-2xl mx-auto">
            {/* 전체 진행률 바 */}
            <div className="mb-8">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-bold text-white">전체 진행률</span>
                    <span className="text-sm font-bold text-blue-400">{progress.overallProgress}%</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-blue-500 to-violet-500 rounded-full transition-all duration-500"
                        style={{ width: `${progress.overallProgress}%` }}
                    />
                </div>
            </div>

            {/* 6단계 스텝 표시 */}
            <div className="space-y-3">
                {STAGES.map((stage, idx) => {
                    const Icon = stage.icon;
                    const isActive = idx === currentIdx;
                    const isDone = idx < currentIdx;
                    const isPending = idx > currentIdx;

                    return (
                        <div
                            key={stage.key}
                            className={`flex items-center gap-4 p-3 rounded-xl transition-all duration-300 ${
                                isActive ? 'bg-blue-500/10 border border-blue-500/30' :
                                isDone ? 'bg-white/5 opacity-60' :
                                'opacity-30'
                            }`}
                        >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                isDone ? 'bg-emerald-500/20 text-emerald-400' :
                                isActive ? 'bg-blue-500/20 text-blue-400' :
                                'bg-white/5 text-slate-500'
                            }`}>
                                {isDone ? (
                                    <Check size={16} />
                                ) : isActive ? (
                                    <Loader2 size={16} className="animate-spin" />
                                ) : (
                                    <Icon size={16} />
                                )}
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className={`text-sm font-bold ${
                                    isActive ? 'text-white' : isDone ? 'text-slate-400' : 'text-slate-600'
                                }`}>
                                    {stage.label}
                                </div>
                                {isActive && (
                                    <div className="text-xs text-blue-400 mt-0.5 truncate">
                                        {progress.message}
                                        {progress.currentSlide && progress.totalSlides && (
                                            <span className="ml-2 text-slate-500">
                                                ({progress.currentSlide}/{progress.totalSlides})
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>

                            {isActive && progress.stageProgress > 0 && progress.stageProgress < 100 && (
                                <div className="w-16 h-1 bg-white/10 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-blue-500 rounded-full transition-all duration-300"
                                        style={{ width: `${progress.stageProgress}%` }}
                                    />
                                </div>
                            )}

                            {isPending && (
                                <span className="text-xs text-slate-600">대기 중</span>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
