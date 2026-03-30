import {
    Slide, SlideContent, StyleProfile, PipelineProgress, PipelineStage,
    StructuredSlideContent, ContentBlock,
} from '@/types/slide';

// contentBlocks를 bodyText에 병합 (이미지 생성 시 누락 방지)
function buildEffectiveBodyText(bodyText?: string, contentBlocks?: ContentBlock[]): string | undefined {
    const blockText = contentBlocks?.length
        ? contentBlocks.map(b => `${b.subtitle}: ${b.body}`).join('\n')
        : '';
    const combined = [bodyText, blockText].filter(Boolean).join('\n\n');
    return combined || undefined;
}
import { SplitResult } from './pdfProcessor';
import { AIService } from './aiService';

const MAX_CONCURRENT = 2;

export type PipelineCallback = (progress: PipelineProgress) => void;

interface SlideImageGeneratorOptions {
    userStyle: string;
    slidesPerSection: number;
    styleReferenceImages?: string[];   // base64 다중 스타일 참고 이미지 배열
    onProgress?: PipelineCallback;
    geminiApiKey?: string;
}

/**
 * v3 슬라이드 이미지 생성 파이프라인
 * 6단계: normalizing → analyzing_style → analyzing_content → generating → validating_text → completed
 */
export class SlideImageGenerator {
    private options: SlideImageGeneratorOptions;
    private styleProfile: StyleProfile | null = null;

    constructor(options: SlideImageGeneratorOptions) {
        this.options = options;
    }

    private report(stage: PipelineStage, stageProgress: number, overall: number, message: string, current?: number, total?: number) {
        this.options.onProgress?.({
            stage,
            stageProgress,
            overallProgress: overall,
            currentSlide: current,
            totalSlides: total,
            message,
        });
    }

    /**
     * 원고 텍스트에서 슬라이드 이미지 생성 (메인 플로우)
     */
    async generateFromText(splitResults: SplitResult[]): Promise<Slide[]> {
        // Stage 1: normalizing — 텍스트 입력이므로 스킵
        this.report('normalizing', 100, 5, '텍스트 입력 — 정규화 스킵');

        // Stage 2: analyzing_style
        this.report('analyzing_style', 0, 10, '스타일 분석 중...');
        await this.analyzeStyle();
        this.report('analyzing_style', 100, 15, '스타일 분석 완료');

        // Stage 3: analyzing_content
        this.report('analyzing_content', 0, 20, '콘텐츠 분석 중...');
        const slideContents = await this.analyzeTextContent(splitResults);
        this.report('analyzing_content', 100, 30, `${slideContents.length}장 콘텐츠 분석 완료`);

        // Stage 4: generating
        const slides = await this.generateImages(slideContents, splitResults);

        // Stage 5: validating_text
        await this.validateTexts(slides);

        // Stage 6: completed
        this.report('completed', 100, 100, '슬라이드 생성 완료!');

        return slides;
    }

    /**
     * Stage 2: 스타일 분석
     */
    private async analyzeStyle(): Promise<void> {
        try {
            const response = await fetch('/api/analyze-style', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(this.options.geminiApiKey && { 'X-Gemini-Key': this.options.geminiApiKey }),
                },
                body: JSON.stringify({
                    imagesBase64: this.options.styleReferenceImages || [],
                    textPrompt: this.options.userStyle,
                }),
            });

            if (response.ok) {
                const { styleProfile } = await response.json();
                this.styleProfile = styleProfile;
                console.log('[Pipeline] Style analyzed:', styleProfile.layoutStyle || 'custom');
            }
        } catch (error) {
            console.warn('[Pipeline] Style analysis failed, using text prompt:', error);
            this.styleProfile = {
                colorPalette: [],
                layoutStyle: 'custom',
                typography: '',
                mood: '',
                rawDescription: this.options.userStyle,
            };
        }
    }

    /**
     * Stage 3: 원고 텍스트 → 슬라이드별 콘텐츠 분석 (기존 배치 메서드 재활용)
     */
    private async analyzeTextContent(splitResults: SplitResult[]): Promise<Array<SlideContent & { chapterId: string; chapterTitle: string }>> {
        const ai = new AIService();
        const allContents: Array<SlideContent & { chapterId: string; chapterTitle: string }> = [];

        for (let sIdx = 0; sIdx < splitResults.length; sIdx++) {
            const section = splitResults[sIdx];
            const progress = Math.round(((sIdx + 1) / splitResults.length) * 100);
            this.report('analyzing_content', progress, 20 + Math.round(progress * 0.1), `콘텐츠 분석: ${section.title}`);

            const structured: StructuredSlideContent[] = await ai.generateSectionSlides(
                section.textContent,
                section.title,
                this.options.slidesPerSection,
                this.options.userStyle
            );

            for (const s of structured) {
                allContents.push({
                    slideTitle: s.slideTitle,
                    bodyText: s.bodyText,
                    bulletPoints: s.bulletPoints,
                    layoutHint: s.layout,
                    chapterId: section.tocId,
                    chapterTitle: section.title,
                });
            }
        }

        return allContents;
    }

    /**
     * Stage 4: 슬라이드 이미지 생성 (병렬, 최대 3개)
     */
    private async generateImages(
        contents: Array<SlideContent & { chapterId: string; chapterTitle: string }>,
        splitResults: SplitResult[]
    ): Promise<Slide[]> {
        const total = contents.length;
        let completed = 0;

        this.report('generating', 0, 30, `슬라이드 이미지 생성 준비 (${total}장)...`, 0, total);

        // 스타일 설명 문자열 구성
        const styleDesc = this.styleProfile?.rawDescription || this.options.userStyle;

        const slides: Slide[] = contents.map((c, i) => ({
            id: `slide-${c.chapterId}-${i + 1}`,
            chapterId: c.chapterId,
            chapterTitle: c.chapterTitle,
            slideTitle: c.slideTitle,
            content: c.bulletPoints || [],
            bodyText: c.bodyText,
            layout: (c.layoutHint || 'bullet_list') as Slide['layout'],
            designStyle: styleDesc,
            speakerNotes: '',
            generatedImageUrl: undefined,
            textValidated: false,
            validationAttempts: 0,
        }));

        // 생성 태스크
        const tasks = slides.map((slide, idx) => async () => {
            this.report(
                'generating',
                Math.round((completed / total) * 100),
                30 + Math.round((completed / total) * 50),
                `이미지 생성: ${slide.slideTitle}`,
                completed + 1,
                total
            );

            try {
                const res = await this.fetchWithRetry('/api/generate-slide-image', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(this.options.geminiApiKey && { 'X-Gemini-Key': this.options.geminiApiKey }),
                    },
                    body: JSON.stringify({
                        slideTitle: slide.slideTitle,
                        bodyText: buildEffectiveBodyText(slide.bodyText, slide.contentBlocks),
                        bulletPoints: slide.content,
                        slideNumber: idx + 1,
                        totalSlides: total,
                        styleDescription: styleDesc,
                        referenceImagesBase64: this.styleProfile?.referenceImagesBase64,
                    }),
                });

                if (res.ok) {
                    const data = await res.json();
                    slide.generatedImageUrl = data.imageUrl;
                    slide.generatedImageBase64 = data.imageBase64; // 로컬 내보내기를 위한 순수 데이터
                    slide.imageUrl = data.imageUrl;
                } else {
                    console.warn(`[Pipeline] Image generation failed for slide ${idx + 1}, status: ${res.status}`);
                }
            } catch (error) {
                console.error(`[Pipeline] Slide ${idx + 1} error:`, error);
            }

            completed++;
            this.report(
                'generating',
                Math.round((completed / total) * 100),
                30 + Math.round((completed / total) * 50),
                `이미지 생성 완료: ${slide.slideTitle}`,
                completed,
                total
            );
        });

        await this.runConcurrent(tasks, MAX_CONCURRENT);
        return slides;
    }

    /**
     * Stage 5: 텍스트 검증 (병렬)
     */
    private async validateTexts(slides: Slide[]): Promise<void> {
        const total = slides.length;
        let completed = 0;

        this.report('validating_text', 0, 80, '텍스트 검증 시작...', 0, total);

        const tasks = slides.map((slide) => async () => {
            if (!slide.generatedImageUrl) {
                completed++;
                return;
            }

            try {
                // 이미지 URL에서 base64 로드 (로컬 경로)
                const imgRes = await fetch(slide.generatedImageUrl);
                if (!imgRes.ok) {
                    completed++;
                    return;
                }

                const imgBuffer = await imgRes.arrayBuffer();
                const imgBase64 = `data:image/png;base64,${Buffer.from(imgBuffer).toString('base64')}`;

                const res = await fetch('/api/validate-text', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(this.options.geminiApiKey && { 'X-Gemini-Key': this.options.geminiApiKey }),
                    },
                    body: JSON.stringify({
                        imageBase64: imgBase64,
                        expectedTitle: slide.slideTitle,
                        expectedBullets: slide.content,
                        expectedBodyText: slide.bodyText,
                    }),
                });

                if (res.ok) {
                    const validation = await res.json();
                    slide.textValidated = validation.passed;
                    slide.validationIssues = validation.issues || [];
                    slide.validationAttempts = 1;
                }
            } catch (error) {
                console.warn(`[Pipeline] Validation failed for "${slide.slideTitle}"`, error);
            }

            completed++;
            this.report(
                'validating_text',
                Math.round((completed / total) * 100),
                80 + Math.round((completed / total) * 18),
                `텍스트 검증: ${slide.slideTitle}`,
                completed,
                total
            );
        });

        await this.runConcurrent(tasks, MAX_CONCURRENT);
    }

    /**
     * 기존 슬라이드(텍스트 확정)에 대해 이미지만 생성 + 검증
     */
    async generateImagesForSlides(slides: Slide[]): Promise<Slide[]> {
        // Stage 1: normalizing — 스킵
        this.report('normalizing', 100, 5, '텍스트 입력 — 정규화 스킵');

        // Stage 2: analyzing_style
        this.report('analyzing_style', 0, 10, '스타일 분석 중...');
        await this.analyzeStyle();
        this.report('analyzing_style', 100, 15, '스타일 분석 완료');

        // Stage 3: analyzing_content — 스킵 (이미 확정됨)
        this.report('analyzing_content', 100, 30, `${slides.length}장 콘텐츠 확인 완료 (사전 확정)`);

        // designStyle 업데이트
        const styleDesc = this.styleProfile?.rawDescription || this.options.userStyle;
        for (const slide of slides) {
            slide.designStyle = styleDesc;
        }

        // Stage 4: generating
        await this.generateImagesOnly(slides);

        // Stage 5: validating_text
        await this.validateTexts(slides);

        // Stage 6: completed
        this.report('completed', 100, 100, '슬라이드 생성 완료!');

        return slides;
    }

    /**
     * Stage 4 전용: 기존 Slide에 이미지만 생성
     */
    private async generateImagesOnly(slides: Slide[]): Promise<void> {
        const total = slides.length;
        let completed = 0;
        const styleDesc = this.styleProfile?.rawDescription || this.options.userStyle;

        this.report('generating', 0, 30, `슬라이드 이미지 생성 준비 (${total}장)...`, 0, total);

        const tasks = slides.map((slide, idx) => async () => {
            this.report(
                'generating',
                Math.round((completed / total) * 100),
                30 + Math.round((completed / total) * 50),
                `이미지 생성: ${slide.slideTitle}`,
                completed + 1,
                total
            );

            try {
                const res = await this.fetchWithRetry('/api/generate-slide-image', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(this.options.geminiApiKey && { 'X-Gemini-Key': this.options.geminiApiKey }),
                    },
                    body: JSON.stringify({
                        slideTitle: slide.slideTitle,
                        bodyText: buildEffectiveBodyText(slide.bodyText, slide.contentBlocks),
                        bulletPoints: slide.content,
                        slideNumber: idx + 1,
                        totalSlides: total,
                        styleDescription: styleDesc,
                        referenceImagesBase64: this.options.styleReferenceImages,
                    }),
                });

                if (res.ok) {
                    const data = await res.json();
                    slide.generatedImageUrl = data.imageUrl;
                    slide.imageUrl = data.imageUrl;
                } else {
                    console.warn(`[Pipeline] Image generation failed for slide ${idx + 1}, status: ${res.status}`);
                }
            } catch (error) {
                console.error(`[Pipeline] Slide ${idx + 1} error:`, error);
            }

            completed++;
            this.report(
                'generating',
                Math.round((completed / total) * 100),
                30 + Math.round((completed / total) * 50),
                `이미지 생성 완료: ${slide.slideTitle}`,
                completed,
                total
            );
        });

        await this.runConcurrent(tasks, MAX_CONCURRENT);
    }

    /**
     * API 호출 + 429 재시도 (최대 3회, 지수 백오프)
     */
    private async fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            const res = await fetch(url, options);
            if (res.status === 429 && attempt < maxRetries) {
                // 429 Rate Limit — 대기 후 재시도
                const retryAfter = Math.min(60, Math.pow(2, attempt + 1) * 15); // 30s, 60s, 60s
                console.warn(`[Pipeline] Rate limited (429), retrying in ${retryAfter}s (attempt ${attempt + 1}/${maxRetries})`);
                this.report('generating', -1, -1, `API 할당량 초과 — ${retryAfter}초 후 재시도...`);
                await new Promise(r => setTimeout(r, retryAfter * 1000));
                continue;
            }
            return res;
        }
        // 마지막 시도도 실패하면 마지막 응답 반환
        return fetch(url, options);
    }

    /**
     * 동시성 제한 실행기
     */
    private async runConcurrent(tasks: Array<() => Promise<void>>, limit: number): Promise<void> {
        let idx = 0;
        const runNext = async () => {
            while (idx < tasks.length) {
                const current = idx++;
                await tasks[current]();
            }
        };
        const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => runNext());
        await Promise.all(workers);
    }
}
