/**
 * 자체 API 사용량 트래커
 * - JSON 파일(data/api-usage.json)에 호출 로그 기록
 * - 외부 서비스 없이 로컬에서 바로 확인 가능
 */
import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const USAGE_FILE = path.join(DATA_DIR, 'api-usage.json');

export interface UsageEntry {
    timestamp: string;
    traceName: string;      // 어떤 기능: 'generate-slide-image', 'analyze-structure' 등
    model: string;          // 어떤 모델: 'gemini-2.5-flash', 'claude-sonnet-4-6' 등
    provider: 'gemini' | 'claude';
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    durationMs: number;     // 응답 시간
    success: boolean;
}

/**
 * Gemini API 응답에서 토큰 사용량 추출
 */
export function extractGeminiTokens(data: Record<string, unknown>): { input: number; output: number; total: number } {
    const meta = data.usageMetadata as Record<string, number> | undefined;
    return {
        input: meta?.promptTokenCount ?? 0,
        output: meta?.candidatesTokenCount ?? 0,
        total: meta?.totalTokenCount ?? 0,
    };
}

/**
 * Claude API 응답에서 토큰 사용량 추출
 */
export function extractClaudeTokens(data: Record<string, unknown>): { input: number; output: number; total: number } {
    const usage = data.usage as Record<string, number> | undefined;
    return {
        input: usage?.input_tokens ?? 0,
        output: usage?.output_tokens ?? 0,
        total: (usage?.input_tokens ?? 0) + (usage?.output_tokens ?? 0),
    };
}

/**
 * 사용량 로그 기록 (fire-and-forget)
 */
export async function trackUsage(entry: UsageEntry): Promise<void> {
    try {
        await mkdir(DATA_DIR, { recursive: true });

        let entries: UsageEntry[] = [];
        try {
            const raw = await readFile(USAGE_FILE, 'utf-8');
            entries = JSON.parse(raw);
        } catch {
            // 파일 없으면 빈 배열로 시작
        }

        entries.push(entry);

        // 최대 10,000건 유지 (오래된 것부터 삭제)
        if (entries.length > 10000) {
            entries = entries.slice(-10000);
        }

        await writeFile(USAGE_FILE, JSON.stringify(entries, null, 2));
    } catch (e) {
        console.warn('[UsageTracker] 기록 실패:', e);
    }
}

/**
 * 전체 사용량 로그 읽기
 */
export async function getUsageEntries(): Promise<UsageEntry[]> {
    try {
        const raw = await readFile(USAGE_FILE, 'utf-8');
        return JSON.parse(raw);
    } catch {
        return [];
    }
}

export interface UsageSummary {
    totalCalls: number;
    totalTokens: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    avgDurationMs: number;
    byModel: Record<string, { calls: number; tokens: number; inputTokens: number; outputTokens: number }>;
    byFeature: Record<string, { calls: number; tokens: number; inputTokens: number; outputTokens: number }>;
    byDate: Record<string, { calls: number; tokens: number }>;
    recentEntries: UsageEntry[];
}

/**
 * 사용량 요약 통계 생성
 */
export async function getUsageSummary(): Promise<UsageSummary> {
    const entries = await getUsageEntries();

    const summary: UsageSummary = {
        totalCalls: entries.length,
        totalTokens: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        avgDurationMs: 0,
        byModel: {},
        byFeature: {},
        byDate: {},
        recentEntries: entries.slice(-50).reverse(),
    };

    let totalDuration = 0;

    for (const e of entries) {
        summary.totalTokens += e.totalTokens;
        summary.totalInputTokens += e.inputTokens;
        summary.totalOutputTokens += e.outputTokens;
        totalDuration += e.durationMs;

        // 모델별
        if (!summary.byModel[e.model]) {
            summary.byModel[e.model] = { calls: 0, tokens: 0, inputTokens: 0, outputTokens: 0 };
        }
        summary.byModel[e.model].calls++;
        summary.byModel[e.model].tokens += e.totalTokens;
        summary.byModel[e.model].inputTokens += e.inputTokens;
        summary.byModel[e.model].outputTokens += e.outputTokens;

        // 기능별
        if (!summary.byFeature[e.traceName]) {
            summary.byFeature[e.traceName] = { calls: 0, tokens: 0, inputTokens: 0, outputTokens: 0 };
        }
        summary.byFeature[e.traceName].calls++;
        summary.byFeature[e.traceName].tokens += e.totalTokens;
        summary.byFeature[e.traceName].inputTokens += e.inputTokens;
        summary.byFeature[e.traceName].outputTokens += e.outputTokens;

        // 날짜별
        const date = e.timestamp.split('T')[0];
        if (!summary.byDate[date]) {
            summary.byDate[date] = { calls: 0, tokens: 0 };
        }
        summary.byDate[date].calls++;
        summary.byDate[date].tokens += e.totalTokens;
    }

    summary.avgDurationMs = entries.length > 0 ? Math.round(totalDuration / entries.length) : 0;

    return summary;
}
