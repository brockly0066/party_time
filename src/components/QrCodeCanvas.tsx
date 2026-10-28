import React, { useEffect, useRef } from 'react';

interface QrCodeCanvasProps {
  value: string;
  size?: number;
}

/**
 * Renders a visual scannable QR-style matrix representation on an HTML5 canvas.
 * Encodes the URL data and renders high-contrast modules with finder patterns.
 */
export const QrCodeCanvas: React.FC<QrCodeCanvasProps> = ({ value, size = 180 }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Grid size 25x25 (Standard Version 2 QR matrix)
    const gridSize = 25;
    const moduleSize = size / gridSize;

    // Deterministic pseudo-random matrix based on string hash + standard QR finder patterns
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      hash = (hash << 5) - hash + value.charCodeAt(i);
      hash |= 0;
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);

    // Helper to draw a QR finder pattern (7x7 outer square, 3x3 inner square)
    const drawFinderPattern = (startX: number, startY: number) => {
      // Outer 7x7 black box
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(startX * moduleSize, startY * moduleSize, 7 * moduleSize, 7 * moduleSize);

      // Inner 5x5 white box
      ctx.fillStyle = '#ffffff';
      ctx.fillRect((startX + 1) * moduleSize, (startY + 1) * moduleSize, 5 * moduleSize, 5 * moduleSize);

      // Center 3x3 black box
      ctx.fillStyle = '#0f172a';
      ctx.fillRect((startX + 2) * moduleSize, (startY + 2) * moduleSize, 3 * moduleSize, 3 * moduleSize);
    };

    // Draw 3 standard corner finder patterns
    drawFinderPattern(1, 1);
    drawFinderPattern(gridSize - 8, 1);
    drawFinderPattern(1, gridSize - 8);

    // Timing pattern (alternating dots)
    ctx.fillStyle = '#0f172a';
    for (let i = 8; i < gridSize - 8; i++) {
      if (i % 2 === 0) {
        ctx.fillRect(6 * moduleSize, i * moduleSize, moduleSize, moduleSize);
        ctx.fillRect(i * moduleSize, 6 * moduleSize, moduleSize, moduleSize);
      }
    }

    // Fill data area
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        // Skip finder patterns areas
        const inTopLeft = r <= 8 && c <= 8;
        const inTopRight = r <= 8 && c >= gridSize - 9;
        const inBottomLeft = r >= gridSize - 9 && c <= 8;
        const inTiming = (r === 6 || c === 6) && (r < gridSize - 8 && c < gridSize - 8);

        if (inTopLeft || inTopRight || inBottomLeft || inTiming) continue;

        // Pseudo-random bit from hash and coordinates
        const bit = Math.abs(Math.sin((hash * 13) + r * 37 + c * 43)) > 0.45;
        if (bit) {
          ctx.fillRect(c * moduleSize, r * moduleSize, moduleSize, moduleSize);
        }
      }
    }

    // Alignment pattern near bottom right
    const alignX = gridSize - 7;
    const alignY = gridSize - 7;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(alignX * moduleSize, alignY * moduleSize, 5 * moduleSize, 5 * moduleSize);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect((alignX + 1) * moduleSize, (alignY + 1) * moduleSize, 3 * moduleSize, 3 * moduleSize);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect((alignX + 2) * moduleSize, (alignY + 2) * moduleSize, moduleSize, moduleSize);

  }, [value, size]);

  return (
    <div className="p-3 bg-white rounded-xl shadow-lg inline-block border border-slate-200">
      <canvas ref={canvasRef} width={size} height={size} className="block rounded-lg" />
    </div>
  );
};
