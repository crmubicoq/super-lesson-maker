import { PDFDocument } from 'pdf-lib';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';

export interface TOCItem {
    id: string;
    title: string;
    pageRange: string; // e.g., "1-3", "4-4"
}

export interface SplitResult {
    tocId: string;
    title: string;
    blob: Blob;
    pageCount: number;
    textContent: string;
}

export class PdfProcessor {
    private file: File;
    private pdfDoc: PDFDocument | null = null;

    constructor(file: File) {
        this.file = file;
    }

    async load(): Promise<void> {
        const arrayBuffer = await this.file.arrayBuffer();
        this.pdfDoc = await PDFDocument.load(arrayBuffer);
    }

    /**
     * Parses a page range string (e.g., "1-3") into zero-based start and end indices.
     */
    private parsePageRange(range: string, totalPages: number): { start: number; end: number } {
        const parts = range.split('-');
        const startStr = parts[0]?.trim();
        const endStr = parts[1]?.trim();

        const start = Math.max(0, (parseInt(startStr, 10) || 1) - 1);
        let end = totalPages - 1;

        if (endStr && endStr.toLowerCase() !== 'end') {
            end = (parseInt(endStr, 10) || (start + 1)) - 1;
        }

        return { start: Math.min(start, totalPages - 1), end: Math.min(end, totalPages - 1) };
    }

    async getPageCount(): Promise<number> {
        if (!this.pdfDoc) {
            await this.load();
        }
        return this.pdfDoc!.getPageCount();
    }

    async extractText(): Promise<string> {
        // Dynamic import to avoid SSR errors with DOMMatrix
        const pdfjs = await import('pdfjs-dist');

        // pdfjs-dist v5: CDN 버전 매칭 워커 사용으로 로컬 파일 의존성 제거
        pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

        const arrayBuffer = await this.file.arrayBuffer();
        const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        let fullText = '';

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items
                .filter((item): item is TextItem => 'str' in item)
                .map((item) => item.str)
                .join(' ');
            fullText += `[Page ${i}]\n${pageText}\n\n`;
        }

        return fullText;
    }

    async splitByTOC(tocItems: TOCItem[]): Promise<SplitResult[]> {
        if (!this.pdfDoc) {
            await this.load();
        }

        const results: SplitResult[] = [];
        const totalPages = this.pdfDoc!.getPageCount();

        // Prepare for text extraction too
        const pdfjs = await import('pdfjs-dist');
        if (!pdfjs.GlobalWorkerOptions.workerSrc) {
            pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
        }
        const arrayBuffer = await this.file.arrayBuffer();
        const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;

        for (const item of tocItems) {
            const { start, end } = this.parsePageRange(item.pageRange, totalPages);

            if (start > end) continue;

            // 1. Create Sub-PDF Blob
            const subDoc = await PDFDocument.create();
            const pageIndices = [];
            for (let i = start; i <= end; i++) {
                pageIndices.push(i);
            }

            const copiedPages = await subDoc.copyPages(this.pdfDoc!, pageIndices);
            copiedPages.forEach((page) => subDoc.addPage(page));
            const pdfBytes = await subDoc.save();
            const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });

            // 2. Extract Text for this section
            let sectionText = '';
            for (let i = start + 1; i <= end + 1; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                sectionText += textContent.items.filter((it): it is TextItem => 'str' in it).map((it) => it.str).join(' ') + '\n';
            }

            results.push({
                tocId: item.id,
                title: item.title,
                blob: blob,
                pageCount: pageIndices.length,
                textContent: sectionText.trim()
            });
        }

        return results;
    }
}
