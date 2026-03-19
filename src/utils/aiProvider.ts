/**
 * AI 프로바이더 추상화 — Gemini / Claude 텍스트 생성 통합
 */

export type AIProvider = 'gemini' | 'claude';

export interface AIConfig {
    provider: AIProvider;
    apiKey: string;
}

interface GenerateOptions {
    temperature?: number;
    jsonMode?: boolean;
    signal?: AbortSignal;
}

/**
 * 통합 텍스트 생성 함수
 * provider에 따라 Gemini 또는 Claude API를 호출
 */
export async function generateText(
    config: AIConfig,
    prompt: string,
    options?: GenerateOptions
): Promise<string> {
    if (!config.apiKey) {
        throw new Error('API 키가 설정되지 않았습니다. 설정에서 API 키를 입력해주세요.');
    }

    if (config.provider === 'claude') {
        return callClaude(config.apiKey, prompt, options);
    }
    return callGemini(config.apiKey, prompt, options);
}

async function callGemini(
    apiKey: string,
    prompt: string,
    options?: GenerateOptions
): Promise<string> {
    const model = 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: options?.temperature ?? 0.7,
                ...(options?.jsonMode && { responseMimeType: 'application/json' }),
            },
        }),
        signal: options?.signal,
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(`Gemini API 오류 (${response.status}): ${err.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const textPart = data.candidates?.[0]?.content?.parts?.find((p: { text?: string }) => p.text);
    if (!textPart?.text) {
        throw new Error('Gemini API 응답에 텍스트가 없습니다.');
    }
    return textPart.text;
}

async function callClaude(
    apiKey: string,
    prompt: string,
    options?: GenerateOptions
): Promise<string> {
    const model = 'claude-sonnet-4-6';

    // Claude는 JSON 모드가 없으므로 프롬프트에 지시 추가
    const finalPrompt = options?.jsonMode
        ? `${prompt}\n\n중요: 반드시 유효한 JSON만 출력하세요. JSON 앞뒤에 다른 텍스트나 마크다운 코드블록(\`\`\`)을 절대 넣지 마세요.`
        : prompt;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
            model,
            max_tokens: 16384,
            temperature: options?.temperature ?? 0.7,
            messages: [{ role: 'user', content: finalPrompt }],
        }),
        signal: options?.signal,
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(`Claude API 오류 (${response.status}): ${err.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const textBlock = data.content?.find((b: { type: string; text?: string }) => b.type === 'text');
    if (!textBlock?.text) {
        throw new Error('Claude API 응답에 텍스트가 없습니다.');
    }
    return textBlock.text;
}

/**
 * 요청 헤더에서 AI 설정 추출 (API 라우트용)
 */
export function getAIConfigFromHeaders(headers: Headers): AIConfig {
    const provider = (headers.get('X-AI-Provider') || 'gemini') as AIProvider;
    const apiKey = headers.get('X-API-Key') || '';
    return { provider, apiKey };
}
