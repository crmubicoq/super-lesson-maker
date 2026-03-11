import { TOCItem } from './pdfProcessor';
import { SlideLayout, StructuredSlideContent } from '@/types/slide';

export interface AIAnalysisResult {
    toc: TOCItem[];
    summary: string;
    styleSuggestions: string;
}

export class AIService {
    /**
     * Gemini API를 호출하여 원고 텍스트에서 목차를 분석합니다.
     * API 실패 시 로컬 휴리스틱으로 폴백합니다.
     */
    async analyzeTOC(fullText: string, fileName: string): Promise<AIAnalysisResult> {
        console.log(`[AIService] Analyzing TOC from "${fileName}" via Gemini...`);

        try {
            const response = await fetch('/api/analyze-toc', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fullText, fileName }),
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const result = await response.json();

            if (result.toc && Array.isArray(result.toc)) {
                console.log(`[AIService] Gemini returned ${result.toc.length} chapters`);
                return {
                    toc: result.toc,
                    summary: result.summary || 'AI가 문서의 구조를 분석하여 최적의 강의 흐름을 설계했습니다.',
                    styleSuggestions: result.styleSuggestions || 'Professional, Minimalist',
                };
            }

            throw new Error('Invalid response: toc array missing');
        } catch (error) {
            console.warn('[AIService] Gemini TOC 분석 실패, 휴리스틱 폴백:', error);
            return this.fallbackAnalyzeTOC(fullText);
        }
    }

    /**
     * 폴백: 휴리스틱 기반 목차 추출
     */
    private fallbackAnalyzeTOC(fullText: string): AIAnalysisResult {
        const lines = fullText.split('\n');
        const proposedTOC: TOCItem[] = [];
        let idCounter = 1;

        const headerPatterns = [
            /^[0-9]+\.\s+.+/,
            /^제[0-9]+장\s+.+/,
            /^[IVXLCDM]+\.\s+.+/,
            /^CHAPTER\s+[0-9]/i,
            /^#\s+.+/,
        ];

        if (fullText.length > 200) {
            for (let i = 0; i < lines.length && proposedTOC.length < 6; i++) {
                const line = lines[i].trim();
                if (line.startsWith('[Page')) continue;
                const isHeader = headerPatterns.some(p => p.test(line));
                if (isHeader && line.length > 3 && line.length < 50) {
                    proposedTOC.push({
                        id: String(idCounter++),
                        title: line.replace(/^[0-9.\s]+/, '').replace(/^#\s+/, '').trim(),
                        pageRange: '자동분배',
                    });
                }
            }
        }

        if (proposedTOC.length === 0 && fullText.length > 50) {
            const contentLines = lines.filter(l => l.trim() && !l.trim().startsWith('[Page'));
            const chunks = Math.min(3, Math.max(1, Math.floor(contentLines.length / 20)));
            const chunkSize = Math.floor(contentLines.length / chunks);
            for (let i = 0; i < chunks; i++) {
                const sampleLine = contentLines[i * chunkSize]?.trim() || '';
                const cleanTitle = sampleLine.substring(0, 25).replace(/\s+/g, ' ');
                proposedTOC.push({
                    id: String(idCounter++),
                    title: cleanTitle.length > 5 ? cleanTitle : `원고 섹션 ${i + 1}`,
                    pageRange: '자동분배',
                });
            }
        }

        if (proposedTOC.length === 0) {
            proposedTOC.push({ id: '1', title: '분석된 내용이 없습니다 (원고 확인 필요)', pageRange: '1-1' });
        }

        const totalPages = (fullText.match(/\[Page [0-9]+\]/g) || []).length || 10;
        const avgPages = Math.max(1, Math.floor(totalPages / proposedTOC.length));

        proposedTOC.forEach((item, index) => {
            if (item.pageRange === '자동분배') {
                const start = index * avgPages + 1;
                const end = index === proposedTOC.length - 1 ? totalPages : (index + 1) * avgPages;
                item.pageRange = `${start}-${end}`;
            }
        });

        return {
            toc: proposedTOC,
            summary: 'AI가 문서의 구조를 분석하여 최적의 강의 흐름을 설계했습니다.',
            styleSuggestions: 'Professional, Minimalist',
        };
    }

    /**
     * Refines slide content based on the original raw context and requested style.
     */
    async optimizeSlideContent(rawText: string, slideTitle: string, style?: string): Promise<string[]> {
        // Simulating LLM summarization by extracting the most meaningful snippets.
        console.log(`[AIService] Optimizing content for: ${slideTitle} (Style: ${style})`);

        const sentences = rawText
            .split(/[.?!]\s+|\n/)
            .map(s => s.trim())
            .filter(s => s.length > 5);

        const isCompactStyle = style?.toLowerCase().includes('compact') || style?.toLowerCase().includes('notebooklm') || style?.includes('간결');

        if (sentences.length > 0) {
            // Filter out meta-sentences (instructions about styles/backgrounds)
            const knowledgeSentences = sentences.filter(s => {
                const lower = s.toLowerCase();
                return !lower.includes('background:') &&
                    !lower.includes('style:') &&
                    !lower.includes('typography:') &&
                    !lower.includes('사용하세요') &&
                    !lower.includes('제안했습니다');
            });

            const targetSentences = knowledgeSentences.length > 0 ? knowledgeSentences : sentences;

            // Sort sentences by length to find the most "informative" ones
            const informativeSentences = [...targetSentences].sort((a, b) => b.length - a.length);
            const topSentences = informativeSentences.slice(0, 3);

            let result = targetSentences.filter(s => topSentences.includes(s)).slice(0, 3).map(s => {
                let text = s;

                // Compact Style Transformation: Convert to Noun-ending (명사형 종결어미)
                if (isCompactStyle) {
                    text = text.replace(/입니다|함께합니다|다 다$/g, '함')
                        .replace(/습니다$/g, '음')
                        .replace(/해요$/g, '함')
                        .replace(/이다$/g, '임')
                        .replace(/하는 것입니다$/g, '함')
                        .replace(/위한 것입니다$/g, '위함');

                    // Simple regex based "Short-form" enforcement
                    if (!text.endsWith('함') && !text.endsWith('음') && !text.endsWith('임') && !text.endsWith('음.')) {
                        if (text.endsWith('.')) text = text.slice(0, -1);
                        // Add professional noun-ending if it doesn't have one
                        if (text.length > 20) text += '함';
                    }
                }

                let formatted = text.length > 80 ? text.substring(0, 77) + "..." : text;
                return formatted + (formatted.endsWith('.') || formatted.endsWith('...') ? '' : '.');
            });

            if (result.length < 3) {
                result.push(isCompactStyle ? `핵심 원고 데이터 분석 및 구조화 완료함.` : `업로드하신 "${slideTitle}" 관련 핵심 문맥을 보강해 주세요.`);
            }
            return result;
        }

        return isCompactStyle ? [
            `"${slideTitle}" 핵심 분석 포인트 도출함.`,
            "원고 데이터 기반 요약 완료함.",
            "강의 품질 향상을 위한 상단 가이드 제안임."
        ] : [
            `"${slideTitle}"에 대한 주요 분석 포인트입니다.`,
            "업로드하신 원고의 핵심 데이터를 기반으로 내용을 구성했습니다.",
            "팀장님의 명품 강의를 위한 최적의 브리핑 문구입니다."
        ];
    }

    /**
     * 섹션 전체 슬라이드를 배치 생성합니다.
     * Gemini API를 한 번 호출하여 섹션의 모든 슬라이드 구조를 한꺼번에 결정합니다.
     * API 실패 시 로컬 휴리스틱으로 폴백합니다.
     */
    async generateSectionSlides(
        rawText: string,
        sectionTitle: string,
        slidesPerSection: number,
        userStyle: string,
        template: string = 'lecture'
    ): Promise<StructuredSlideContent[]> {
        console.log(`[AIService] Batch generation for: "${sectionTitle}" (${slidesPerSection}장, rawText: ${rawText.length}자, template: ${template})`);

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 180000);

            const response = await fetch('/api/generate-slide-content', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    rawText,
                    sectionTitle,
                    slidesPerSection,
                    userStyle,
                    template,
                }),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errText = await response.text();
                console.error(`[AIService] API error ${response.status}:`, errText);
                throw new Error(`API error: ${response.status}`);
            }

            const result = await response.json();

            if (result.slides && Array.isArray(result.slides)) {
                console.log(`[AIService] Gemini returned ${result.slides.length} slides for "${sectionTitle}"`);
                return result.slides as StructuredSlideContent[];
            }

            throw new Error('Invalid response: slides array missing');
        } catch (error) {
            console.warn('[AIService] Gemini 배치 호출 실패, 휴리스틱 폴백:', error);
            return this.fallbackSectionSlides(rawText, sectionTitle, slidesPerSection);
        }
    }

    /**
     * 폴백: 다양한 레이아웃으로 섹션 슬라이드 N개 생성
     */
    private fallbackSectionSlides(
        rawText: string,
        sectionTitle: string,
        slidesPerSection: number
    ): StructuredSlideContent[] {
        const sentences = rawText
            .split(/[.?!]\s+|\n/)
            .map(s => s.trim())
            .filter(s => s.length > 10);

        const usable = sentences.filter(s => {
            const lower = s.toLowerCase();
            return !lower.includes('background:') &&
                !lower.includes('style:') &&
                !lower.includes('typography:');
        });

        const content = usable.length > 0 ? usable : sentences;
        const sentencesPerSlide = Math.max(1, Math.floor(content.length / slidesPerSection));
        const slides: StructuredSlideContent[] = [];

        // 다양한 레이아웃 순환 (grid_2x2 편향 방지)
        const middleLayouts: SlideLayout[] = ['bullet_list', 'title_body', 'content_image', 'bullet_list'];

        for (let i = 0; i < slidesPerSection; i++) {
            const start = i * sentencesPerSlide;
            const end = i === slidesPerSection - 1 ? content.length : (i + 1) * sentencesPerSlide;
            const chunk = content.slice(start, end);

            if (i === 0) {
                slides.push(this.buildCoverSlide(sectionTitle, chunk));
            } else if (i === slidesPerSection - 1) {
                slides.push(this.buildSummarySlide(sectionTitle, chunk));
            } else {
                const layoutChoice = middleLayouts[(i - 1) % middleLayouts.length];
                if (layoutChoice === 'title_body') {
                    slides.push({
                        slideTitle: sectionTitle,
                        layout: 'title_body',
                        bodyText: chunk.join(' ').substring(0, 200),
                        speakerNotes: `"${sectionTitle}" 핵심 설명입니다.`,
                    });
                } else if (layoutChoice === 'content_image') {
                    slides.push({
                        slideTitle: sectionTitle,
                        layout: 'content_image',
                        bulletPoints: chunk.slice(0, 4).map(s => s.length > 60 ? s.substring(0, 57) + '...' : s),
                        speakerNotes: `"${sectionTitle}" 시각 자료와 함께 설명합니다.`,
                    });
                } else {
                    slides.push(this.buildBulletSlide(sectionTitle, chunk));
                }
            }
        }

        return slides;
    }

    private buildCoverSlide(title: string, sentences: string[]): StructuredSlideContent {
        const bodyText = sentences.slice(0, 2).join(' ').substring(0, 150);
        return {
            slideTitle: title,
            layout: 'cover' as SlideLayout,
            bodyText: bodyText || `${title}에 대한 핵심 내용을 다룹니다.`,
            speakerNotes: `"${title}" 섹션의 도입부입니다. 전체 맥락을 소개해 주세요.`,
        };
    }

    private buildSummarySlide(title: string, sentences: string[]): StructuredSlideContent {
        const bodyText = sentences.length > 0
            ? sentences.slice(-3).join(' ').substring(0, 200)
            : `${title}의 핵심 내용을 정리합니다.`;
        return {
            slideTitle: `${title}: 정리`,
            layout: 'title_body' as SlideLayout,
            bodyText,
            bulletPoints: sentences.slice(-3).map(s =>
                s.length > 80 ? s.substring(0, 77) + '...' : s
            ),
            speakerNotes: `"${title}" 섹션의 마무리입니다. 핵심을 요약해 주세요.`,
        };
    }

    private buildBulletSlide(title: string, sentences: string[]): StructuredSlideContent {
        const bullets = sentences.slice(0, 4).map(s =>
            s.length > 80 ? s.substring(0, 77) + '...' : s
        );

        if (bullets.length === 0) {
            bullets.push(`"${title}" 관련 핵심 내용입니다.`);
        }

        return {
            slideTitle: title,
            layout: 'bullet_list' as SlideLayout,
            bulletPoints: bullets,
            speakerNotes: `"${title}" 섹션의 주요 포인트를 다룹니다.`,
        };
    }

}
