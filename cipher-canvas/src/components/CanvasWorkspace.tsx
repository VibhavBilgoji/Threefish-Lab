"use client";

import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { ThreefishWorkerRequest, ThreefishWorkerResponse } from '../lib/threefish.worker';

type Props = {
  mode: 'encrypt' | 'decrypt';
  blockSize: 256 | 512 | 1024;
  onTweakUpdate: (tweak: string) => void;
  encryptionKey: string;
  onEncryptedCountChange?: (count: number) => void;
};

export default function CanvasWorkspace({ mode, blockSize, onTweakUpdate, encryptionKey, onEncryptedCountChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const workerRef = useRef<Worker | null>(null);
  
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [localEncryptedCount, setLocalEncryptedCount] = useState(0);
  const [showHighlight, setShowHighlight] = useState(false);

  // Pending worker requests
  const pendingRequests = useRef<Map<string, { x: number, y: number, w: number, h: number, blockKey: string, reqMode: 'encrypt' | 'decrypt' }>>(new Map());

  // Store raw encrypted bytes per block so decryption doesn't depend on lossy canvas reads
  const encryptedBlockData = useRef<Map<string, Uint8Array>>(new Map());

  // Track which blocks have been encrypted so decryption only touches encrypted blocks
  const encryptedBlocks = useRef<Set<string>>(new Set());

  // Track blocks already being processed in this drag to avoid redundant work
  const processedInDrag = useRef<Set<string>>(new Set());

  // Track last pointer position for interpolation between events
  const lastPointerPos = useRef<{ x: number, y: number } | null>(null);

  // Refs to avoid stale closures in the long-lived worker onmessage handler
  const showHighlightRef = useRef(showHighlight);
  showHighlightRef.current = showHighlight;
  const onEncryptedCountChangeRef = useRef(onEncryptedCountChange);
  onEncryptedCountChangeRef.current = onEncryptedCountChange;

  const updateEncryptedCount = () => {
    const count = encryptedBlocks.current.size;
    setLocalEncryptedCount(count);
    onEncryptedCountChangeRef.current?.(count);
  };

  // Setup worker — created ONCE for the component lifetime (mode is per-request, not per-worker)
  useEffect(() => {
    workerRef.current = new Worker(new URL('../lib/threefish.worker.ts', import.meta.url));
    workerRef.current.onmessage = (e: MessageEvent<ThreefishWorkerResponse>) => {
      const { id, result, error } = e.data;
      if (error) {
        console.error("Worker error:", error);
        const failedReq = pendingRequests.current.get(id);
        if (failedReq) {
          encryptedBlocks.current.delete(failedReq.blockKey);
          encryptedBlockData.current.delete(failedReq.blockKey);
          updateEncryptedCount();
        }
        pendingRequests.current.delete(id);
        return;
      }

      const reqInfo = pendingRequests.current.get(id);
      if (reqInfo && canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          if (reqInfo.reqMode === 'encrypt') {
            encryptedBlockData.current.set(reqInfo.blockKey, new Uint8Array(result));
          } else {
            encryptedBlockData.current.delete(reqInfo.blockKey);
            encryptedBlocks.current.delete(reqInfo.blockKey);
          }
          updateEncryptedCount();

          // Force alpha=255 for canvas display (avoids premultiplication corruption)
          const displayBuf = new Uint8ClampedArray(result.length);
          displayBuf.set(result);
          for (let i = 3; i < displayBuf.length; i += 4) displayBuf[i] = 255;

          const imgData = new ImageData(displayBuf, reqInfo.w, reqInfo.h);
          ctx.putImageData(imgData, reqInfo.x, reqInfo.y);

          // Update highlight overlay if visible
          if (showHighlightRef.current) drawHighlight();
        }
        pendingRequests.current.delete(id);
      }
    };

    return () => {
      workerRef.current?.terminate();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Worker persists across mode changes — mode is sent per-request



  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      if (canvasRef.current && bgCanvasRef.current) {
        const w = img.width;
        const h = img.height;
        
        canvasRef.current.width = w;
        canvasRef.current.height = h;
        bgCanvasRef.current.width = w;
        bgCanvasRef.current.height = h;

        const ctx = canvasRef.current.getContext('2d');
        const bgCtx = bgCanvasRef.current.getContext('2d');
        
        ctx?.drawImage(img, 0, 0);
        bgCtx?.drawImage(img, 0, 0);
        
        // Reset tracking when a new image is loaded
        encryptedBlocks.current.clear();
        encryptedBlockData.current.clear();
        updateEncryptedCount();
        clearHighlight();
        
        setImageLoaded(true);
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const getPixelsPerBlock = () => {
    // 256 bits = 32 bytes = 8 pixels
    // 512 bits = 64 bytes = 16 pixels
    // 1024 bits = 128 bytes = 32 pixels
    return (blockSize / 8) / 4; 
  };

  const processBlock = (px: number, py: number) => {
    if (!canvasRef.current || !workerRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const pPerBlock = getPixelsPerBlock();
    // Snap to block-aligned coordinates
    const blockX = Math.floor(px / pPerBlock);
    const blockY = py;

    // Bounds check
    if (blockX < 0 || blockY < 0) return;
    const startX = blockX * pPerBlock;
    const startY = blockY;
    if (startX >= canvasRef.current.width || startY >= canvasRef.current.height) return;

    const blockKey = `${blockX},${blockY}`;

    // Skip if already processed in this drag stroke
    if (processedInDrag.current.has(blockKey)) return;

    // In decrypt mode, skip blocks that were never encrypted
    if (mode === 'decrypt' && !encryptedBlocks.current.has(blockKey)) return;

    processedInDrag.current.add(blockKey);

    // Tweak calculation: Hash or map coordinates
    // We use exactly 16 chars for the tweak
    const tweakStr = `TWK${blockX.toString().padStart(5, '0')}${blockY.toString().padStart(5, '0')}000`;
    onTweakUpdate(tweakStr);

    const reqId = `${blockX}-${blockY}-${Date.now()}`;
    
    // To prevent processing the same block twice unnecessarily while dragging
    if (pendingRequests.current.has(reqId)) return;

    try {
      let blockData: Uint8ClampedArray;

      if (mode === 'decrypt') {
        // Use stored raw cipher bytes (not canvas data which suffers alpha premultiplication)
        const stored = encryptedBlockData.current.get(blockKey);
        if (!stored) {
          // Orphan block: tracked as encrypted but no data — clean up
          encryptedBlocks.current.delete(blockKey);
          updateEncryptedCount();
          return;
        }
        blockData = new Uint8ClampedArray(stored);
      } else {
        // Encrypt: read pixel data from canvas
        const imgData = ctx.getImageData(startX, startY, pPerBlock, 1);
        blockData = imgData.data;
        encryptedBlocks.current.add(blockKey);
      }

      pendingRequests.current.set(reqId, { x: startX, y: startY, w: pPerBlock, h: 1, blockKey, reqMode: mode });

      workerRef.current.postMessage({
        id: reqId,
        mode,
        blockData,
        blockSize,
        tweak: tweakStr,
        key: encryptionKey
      } as ThreefishWorkerRequest);
    } catch (e) {
      // Out of bounds or tainted canvas
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!imageLoaded) return;
    setIsDrawing(true);
    processedInDrag.current.clear();
    lastPointerPos.current = null;
    handlePointerEvent(e);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDrawing) return;
    handlePointerEvent(e);
  };

  const handlePointerUp = () => {
    setIsDrawing(false);
    processedInDrag.current.clear();
    lastPointerPos.current = null;
  };

  const applyBrush = (cx: number, cy: number) => {
    const pPerBlock = getPixelsPerBlock();
    const brushRadiusX = 6;
    const brushRadiusY = pPerBlock * 6;
    for (let dy = -brushRadiusY; dy <= brushRadiusY; dy++) {
      for (let dx = -brushRadiusX; dx <= brushRadiusX; dx++) {
        processBlock(Math.floor(cx) + dx * pPerBlock, Math.floor(cy) + dy);
      }
    }
  };

  const handlePointerEvent = (e: React.PointerEvent) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // Interpolate between last pointer position and current to avoid gaps
    if (lastPointerPos.current) {
      const lx = lastPointerPos.current.x;
      const ly = lastPointerPos.current.y;
      const dist = Math.sqrt((x - lx) ** 2 + (y - ly) ** 2);
      const step = Math.max(1, getPixelsPerBlock());
      const steps = Math.max(1, Math.ceil(dist / step));
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        applyBrush(lx + (x - lx) * t, ly + (y - ly) * t);
      }
    } else {
      applyBrush(x, y);
    }
    lastPointerPos.current = { x, y };
  };

  // --- Decrypt All remaining blocks at once ---
  const decryptAll = () => {
    if (!workerRef.current) return;

    // First, clean up orphan blocks that are in encryptedBlocks but have no stored data
    for (const blockKey of encryptedBlocks.current) {
      if (!encryptedBlockData.current.has(blockKey)) {
        encryptedBlocks.current.delete(blockKey);
      }
    }
    updateEncryptedCount();

    // Now decrypt all blocks that have stored data
    for (const [blockKey, data] of encryptedBlockData.current.entries()) {
      const [bx, by] = blockKey.split(',').map(Number);
      const pPerBlock = getPixelsPerBlock();
      const startX = bx * pPerBlock;
      const startY = by;
      const tweakStr = `TWK${bx.toString().padStart(5, '0')}${by.toString().padStart(5, '0')}000`;
      const reqId = `decall-${bx}-${by}-${Date.now()}`;

      pendingRequests.current.set(reqId, { x: startX, y: startY, w: pPerBlock, h: 1, blockKey, reqMode: 'decrypt' });
      workerRef.current.postMessage({
        id: reqId,
        mode: 'decrypt',
        blockData: new Uint8ClampedArray(data),
        blockSize,
        tweak: tweakStr,
        key: encryptionKey
      } as ThreefishWorkerRequest);
    }
  };

  // --- Highlight overlay for remaining encrypted blocks ---
  const drawHighlight = () => {
    if (!overlayCanvasRef.current || !canvasRef.current) return;
    const overlay = overlayCanvasRef.current;
    overlay.width = canvasRef.current.width;
    overlay.height = canvasRef.current.height;
    const ctx = overlay.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    ctx.fillStyle = 'rgba(255, 60, 60, 0.45)';
    const pPerBlock = getPixelsPerBlock();
    for (const blockKey of encryptedBlocks.current) {
      const [bx, by] = blockKey.split(',').map(Number);
      ctx.fillRect(bx * pPerBlock, by, pPerBlock, 1);
    }
  };

  const clearHighlight = () => {
    if (!overlayCanvasRef.current) return;
    const ctx = overlayCanvasRef.current.getContext('2d');
    ctx?.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
  };

  const toggleHighlight = () => {
    if (showHighlight) {
      clearHighlight();
      setShowHighlight(false);
    } else {
      drawHighlight();
      setShowHighlight(true);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center w-full h-full p-4 relative">
      {!imageLoaded && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <label className="cursor-pointer pointer-events-auto group">
            <div className="flex flex-col items-center gap-4 p-8 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md transition-all group-hover:bg-white/10 group-hover:scale-105">
              <span className="text-white/60 font-medium tracking-widest text-sm">UPLOAD IMAGE TO INITIALIZE</span>
              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </div>
          </label>
        </div>
      )}
      
      <div className={`relative rounded-xl overflow-hidden shadow-2xl shadow-black/50 transition-all ${imageLoaded ? 'ring-1 ring-white/10' : 'opacity-0'}`}>
        <canvas ref={bgCanvasRef} className="hidden" />
        <canvas
          ref={canvasRef}
          className="cursor-crosshair max-w-full max-h-[80vh] object-contain"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerOut={handlePointerUp}
        />
        {/* Highlight overlay canvas — sits on top of main canvas, pointer-events-none */}
        <canvas
          ref={overlayCanvasRef}
          className="absolute top-0 left-0 w-full h-full pointer-events-none"
        />
      </div>

      {/* Floating toolbar — appears when there are encrypted blocks */}
      {imageLoaded && localEncryptedCount > 0 && (
        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={decryptAll}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all duration-300 bg-rose-500/20 text-rose-400 ring-1 ring-rose-500/40 hover:bg-rose-500/30 active:scale-[0.97]"
          >
            🔓 Decrypt All ({localEncryptedCount} blocks)
          </button>
          <button
            onClick={toggleHighlight}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all duration-300 ring-1 active:scale-[0.97] ${
              showHighlight
                ? 'bg-amber-500/20 text-amber-400 ring-amber-500/40'
                : 'bg-white/5 text-white/50 ring-white/10 hover:bg-white/10'
            }`}
          >
            {showHighlight ? '🔴 Hide Highlights' : '🔍 Show Encrypted'}
          </button>
        </div>
      )}
    </div>
  );
}
