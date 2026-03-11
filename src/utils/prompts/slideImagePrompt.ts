/**
 * 프레젠테이션 슬라이드 이미지 생성을 위한 프롬프트 빌더.
 * Gemini gemini-3-pro-image-preview 모델에 최적화된 프롬프트를 생성합니다.
 */

export interface SlideImagePromptParams {
    sectionTitle: string;
    slideIndex: number;
    totalSlidesInSection: number;
    userStyle: string;
    slideText?: string;
}

export function buildSlideImagePrompt(params: SlideImagePromptParams): string {
    const { sectionTitle, slideIndex, totalSlidesInSection, userStyle, slideText } = params;

    const isFirstSlide = slideIndex === 0;
    const isLastSlide = slideIndex === totalSlidesInSection - 1;

    let roleDescription: string;
    if (isFirstSlide) {
        roleDescription = "This is the opening slide. Use a bold, eye-catching composition that introduces the topic.";
    } else if (isLastSlide) {
        roleDescription = "This is the closing slide. Use a composed, summary-like visual.";
    } else {
        roleDescription = "This is a detail slide. Use a focused, informative visual that supports the content.";
    }

    const style = interpretStyle(userStyle);

    const contextLine = slideText
        ? `\nThe slide discusses: "${slideText.substring(0, 150)}"`
        : "";

    return [
        `Generate an illustration for a professional educational presentation slide.`,
        ``,
        `Topic: "${sectionTitle}"`,
        roleDescription,
        contextLine,
        ``,
        `Visual Requirements:`,
        `- Create a clean, modern illustration, NOT a photograph.`,
        `- Use a flat or semi-flat design style with subtle gradients and soft shadows.`,
        `- Color palette: ${style.colorGuidance}`,
        `- Composition: Leave approximately 40% of the image as clean negative space so text can be overlaid.`,
        `- Do NOT include any text, labels, titles, or watermarks in the image.`,
        `- The illustration should use simple iconographic elements related to the topic.`,
        `- Mood: ${style.mood}`,
    ].filter(line => line !== undefined).join('\n');
}

function interpretStyle(userStyle: string): { colorGuidance: string; mood: string } {
    const lower = userStyle.toLowerCase();

    let colorGuidance = "Professional blue-to-indigo palette with white and light gray accents.";
    if (lower.includes('파란') || lower.includes('blue')) {
        colorGuidance = "Blue tones (#3B82F6, #1E40AF) with white and slate accents.";
    } else if (lower.includes('빨간') || lower.includes('red') || lower.includes('warm')) {
        colorGuidance = "Warm reds, corals, and amber tones with cream accents.";
    } else if (lower.includes('초록') || lower.includes('green') || lower.includes('nature')) {
        colorGuidance = "Natural greens, teals, and earth tones with off-white accents.";
    } else if (lower.includes('보라') || lower.includes('purple') || lower.includes('violet')) {
        colorGuidance = "Violet-to-purple gradient with light lavender accents.";
    } else if (lower.includes('모노') || lower.includes('mono') || lower.includes('grayscale')) {
        colorGuidance = "Monochromatic grayscale palette with one subtle blue accent.";
    }

    let mood = "Professional, authoritative, and modern.";
    if (lower.includes('미니멀') || lower.includes('minimal') || lower.includes('간결')) {
        mood = "Minimalist, clean, with maximum whitespace and geometric simplicity.";
    } else if (lower.includes('creative') || lower.includes('창의') || lower.includes('fun')) {
        mood = "Creative, energetic, with playful shapes and vibrant contrasts.";
    } else if (lower.includes('data') || lower.includes('데이터') || lower.includes('analytic')) {
        mood = "Data-driven, analytical, with chart-like abstract elements.";
    } else if (lower.includes('elegant') || lower.includes('luxury') || lower.includes('고급')) {
        mood = "Elegant, sophisticated, with refined composition.";
    }

    return { colorGuidance, mood };
}
