"use client";

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { TextOverlay, OverlayRect } from '@/types/slide';

interface TextOverlayCanvasProps {
    imageUrl: string;
    overlays: TextOverlay[];
    selectedOverlayId: string | null;
    onSelectionChange: (rect: OverlayRect | null) => void;
    onOverlaySelect: (id: string | null) => void;
    onUpdateOverlays: (overlays: TextOverlay[]) => void;
}

interface Point {
    x: number;
    y: number;
}

const HANDLE_SIZE = 8;
const MIN_RECT_SIZE = 10;
const PRIMARY_COLOR = '#3b82f6';
const OVERLAY_COLOR = 'rgba(59, 130, 246, 0.2)';

export default function TextOverlayCanvas({
    imageUrl,
    overlays,
    selectedOverlayId,
    onSelectionChange,
    onOverlaySelect,
    onUpdateOverlays,
}: TextOverlayCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const [image, setImage] = useState<HTMLImageElement | null>(null);
    const [scale, setScale] = useState(1);
    const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });

    const [selection, setSelection] = useState<OverlayRect | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [isDraggingOverlay, setIsDraggingOverlay] = useState(false);
    const [startPoint, setStartPoint] = useState<Point | null>(null);

    // 이미지 로드 및 캔버스 크기 맞추기
    useEffect(() => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = imageUrl;
        img.onload = () => {
            setImage(img);
            fitToContainer(img);
        };
    }, [imageUrl]);

    const fitToContainer = useCallback((img: HTMLImageElement) => {
        if (!containerRef.current) return;
        const { clientWidth, clientHeight } = containerRef.current;
        const s = Math.min(clientWidth / img.width, clientHeight / img.height);
        setScale(s);
        setOffset({
            x: (clientWidth - img.width * s) / 2,
            y: (clientHeight - img.height * s) / 2,
        });
    }, []);

    // 리사이즈 핸들링
    useEffect(() => {
        if (!image) return;
        const observer = new ResizeObserver(() => fitToContainer(image));
        if (containerRef.current) observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, [image, fitToContainer]);

    // 캔버스 그리기
    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx || !image) return;

        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
            ctx.scale(dpr, dpr);
        }

        ctx.clearRect(0, 0, rect.width, rect.height);
        ctx.save();
        ctx.translate(offset.x, offset.y);
        ctx.scale(scale, scale);

        // 이미지 그리기
        ctx.drawImage(image, 0, 0);

        // 오버레이 렌더링
        overlays.forEach(overlay => {
            // 배경 채우기
            ctx.fillStyle = overlay.backgroundColor;
            ctx.fillRect(overlay.rect.x, overlay.rect.y, overlay.rect.width, overlay.rect.height);

            // 선택된 오버레이 테두리
            if (overlay.id === selectedOverlayId) {
                ctx.strokeStyle = PRIMARY_COLOR;
                ctx.lineWidth = 2 / scale;
                ctx.strokeRect(overlay.rect.x, overlay.rect.y, overlay.rect.width, overlay.rect.height);
            }

            // 텍스트 렌더링
            ctx.fillStyle = overlay.fontColor;
            ctx.font = `${overlay.fontWeight} ${overlay.fontSize}px ${overlay.fontFamily}, sans-serif`;
            if ((ctx as unknown as { letterSpacing?: string }).letterSpacing !== undefined) {
                (ctx as unknown as { letterSpacing: string }).letterSpacing = `${overlay.letterSpacing || 0}px`;
            }

            const lines = overlay.newText.split('\n');
            const lineHeight = overlay.fontSize * 1.2;
            const totalTextHeight = lines.length * lineHeight;

            ctx.textAlign = (overlay.hAlign || 'left') as CanvasTextAlign;
            ctx.textBaseline = 'top';

            let tx = overlay.rect.x;
            if (overlay.hAlign === 'center') tx = overlay.rect.x + overlay.rect.width / 2;
            else if (overlay.hAlign === 'right') tx = overlay.rect.x + overlay.rect.width;

            let ty = overlay.rect.y;
            if (overlay.vAlign === 'middle') ty = overlay.rect.y + (overlay.rect.height - totalTextHeight) / 2;
            else if (overlay.vAlign === 'bottom') ty = overlay.rect.y + overlay.rect.height - totalTextHeight;

            lines.forEach((line, index) => {
                ctx.fillText(line, tx, ty + index * lineHeight);
            });

            if ((ctx as unknown as { letterSpacing?: string }).letterSpacing !== undefined) {
                (ctx as unknown as { letterSpacing: string }).letterSpacing = '0px';
            }
        });

        // 선택 영역 렌더링
        if (selection) {
            ctx.strokeStyle = PRIMARY_COLOR;
            ctx.lineWidth = 2 / scale;
            ctx.strokeRect(selection.x, selection.y, selection.width, selection.height);
            ctx.fillStyle = OVERLAY_COLOR;
            ctx.fillRect(selection.x, selection.y, selection.width, selection.height);

            // 핸들 그리기
            const handles: Point[] = [
                { x: selection.x, y: selection.y },
                { x: selection.x + selection.width / 2, y: selection.y },
                { x: selection.x + selection.width, y: selection.y },
                { x: selection.x + selection.width, y: selection.y + selection.height / 2 },
                { x: selection.x + selection.width, y: selection.y + selection.height },
                { x: selection.x + selection.width / 2, y: selection.y + selection.height },
                { x: selection.x, y: selection.y + selection.height },
                { x: selection.x, y: selection.y + selection.height / 2 },
            ];

            ctx.fillStyle = PRIMARY_COLOR;
            const hs = HANDLE_SIZE / scale;
            handles.forEach(h => {
                ctx.fillRect(h.x - hs / 2, h.y - hs / 2, hs, hs);
            });
        }

        ctx.restore();
    }, [image, overlays, selection, scale, offset, selectedOverlayId]);

    useEffect(() => {
        draw();
    }, [draw]);

    // 좌표 변환: 화면 → 이미지 좌표
    const getImageCoords = (e: React.MouseEvent): Point => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left - offset.x) / scale,
            y: (e.clientY - rect.top - offset.y) / scale,
        };
    };

    const isPointInRect = (p: Point, rect: OverlayRect) => {
        return p.x >= rect.x && p.x <= rect.x + rect.width && p.y >= rect.y && p.y <= rect.y + rect.height;
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        const p = getImageCoords(e);

        // 오버레이 클릭 체크 (역순으로 - 위에 있는 것 먼저)
        const clickedOverlay = [...overlays].reverse().find(o => isPointInRect(p, o.rect));
        if (clickedOverlay) {
            onOverlaySelect(clickedOverlay.id);
            setIsDraggingOverlay(true);
            setStartPoint(p);
            setSelection(null);
            onSelectionChange(null);
            return;
        }

        // 새 선택 영역 시작
        onOverlaySelect(null);
        setIsDrawing(true);
        setSelection({ x: p.x, y: p.y, width: 0, height: 0 });
        setStartPoint(p);
        onSelectionChange(null);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        const p = getImageCoords(e);

        // 커서 변경
        if (canvasRef.current) {
            if (isDraggingOverlay) {
                canvasRef.current.style.cursor = 'grabbing';
            } else if (overlays.some(o => isPointInRect(p, o.rect))) {
                canvasRef.current.style.cursor = 'pointer';
            } else if (isDrawing) {
                canvasRef.current.style.cursor = 'crosshair';
            } else {
                canvasRef.current.style.cursor = 'crosshair';
            }
        }

        if (isDrawing && startPoint) {
            const x = Math.min(p.x, startPoint.x);
            const y = Math.min(p.y, startPoint.y);
            const width = Math.abs(p.x - startPoint.x);
            const height = Math.abs(p.y - startPoint.y);
            setSelection({ x, y, width, height });
        } else if (isDraggingOverlay && selectedOverlayId && startPoint) {
            const dx = p.x - startPoint.x;
            const dy = p.y - startPoint.y;
            const newOverlays = overlays.map(ov =>
                ov.id === selectedOverlayId
                    ? { ...ov, rect: { ...ov.rect, x: ov.rect.x + dx, y: ov.rect.y + dy } }
                    : ov
            );
            onUpdateOverlays(newOverlays);
            setStartPoint(p);
        }
    };

    const handleMouseUp = () => {
        if (isDrawing) {
            if (selection && (selection.width < MIN_RECT_SIZE || selection.height < MIN_RECT_SIZE)) {
                setSelection(null);
                onSelectionChange(null);
            } else {
                onSelectionChange(selection);
            }
        }
        setIsDrawing(false);
        setIsDraggingOverlay(false);
        setStartPoint(null);
    };

    return (
        <div ref={containerRef} className="absolute inset-0 overflow-hidden select-none">
            <canvas
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onContextMenu={(e) => e.preventDefault()}
                className="block w-full h-full"
            />
        </div>
    );
}
