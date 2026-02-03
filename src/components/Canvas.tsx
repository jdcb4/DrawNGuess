import React, { useRef, useEffect, useState } from 'react';
import type { TouchEvent, MouseEvent } from 'react';
import './Canvas.css';

interface CanvasProps {
    onDrawingComplete: (dataUrl: string) => void;
    readonly?: boolean;
    initialDrawing?: string;
}

type Tool = 'brush' | 'eraser';

const COLORS = ['#000000', '#FF6B9D', '#4ECDC4', '#FFE66D', '#FF0055', '#FFFFFF'];

export const Canvas: React.FC<CanvasProps> = ({ onDrawingComplete, readonly = false, initialDrawing }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [tool, setTool] = useState<Tool>('brush');
    const [color, setColor] = useState('#000000');
    const lastPosRef = useRef<{ x: number; y: number } | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set canvas size
        const container = canvas.parentElement;
        if (container) {
            canvas.width = container.clientWidth;
            canvas.height = container.clientWidth * 0.75; // 4:3 aspect ratio
        }

        // Fill with white background
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Load initial drawing if provided
        if (initialDrawing) {
            const img = new Image();
            img.onload = () => {
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            };
            img.src = initialDrawing;
        }
    }, [initialDrawing]);

    const getCoordinates = (e: TouchEvent | MouseEvent, canvas: HTMLCanvasElement) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        if ('touches' in e) {
            return {
                x: (e.touches[0].clientX - rect.left) * scaleX,
                y: (e.touches[0].clientY - rect.top) * scaleY
            };
        } else {
            return {
                x: (e.clientX - rect.left) * scaleX,
                y: (e.clientY - rect.top) * scaleY
            };
        }
    };

    const startDrawing = (e: TouchEvent<HTMLCanvasElement> | MouseEvent<HTMLCanvasElement>) => {
        if (readonly) return;
        e.preventDefault();

        const canvas = canvasRef.current;
        if (!canvas) return;

        const pos = getCoordinates(e, canvas);
        lastPosRef.current = pos;
        setIsDrawing(true);
    };

    const draw = (e: TouchEvent<HTMLCanvasElement> | MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawing || readonly) return;
        e.preventDefault();

        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx || !lastPosRef.current) return;

        const pos = getCoordinates(e, canvas);

        ctx.lineWidth = tool === 'brush' ? 3 : 20;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = tool === 'brush' ? color : '#FFFFFF';

        ctx.beginPath();
        ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();

        lastPosRef.current = pos;
    };

    const stopDrawing = () => {
        setIsDrawing(false);
        lastPosRef.current = null;

        // Export drawing after user finishes a stroke
        if (canvasRef.current && !readonly) {
            const dataUrl = canvasRef.current.toDataURL('image/png');
            onDrawingComplete(dataUrl);
        }
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const dataUrl = canvas.toDataURL('image/png');
        onDrawingComplete(dataUrl);
    };

    if (readonly) {
        return (
            <div className="canvas-container readonly">
                <canvas ref={canvasRef} />
            </div>
        );
    }

    return (
        <div className="canvas-container">
            <div className="canvas-tools">
                <div className="tool-section">
                    <button
                        className={`tool-btn ${tool === 'brush' ? 'active' : ''}`}
                        onClick={() => setTool('brush')}
                    >
                        ✏️ Brush
                    </button>
                    <button
                        className={`tool-btn ${tool === 'eraser' ? 'active' : ''}`}
                        onClick={() => setTool('eraser')}
                    >
                        🧹 Eraser
                    </button>
                    <button className="tool-btn clear-btn" onClick={clearCanvas}>
                        🗑️ Clear
                    </button>
                </div>

                {tool === 'brush' && (
                    <div className="color-picker">
                        {COLORS.map(c => (
                            <button
                                key={c}
                                className={`color-btn ${color === c ? 'active' : ''}`}
                                style={{ backgroundColor: c }}
                                onClick={() => setColor(c)}
                            />
                        ))}
                    </div>
                )}
            </div>

            <canvas
                ref={canvasRef}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                onTouchCancel={stopDrawing}
            />
        </div>
    );
};
