'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, RefreshCw, Zap, Clock, Hash, Cpu, BarChart3, Activity } from 'lucide-react';
import Link from 'next/link';

interface ModelStats {
    calls: number;
    tokens: number;
    inputTokens: number;
    outputTokens: number;
}

interface DateStats {
    calls: number;
    tokens: number;
}

interface UsageEntry {
    timestamp: string;
    traceName: string;
    model: string;
    provider: 'gemini' | 'claude';
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    durationMs: number;
    success: boolean;
}

interface UsageSummary {
    totalCalls: number;
    totalTokens: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    avgDurationMs: number;
    byModel: Record<string, ModelStats>;
    byFeature: Record<string, ModelStats>;
    byDate: Record<string, DateStats>;
    recentEntries: UsageEntry[];
}

const FEATURE_LABELS: Record<string, string> = {
    'analyze-structure': '문서 구조 분석',
    'generate-all-in-one': '전체 초안 생성',
    'generate-section-slides': '섹션 슬라이드 생성',
    'extract-key-points': '핵심 포인트 추출',
    'generate-slide-content': '슬라이드 콘텐츠',
    'analyze-toc': '목차 분석',
    'summarize-slide': '텍스트 정리',
    'generate-slide-image': '이미지 생성',
    'partial-edit': '부분 수정',
    'analyze-style': '스타일 분석',
    'validate-text': '텍스트 검증',
    'extract-pdf-ocr': 'PDF OCR',
    'ocr-analyze': '이미지 OCR',
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

export default function UsagePage() {
    const [data, setData] = useState<UsageSummary | null>(null);
    const [loading, setLoading] = useState(true);
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

    useEffect(() => { fetchData(); }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#1E293B] flex items-center justify-center">
                <div className="text-slate-400 flex items-center gap-2">
                    <RefreshCw size={16} className="animate-spin" /> 로딩 중...
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-[#1E293B] flex items-center justify-center">
                <div className="text-red-400">{error}</div>
            </div>
        );
    }

    if (!data) return null;

    const sortedModels = Object.entries(data.byModel).sort((a, b) => b[1].tokens - a[1].tokens);
    const sortedFeatures = Object.entries(data.byFeature).sort((a, b) => b[1].tokens - a[1].tokens);
    const sortedDates = Object.entries(data.byDate).sort((a, b) => b[0].localeCompare(a[0]));

    // 모델별 최대 토큰 (바 차트 비율 계산용)
    const maxModelTokens = sortedModels.length > 0 ? sortedModels[0][1].tokens : 1;
    const maxFeatureTokens = sortedFeatures.length > 0 ? sortedFeatures[0][1].tokens : 1;

    return (
        <div className="min-h-screen bg-[#1E293B] text-slate-200">
            {/* 헤더 */}
            <div className="border-b border-white/10 bg-[#1E293B]/90 backdrop-blur sticky top-0 z-10">
                <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href="/" className="text-slate-400 hover:text-white transition-colors">
                            <ArrowLeft size={20} />
                        </Link>
                        <BarChart3 size={20} className="text-purple-400" />
                        <h1 className="text-lg font-bold">API 사용량 대시보드</h1>
                    </div>
                    <button
                        onClick={fetchData}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm transition-colors"
                    >
                        <RefreshCw size={14} />
                        새로고침
                    </button>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
                {/* 요약 카드 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <SummaryCard icon={<Hash size={18} />} label="총 호출" value={formatNumber(data.totalCalls)} color="blue" />
                    <SummaryCard icon={<Zap size={18} />} label="총 토큰" value={formatNumber(data.totalTokens)} color="purple" />
                    <SummaryCard icon={<Cpu size={18} />} label="입력 토큰" value={formatNumber(data.totalInputTokens)} color="emerald" />
                    <SummaryCard icon={<Clock size={18} />} label="평균 응답" value={formatDuration(data.avgDurationMs)} color="amber" />
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                    {/* 모델별 사용량 */}
                    <div className="bg-[#334155] rounded-xl border border-white/10 p-5">
                        <h2 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
                            <Cpu size={14} className="text-purple-400" />
                            모델별 사용량
                        </h2>
                        {sortedModels.length === 0 ? (
                            <p className="text-sm text-slate-500">아직 데이터가 없습니다</p>
                        ) : (
                            <div className="space-y-3">
                                {sortedModels.map(([model, stats]) => (
                                    <div key={model}>
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="text-slate-300 font-mono">{model}</span>
                                            <span className="text-slate-400">{stats.calls}회 / {formatNumber(stats.tokens)} 토큰</span>
                                        </div>
                                        <div className="w-full bg-slate-600/50 rounded-full h-2">
                                            <div
                                                className="bg-purple-500 h-2 rounded-full transition-all"
                                                style={{ width: `${Math.max(2, (stats.tokens / maxModelTokens) * 100)}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* 기능별 사용량 */}
                    <div className="bg-[#334155] rounded-xl border border-white/10 p-5">
                        <h2 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
                            <Activity size={14} className="text-blue-400" />
                            기능별 사용량
                        </h2>
                        {sortedFeatures.length === 0 ? (
                            <p className="text-sm text-slate-500">아직 데이터가 없습니다</p>
                        ) : (
                            <div className="space-y-3">
                                {sortedFeatures.map(([feature, stats]) => (
                                    <div key={feature}>
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="text-slate-300">{FEATURE_LABELS[feature] || feature}</span>
                                            <span className="text-slate-400">{stats.calls}회 / {formatNumber(stats.tokens)} 토큰</span>
                                        </div>
                                        <div className="w-full bg-slate-600/50 rounded-full h-2">
                                            <div
                                                className="bg-blue-500 h-2 rounded-full transition-all"
                                                style={{ width: `${Math.max(2, (stats.tokens / maxFeatureTokens) * 100)}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* 날짜별 사용량 */}
                {sortedDates.length > 0 && (
                    <div className="bg-[#334155] rounded-xl border border-white/10 p-5">
                        <h2 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
                            <BarChart3 size={14} className="text-emerald-400" />
                            날짜별 사용량
                        </h2>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="text-slate-400 border-b border-white/5">
                                        <th className="text-left py-2 font-medium">날짜</th>
                                        <th className="text-right py-2 font-medium">호출</th>
                                        <th className="text-right py-2 font-medium">토큰</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedDates.slice(0, 14).map(([date, stats]) => (
                                        <tr key={date} className="border-b border-white/5">
                                            <td className="py-2 text-slate-300 font-mono">{date}</td>
                                            <td className="py-2 text-right text-slate-400">{stats.calls}회</td>
                                            <td className="py-2 text-right text-slate-400">{formatNumber(stats.tokens)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* 최근 호출 로그 */}
                <div className="bg-[#334155] rounded-xl border border-white/10 p-5">
                    <h2 className="text-sm font-bold text-slate-300 mb-4">최근 호출 로그 (최대 50건)</h2>
                    {data.recentEntries.length === 0 ? (
                        <p className="text-sm text-slate-500">아직 호출 기록이 없습니다. 앱을 사용하면 여기에 기록됩니다.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="text-slate-400 border-b border-white/5">
                                        <th className="text-left py-2 font-medium">시간</th>
                                        <th className="text-left py-2 font-medium">기능</th>
                                        <th className="text-left py-2 font-medium">모델</th>
                                        <th className="text-right py-2 font-medium">입력</th>
                                        <th className="text-right py-2 font-medium">출력</th>
                                        <th className="text-right py-2 font-medium">총 토큰</th>
                                        <th className="text-right py-2 font-medium">응답시간</th>
                                        <th className="text-center py-2 font-medium">상태</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.recentEntries.map((entry, i) => (
                                        <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                                            <td className="py-1.5 text-slate-400 font-mono whitespace-nowrap">
                                                {new Date(entry.timestamp).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                            </td>
                                            <td className="py-1.5 text-slate-300">{FEATURE_LABELS[entry.traceName] || entry.traceName}</td>
                                            <td className="py-1.5 text-slate-400 font-mono">{entry.model}</td>
                                            <td className="py-1.5 text-right text-slate-400">{formatNumber(entry.inputTokens)}</td>
                                            <td className="py-1.5 text-right text-slate-400">{formatNumber(entry.outputTokens)}</td>
                                            <td className="py-1.5 text-right text-slate-300 font-medium">{formatNumber(entry.totalTokens)}</td>
                                            <td className="py-1.5 text-right text-slate-400">{formatDuration(entry.durationMs)}</td>
                                            <td className="py-1.5 text-center">
                                                <span className={`inline-block w-2 h-2 rounded-full ${entry.success ? 'bg-emerald-400' : 'bg-red-400'}`} />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function SummaryCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
    const colorMap: Record<string, string> = {
        blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
        purple: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
        emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
        amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    };
    return (
        <div className={`rounded-xl border p-4 ${colorMap[color]}`}>
            <div className="flex items-center gap-2 mb-2">
                {icon}
                <span className="text-xs text-slate-400">{label}</span>
            </div>
            <div className="text-2xl font-bold">{value}</div>
        </div>
    );
}
