import { NextRequest, NextResponse } from 'next/server';
import { getAIConfigFromHeaders, generateText } from '@/utils/aiProvider';

export const maxDuration = 30;

export async function POST(request: NextRequest) {
    const config = getAIConfigFromHeaders(request.headers);
    if (!config.apiKey) {
        return NextResponse.json({ error: 'API 키가 설정되지 않았습니다. 상단 설정에서 API 키를 입력해주세요.' }, { status: 500 });
    }

    try {
        const { slideTitle, bodyText } = await request.json();

        // 입력 줄 수 계산 (안전장치용)
        const inputLineCount = bodyText
            ? bodyText.split('\n').filter((l: string) => l.trim()).length
            : 0;

        const prompt = `당신은 강의 교안 텍스트 어미 교정 전문가입니다.
이 슬라이드는 수강생이 학습하는 **강의 교안**입니다.

## 작업 정의 (매우 중요)
아래 텍스트의 **구어체 어미만 문어체로 바꾸는 작업**입니다.
단어, 문장, 항목은 **한 글자도 추가·삭제·변경하지 마세요.**
내용을 요약하거나 압축하는 행위는 이 작업의 범위를 완전히 벗어납니다.

## 현재 슬라이드 내용
제목: ${slideTitle || '(없음)'}
본문 (총 ${inputLineCount}줄):
${bodyText || '(없음)'}

## 어미 교정 규칙 (이것만 변경 가능)
- "~라고 할 수 있습니다" → "~이다"
- "~인 것입니다" → "~이다"
- "~하게 됩니다" → "~한다"
- "~할 수 있습니다" → "~할 수 있다"
- "~해야 합니다" → "~해야 한다"
- "~입니다" → "~이다" (고유명사·공식 명칭 제외)
- "~습니다" → "~다"

## 절대 금지
- 항목 삭제, 문장 삭제, 단어 삭제
- 두 문장을 하나로 합치기
- 내용 재구성·재정렬·요약
- **출력 본문은 반드시 ${inputLineCount}줄이어야 합니다 (줄 수 변경 금지)**

## 형식
- 제목: 최대 30자 (어미만 교정, 단어 변경 금지)
- 본문이 없는 경우(표지 등) body는 빈 문자열로 반환

## 출력 형식 (JSON만 출력, 다른 텍스트 금지)
{"slideTitle": "교정된 제목", "body": "교정된 본문 줄1\\n줄2\\n줄3"}`;

        const raw = await generateText(config, prompt, { temperature: 0.3, jsonMode: true });
        const cleaned = raw.replace(/```json\s*|```\s*/g, '').trim();
        const parsed = JSON.parse(cleaned);

        // 안전장치: AI가 지시를 어기고 줄을 삭제한 경우 원본 본문 복원
        const outputLineCount = parsed.body
            ? parsed.body.split('\n').filter((l: string) => l.trim()).length
            : 0;
        const finalBody = (inputLineCount > 0 && outputLineCount < inputLineCount)
            ? bodyText
            : parsed.body;

        const summarizedText = finalBody
            ? `${parsed.slideTitle}\n${finalBody}`
            : parsed.slideTitle;

        return NextResponse.json({ summarizedText });
    } catch (error) {
        console.error('[Summarize Slide Error]', error);
        return NextResponse.json({ error: '텍스트 정리 중 오류가 발생했습니다.' }, { status: 500 });
    }
}
