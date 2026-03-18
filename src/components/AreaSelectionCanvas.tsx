"use client";

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { OverlayRect } from '@/types/slide';

interface AreaSelectionCanvasProps {
    imageUrl: string;
    selection: OverlayRect | null;
    onSelectionChange: (rect: OverlayRect | null) => void;
}

interface Point {
    x: number;
    y: number;
}

const MIN_RECT_SIZE = 10;
const SELECTION_COLOR = '#EF4444';
const SELECTION_FILL = 'rgba(239, 68, 68, 0.08)';

export default function AreaSelectionCanvas({
    imageUrl,
    selection,
    onSelectionChange,
}: AreaSelectionCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const [image, setImage] = useState<HTMLImageElement | null>(null);
    const [scale, setScale] = useState(1);
    const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });

    const [isDrawing, setIsDrawing] = useState(false);
    const [startPoint, setStartPoint] = useState<Point | null>(null);
    const [localSelection, setLocalSelection] = useState<OverlayRect | null>(null);

    // 외부 selection 동기화
    useEffect(() => {
        setLocalSelection(selection);
    }, [selection]);

    // 이미지 로드
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
        if (rect.width === 0 || rect.height === 0) return;

        const dpr = window.devicePixelRatio || 1;
        const w = Math.round(rect.width * dpr);
        const h = Math.round(rect.height * dpr);

        if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
        }

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, rect.width, rect.height);

        ctx.save();
        ctx.translate(offset.x, offset.y);
        ctx.scale(scale, scale);

        // 이미지 그리기
        ctx.drawImage(image, 0, 0);

        // 선택 영역 렌더링
        if (localSelection) {
            ctx.strokeStyle = SELECTION_COLOR;
            ctx.lineWidth = 2 / scale;
            ctx.setLineDash([8 / scale, 4 / scale]);
            ctx.strokeRect(localSelection.x, localSelection.y, localSelection.width, localSelection.height);
            ctx.setLineDash([]);

            ctx.fillStyle = SELECTION_FILL;
            ctx.fillRect(localSelection.x, localSelection.y, localSelection.width, localSelection.height);

            // 모서리 핸들
            const hs = 6 / scale;
            ctx.fillStyle = SELECTION_COLOR;
            const corners: Point[] = [
                { x: localSelection.x, y: localSelection.y },
                { x: localSelection.x + localSelection.width, y: localSelection.y },
                { x: localSelection.x + localSelection.width, y: localSelection.y + localSelection.height },
                { x: localSelection.x, y: localSelection.y + localSelection.height },
            ];
            corners.forEach(c => {
                ctx.fillRect(c.x - hs / 2, c.y - hs / 2, hs, hs);
            });
        }

        ctx.restore();
    }, [image, localSelection, scale, offset]);

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

    const handleMouseDown = (e: React.MouseEvent) => {
        const p = getImageCoords(e);
        setIsDrawing(true);
        setLocalSelection({ x: p.x, y: p.y, width: 0, height: 0 });
        setStartPoint(p);
        onSelectionChange(null);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (canvasRef.current) {
            canvasRef.current.style.cursor = isDrawing ? 'crosshair' : 'crosshair';
        }

        if (isDrawing && startPoint) {
            const p = getImageCoords(e);
            const x = Math.min(p.x, startPoint.x);
            const y = Math.min(p.y, startPoint.y);
            const width = Math.abs(p.x - startPoint.x);
            const height = Math.abs(p.y - startPoint.y);
            setLocalSelection({ x, y, width, height });
        }
    };

    const handleMouseUp = () => {
        if (isDrawing) {
            if (localSelection && (localSelection.width < MIN_RECT_SIZE || localSelection.height < MIN_RECT_SIZE)) {
                // 너무 작으면 선택 해제 (클릭)
                setLocalSelection(null);
                onSelectionChange(null);
            } else {
                onSelectionChange(localSelection);
            }
        }
        setIsDrawing(false);
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
                style={{ cursor: 'crosshair' }}
            />
        </div>
    );
}
