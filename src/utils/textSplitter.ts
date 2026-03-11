/**
 * 페이지 범위 기반으로 추출된 텍스트를 분할하는 유틸리티
 * 서버/클라이언트 양쪽에서 사용
 */

export function getTextForPageRange(fullText: string, pageRange: string): string {
    const parts = pageRange.split('-');
    const startPage = parseInt(parts[0]?.trim(), 10) || 1;
    const endPage = parseInt(parts[1]?.trim(), 10) || startPage;

    const pagePattern = /\[Page (\d+)\]\n/g;
    const pagePositions: { page: number; index: number }[] = [];
    let match;
    while ((match = pagePattern.exec(fullText)) !== null) {
        pagePositions.push({ page: parseInt(match[1], 10), index: match.index });
    }

    if (pagePositions.length === 0) {
        // [Page N] 마커가 없으면 전체를 균등 분할
        const totalChars = fullText.length;
        const totalPages = 10;
        const charStart = Math.floor((totalChars / totalPages) * (startPage - 1));
        const charEnd = Math.floor((totalChars / totalPages) * endPage);
        return fullText.substring(charStart, charEnd).trim();
    }

    const startPos = pagePositions.find(p => p.page === startPage);
    const endNextPos = pagePositions.find(p => p.page === endPage + 1);

    const fromIdx = startPos ? startPos.index : 0;
    const toIdx = endNextPos ? endNextPos.index : fullText.length;

    return fullText.substring(fromIdx, toIdx).trim();
}
