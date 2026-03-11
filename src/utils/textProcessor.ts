import { TOCItem, SplitResult } from './pdfProcessor';

export class TextProcessor {
    private file: File;
    private textContent: string | null = null;

    public getTextContent(): string | null {
        return this.textContent;
    }

    constructor(file: File) {
        this.file = file;
    }

    private async loadMammoth(): Promise<any> {
        if (typeof window !== 'undefined' && (window as any).mammoth) {
            return (window as any).mammoth;
        }

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js";
            script.onload = () => resolve((window as any).mammoth);
            script.onerror = () => reject(new Error('Mammoth.js 로드에 실패했습니다.'));
            document.head.appendChild(script);
        });
    }

    async load(): Promise<void> {
        if (this.file.name.toLowerCase().endsWith('.hwp')) {
            throw new Error('한글(.hwp) 파일은 텍스트 직접 추출을 지원하지 않습니다. PDF나 Word(.docx)로 변환 후 업로드해 주세요.');
        }

        const buffer = await this.file.arrayBuffer();
        const header = new Uint8Array(buffer).slice(0, 4);
        const headerHex = Array.from(header).map(b => b.toString(16).padStart(2, '0')).join('');

        // ZIP/OpenXML (docx, xlsx, pptx) starts with 504b0304
        if (headerHex === '504b0304') {
            try {
                const mammoth = await this.loadMammoth();
                const result = await mammoth.extractRawText({ arrayBuffer: buffer });
                this.textContent = result.value;
                return;
            } catch (e) {
                console.error("Word processing error:", e);
                throw new Error('Word 파일 분석 중 오류가 발생했습니다. PDF로 변환하여 시도해 주세요.');
            }
        }

        this.textContent = await this.file.text();
    }

    /**
     * Finds the position of a title in text using flexible matching.
     * Tries exact match first, then case-insensitive, then keyword-based partial match.
     */
    private findTitlePosition(text: string, title: string, searchFrom: number = 0): number {
        // 1) Exact match
        const exact = text.indexOf(title, searchFrom);
        if (exact !== -1) return exact;

        // 2) Case-insensitive match
        const lowerText = text.toLowerCase();
        const lowerTitle = title.toLowerCase();
        const caseInsensitive = lowerText.indexOf(lowerTitle, searchFrom);
        if (caseInsensitive !== -1) return caseInsensitive;

        // 3) Keyword-based partial match (longest keyword in title)
        const keywords = title.replace(/[^\w\s가-힣]/g, '').split(/\s+/).filter(k => k.length >= 2);
        for (const keyword of keywords.sort((a, b) => b.length - a.length)) {
            const partial = lowerText.indexOf(keyword.toLowerCase(), searchFrom);
            if (partial !== -1) return partial;
        }

        return -1;
    }

    /**
     * Splits text content based on TOC titles.
     * Uses flexible title matching with fallback to even distribution.
     */
    async splitByTOC(tocItems: TOCItem[]): Promise<SplitResult[]> {
        if (this.textContent === null) {
            await this.load();
        }

        const results: SplitResult[] = [];
        const fullText = this.textContent || '';

        // Find all title positions first
        const positions: number[] = [];
        let lastFoundPos = 0;

        for (let i = 0; i < tocItems.length; i++) {
            const pos = this.findTitlePosition(fullText, tocItems[i].title, lastFoundPos);
            if (pos !== -1) {
                positions.push(pos);
                lastFoundPos = pos + 1;
            } else {
                // Fallback: distribute evenly based on text length
                const evenPos = Math.floor((fullText.length / tocItems.length) * i);
                positions.push(Math.max(lastFoundPos, evenPos));
            }
        }

        for (let i = 0; i < tocItems.length; i++) {
            const startIdx = positions[i];
            const endIdx = i < tocItems.length - 1 ? positions[i + 1] : fullText.length;

            const sectionContent = fullText.substring(startIdx, endIdx).trim();
            const blob = new Blob([sectionContent], { type: 'text/plain' });

            results.push({
                tocId: tocItems[i].id,
                title: tocItems[i].title,
                blob: blob,
                pageCount: 1,
                textContent: sectionContent || fullText.substring(0, Math.min(500, fullText.length))
            });
        }

        return results;
    }
}
