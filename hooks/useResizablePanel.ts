'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface UseResizablePanelOptions {
    initialWidth: number;
    minWidth: number;
    maxWidth: number;
}

/**
 * 드래그로 패널 너비를 조정하는 훅.
 *
 * 마우스 이벤트를 window에 등록해 화면 밖 mouseup도 정상 처리.
 * pointer-events:none으로 드래그 중 iframe/자식 요소 방해 방지.
 * requestAnimationFrame으로 60fps setState 방지.
 */
export function useResizablePanel({ initialWidth, minWidth, maxWidth }: UseResizablePanelOptions) {
    const [width, setWidth] = useState(initialWidth);
    const isDraggingRef = useRef(false);
    const startXRef = useRef(0);
    const startWidthRef = useRef(initialWidth);
    const rafRef = useRef<number | undefined>(undefined);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        isDraggingRef.current = true;
        startXRef.current = e.clientX;
        startWidthRef.current = width;
        document.body.style.userSelect = 'none';
        document.body.style.pointerEvents = 'none';
        document.body.style.cursor = 'col-resize';
    }, [width]);

    useEffect(() => {
        const onMouseMove = (e: MouseEvent) => {
            if (!isDraggingRef.current) return;
            // 핸들이 우측 패널 왼쪽에 있으므로 왼쪽으로 드래그 = 패널 넓어짐
            const delta = startXRef.current - e.clientX;
            cancelAnimationFrame(rafRef.current!);
            rafRef.current = requestAnimationFrame(() => {
                const next = Math.max(minWidth, Math.min(maxWidth, startWidthRef.current + delta));
                setWidth(next);
            });
        };

        const onMouseUp = () => {
            if (!isDraggingRef.current) return;
            isDraggingRef.current = false;
            cancelAnimationFrame(rafRef.current!);
            document.body.style.userSelect = '';
            document.body.style.pointerEvents = '';
            document.body.style.cursor = '';
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);

        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            cancelAnimationFrame(rafRef.current!);
            // 언마운트 시 body 스타일 초기화 (드래그 중 언마운트 방어)
            document.body.style.userSelect = '';
            document.body.style.pointerEvents = '';
            document.body.style.cursor = '';
        };
    }, [minWidth, maxWidth]);

    return { width, handleMouseDown };
}
