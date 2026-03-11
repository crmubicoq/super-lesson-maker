/**
 * ContentBlock의 내용을 기반으로 Gemini 아이콘 생성 프롬프트를 빌드합니다.
 * 프레젠테이션 슬라이드의 아이콘/일러스트에 최적화된 1:1 비율 이미지를 요청합니다.
 */

export interface IconPromptParams {
    subtitle: string;       // 콘텐츠 블록 소제목
    body: string;           // 콘텐츠 블록 설명
    accentColor?: string;   // 테마 액센트 색상 (hex)
    userStyle?: string;     // 사용자 디자인 스타일
}

export function buildIconPrompt(params: IconPromptParams): string {
    const { subtitle, body, accentColor, userStyle } = params;

    const colorInstruction = accentColor
        ? `Use ${accentColor} as the primary color with a lighter tint for fills.`
        : 'Use a professional blue (#3B82F6) as the primary color.';

    const styleHint = userStyle?.toLowerCase().includes('미니멀') || userStyle?.toLowerCase().includes('minimal')
        ? 'Ultra-minimal line art style.'
        : 'Flat design style with subtle gradients.';

    return [
        `Create a simple, clean icon illustration for a presentation slide.`,
        ``,
        `Concept: "${subtitle}"`,
        `Context: ${body.substring(0, 100)}`,
        ``,
        `Style Requirements:`,
        `- ${styleHint}`,
        `- ${colorInstruction}`,
        `- White or very light solid background (no transparency pattern).`,
        `- Single centered icon/symbol, no surrounding decorations.`,
        `- Do NOT include any text, labels, numbers, or letters.`,
        `- Keep the design very simple - one main visual element only.`,
        `- The icon should clearly represent the concept "${subtitle}".`,
    ].join('\n');
}
