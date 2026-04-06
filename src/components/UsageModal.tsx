'use client';

import { useState, useEffect } from 'react';
import { X, RefreshCw, Zap, Clock, Hash, Cpu, BarChart3, Activity } from 'lucide-react';

interface ModelStats { calls: number; tokens: number; inputTokens: number; outputTokens: number }
interface DateStats { calls: number; tokens: number }
interface UsageEntry {
    timestamp: string; traceName: string; model: string; provider: 'gemini' | 'claude';
    inputTokens: number; outputTokens: number; totalTokens: number; durationMs: number; success: boolean;
}
interface UsageSummary {
    totalCalls: number; totalTokens: number; totalInputTokens: number; totalOutputTokens: number; avgDurationMs: number;
    byModel: Record<string, ModelStats>; byFeature: Record<string, ModelStats>;
    byDate: Record<string, DateStats>; recentEntries: UsageEntry[];
}

const FEATURE_LABELS: Record<string, string> = {
    'analyze-structure': '문서 구조 분석', 'generate-all-in-one': '전체 초안 생성',
    'generate-section-slides': '섹션 슬라이드 생성', 'extract-key-points': '핵심 포인트 추출',
    'generate-slide-content': '슬라이드 콘텐츠', 'analyze-toc': '목차 분석',
    'summarize-slide': '텍스트 정리', 'generate-slide-image': '이미지 생성',
    'partial-edit': '부분 수정', 'analyze-style': '스타일 분석',
    'validate-text': '텍스트 검증', 'extract-pdf-ocr': 'PDF OCR', 'ocr-analyze': '이미지 OCR',
};

function formatNumber(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toString();
}

function formatDuration(ms: number): string {
    if (ms >= 60000) return `${(ms / 60000).toFixed(1)}분`;
    if (ms >= 1000) return `${(ms / 1000).toFixed(1)}초`;
    return `${ms}ms`;
}

interface UsageModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function UsageModal({ isOpen, onClose }: UsageModalProps) {
    const [data, setData] = useState<UsageSummary | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/usage-stats');
            if (!res.ok) throw new Error(`API 오류: ${res.status}`);
            setData(await res.json());
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) fetchData();
    }, [isOpen]);

    if (!isOpen) return null;

    const sortedModels = data ? Object.entries(data.byModel).sort((a, b) => b[1].tokens - a[1].tokens) : [];
    const sortedFeatures = data ? Object.entries(data.byFeature).sort((a, b) => b[1].tokens - a[1].tokens) : [];
    const sortedDates = data ? Object.entries(data.byDate).sort((a, b) => b[0].localeCompare(a[0])) : [];
    const maxModelTokens = sortedModels.length > 0 ? sortedModels[0][1].tokens : 1;
    const maxFeatureTokens = sortedFeatures.length > 0 ? sortedFeatures[0][1].tokens : 1;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-[#334155] rounded-2xl border border-white/10 w-[90vw] max-w-4xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
                {/* 헤더 */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
                    <div className="flex items-center gap-2">
                        <BarChart3 size={18} className="text-purple-400" />
                        <h2 className="text-base font-bold text-slate-200">API 사용량</h2>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={fetchData}
                            disabled={loading}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-600 hover:bg-slate-500 text-xs text-slate-300 transition-colors disabled:opacity-50"
                        >
                            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                            새로고침
                        </button>
                        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* 본문 */}
                <div className="overflow-y-auto p-6 space-y-5">
                    {loading && !data && (
                        <div className="flex items-center justify-center py-12 text-slate-400 text-sm">
                            <RefreshCw size={14} className="animate-spin mr-2" /> 로딩 중...
                        </div>
                    )}
                    {error && <div className="text-red-400 text-sm text-center py-8">{error}</div>}

                    {data && (
                        <>
                            {/* 요약 카드 */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <Card icon={<Hash size={16} />} label="총 호출" value={formatNumber(data.totalCalls)} color="blue" />
                                <Card icon={<Zap size={16} />} label="총 토큰" value={formatNumber(data.totalTokens)} color="purple" />
                                <Card icon={<Cpu size={16} />} label="입력 토큰" value={formatNumber(data.totalInputTokens)} color="emerald" />
                                <Card icon={<Clock size={16} />} label="평균 응답" value={formatDuration(data.avgDurationMs)} color="amber" />
                            </div>

                            <div className="grid md:grid-cols-2 gap-4">
                                {/* 모델별 */}
                                <div className="bg-[#1E293B] rounded-xl border border-white/5 p-4">
                                    <h3 className="text-xs font-bold text-slate-400 mb-3 flex items-center gap-1.5">
                                        <Cpu size={12} className="text-purple-400" /> 모델별 사용량
                                    </h3>
                                    {sortedModels.length === 0 ? (
                                        <p className="text-xs text-slate-500">데이터 없음</p>
                                    ) : (
                                        <div className="space-y-2.5">
                                            {sortedModels.map(([model, stats]) => (
                                                <div key={model}>
                                                    <div className="flex justify-between text-[11px] mb-1">
                                                        <span className="text-slate-300 font-mono">{model}</span>
                                                        <span className="text-slate-500">{stats.calls}회 / {formatNumber(stats.tokens)}</span>
                                                    </div>
                                                    <div className="w-full bg-slate-700/50 rounded-full h-1.5">
                                                        <div className="bg-purple-500 h-1.5 rounded-full" style={{ width: `${Math.max(3, (stats.tokens / maxModelTokens) * 100)}%` }} />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* 기능별 */}
                                <div className="bg-[#1E293B] rounded-xl border border-white/5 p-4">
                                    <h3 className="text-xs font-bold text-slate-400 mb-3 flex items-center gap-1.5">
                                        <Activity size={12} className="text-blue-400" /> 기능별 사용량
                                    </h3>
                                    {sortedFeatures.length === 0 ? (
                                        <p className="text-xs text-slate-500">데이터 없음</p>
                                    ) : (
                                        <div className="space-y-2.5">
                                            {sortedFeatures.map(([feature, stats]) => (
                                                <div key={feature}>
                                                    <div className="flex justify-between text-[11px] mb-1">
                                                        <span className="text-slate-300">{FEATURE_LABELS[feature] || feature}</span>
                                                        <span className="text-slate-500">{stats.calls}회 / {formatNumber(stats.tokens)}</span>
                                                    </div>
                                                    <div className="w-full bg-slate-700/50 rounded-full h-1.5">
                                                        <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${Math.max(3, (stats.tokens / maxFeatureTokens) * 100)}%` }} />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* 날짜별 */}
                            {sortedDates.length > 0 && (
                                <div className="bg-[#1E293B] rounded-xl border border-white/5 p-4">
                                    <h3 className="text-xs font-bold text-slate-400 mb-3 flex items-center gap-1.5">
                                        <BarChart3 size={12} className="text-emerald-400" /> 날짜별 사용량
                                    </h3>
                                    <table className="w-full text-[11px]">
                                        <thead>
                                            <tr className="text-slate-500 border-b border-white/5">
                                                <th className="text-left py-1.5 font-medium">날짜</th>
                                                <th className="text-right py-1.5 font-medium">호출</th>
                                                <th className="text-right py-1.5 font-medium">토큰</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sortedDates.slice(0, 10).map(([date, stats]) => (
                                                <tr key={date} className="border-b border-white/5">
                                                    <td className="py-1.5 text-slate-300 font-mono">{date}</td>
                                                    <td className="py-1.5 text-right text-slate-400">{stats.calls}회</td>
                                                    <td className="py-1.5 text-right text-slate-400">{formatNumber(stats.tokens)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* 최근 로그 */}
                            <div className="bg-[#1E293B] rounded-xl border border-white/5 p-4">
                                <h3 className="text-xs font-bold text-slate-400 mb-3">최근 호출 로그</h3>
                                {data.recentEntries.length === 0 ? (
                                    <p className="text-xs text-slate-500 py-4 text-center">아직 호출 기록이 없습니다. 앱을 사용하면 여기에 기록됩니다.</p>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-[11px]">
                                            <thead>
                                                <tr className="text-slate-500 border-b border-white/5">
                                                    <th className="text-left py-1.5 font-medium">시간</th>
                                                    <th className="text-left py-1.5 font-medium">기능</th>
                                                    <th className="text-left py-1.5 font-medium">모델</th>
                                                    <th className="text-right py-1.5 font-medium">토큰</th>
                                                    <th className="text-right py-1.5 font-medium">응답</th>
                                                    <th className="text-center py-1.5 font-medium">상태</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {data.recentEntries.slice(0, 30).map((entry, i) => (
                                                    <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                                                        <td className="py-1 text-slate-400 font-mono whitespace-nowrap">
                                                            {new Date(entry.timestamp).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                                        </td>
                                                        <td className="py-1 text-slate-300">{FEATURE_LABELS[entry.traceName] || entry.traceName}</td>
                                                        <td className="py-1 text-slate-400 font-mono">{entry.model}</td>
                                                        <td className="py-1 text-right text-slate-300">{formatNumber(entry.totalTokens)}</td>
                                                        <td className="py-1 text-right text-slate-400">{formatDuration(entry.durationMs)}</td>
                                                        <td className="py-1 text-center">
                                                            <span className={`inline-block w-1.5 h-1.5 rounded-full ${entry.success ? 'bg-emerald-400' : 'bg-red-400'}`} />
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

function Card({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
    const c: Record<string, string> = {
        blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
        purple: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
        emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
        amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    };
    return (
        <div className={`rounded-xl border p-3 ${c[color]}`}>
            <div className="flex items-center gap-1.5 mb-1">
                {icon}
                <span className="text-[10px] text-slate-400">{label}</span>
            </div>
            <div className="text-xl font-bold">{value}</div>
        </div>
    );
}
