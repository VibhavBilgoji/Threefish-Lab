"use client";

import React, { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import type { ThreefishWorkerRequest, ThreefishWorkerResponse } from '../lib/threefish.worker';

type Props = {
  mode: 'encrypt' | 'decrypt';
  blockSize: 256 | 512 | 1024;
  setBlockSize: (size: 256 | 512 | 1024) => void;
  onTweakUpdate: (tweak: string) => void;
  encryptionKey: string;
  onEncryptedCountChange?: (count: number) => void;
  onModeSwitch?: (mode: 'encrypt' | 'decrypt') => void;
  onImageLoadedChange?: (loaded: boolean) => void;
  onProcessingChange?: (processing: boolean) => void;
  onFullyEncryptedChange?: (fullyEncrypted: boolean) => void;
};

export type CanvasWorkspaceHandle = {
  encryptAll: () => void;
  decryptAll: () => void;
};

const CanvasWorkspace = forwardRef<CanvasWorkspaceHandle, Props>(function CanvasWorkspace({ mode, blockSize, setBlockSize, onTweakUpdate, encryptionKey, onEncryptedCountChange, onModeSwitch, onImageLoadedChange, onProcessingChange, onFullyEncryptedChange }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const workerRef = useRef<Worker | null>(null);
  
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [localEncryptedCount, setLocalEncryptedCount] = useState(0);
  const [showHighlight, setShowHighlight] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isFullyEncrypted, setIsFullyEncrypted] = useState(false);
  const isFullyEncryptedRef = useRef(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const isProcessingRef = useRef(false);

  const updateProcessingState = (processing: boolean) => {
    if (isProcessingRef.current !== processing) {
      isProcessingRef.current = processing;
      setIsProcessing(processing);
      onProcessingChange?.(processing);
    }
  };

  const updateImageLoaded = (loaded: boolean) => {
    setImageLoaded(loaded);
    onImageLoadedChange?.(loaded);
  };

  const updateFullyEncrypted = (fullyEncrypted: boolean) => {
    if (isFullyEncryptedRef.current !== fullyEncrypted) {
      isFullyEncryptedRef.current = fullyEncrypted;
      setIsFullyEncrypted(fullyEncrypted);
      onFullyEncryptedChange?.(fullyEncrypted);
    }
  };

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

  const blockSizeRef = useRef(blockSize);
  blockSizeRef.current = blockSize;

  const updateEncryptedCount = () => {
    const count = encryptedBlocks.current.size;
    setLocalEncryptedCount(count);
    onEncryptedCountChangeRef.current?.(count);

    if (canvasRef.current) {
      const pPerBlock = getPixelsPerBlock();
      const w = canvasRef.current.width;
      const h = canvasRef.current.height;
      if (w > 0 && h > 0) {
        const totalBlocks = Math.ceil(w / pPerBlock) * h;
        updateFullyEncrypted(count === totalBlocks && totalBlocks > 0);
      }
    }
  };

  // Keep stable refs to encryptAll / decryptAll for the imperative handle
  const encryptAllRef = useRef<() => void>(() => {});
  const decryptAllRef = useRef<() => void>(() => {});

  useImperativeHandle(ref, () => ({
    encryptAll: () => encryptAllRef.current(),
    decryptAll: () => decryptAllRef.current(),
  }));

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
        if (pendingRequests.current.size === 0) {
          updateProcessingState(false);
        }
        return;
      }

      const reqInfo = pendingRequests.current.get(id);
      if (reqInfo && canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          if (reqInfo.reqMode === 'encrypt') {
            encryptedBlockData.current.set(reqInfo.blockKey, new Uint8Array(result));
            // Always ensure block is tracked (may have been removed by premature decrypt attempt)
            encryptedBlocks.current.add(reqInfo.blockKey);
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
        if (pendingRequests.current.size === 0) {
          updateProcessingState(false);
        }
      }
    };

    return () => {
      workerRef.current?.terminate();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Worker persists across mode changes — mode is sent per-request



  // --- Load image from a File object ---
  // .ciphercanvas: binary format with display pixels + separate raw cipher bytes
  // Regular images: drawn normally via <img> element
  const loadImageFile = (file: File) => {
    file.arrayBuffer().then(buf => {
      const view = new DataView(buf);
      const magic = view.getUint32(0, true);

      if (magic === 0x43434e56) {
        // ---- .ciphercanvas format ----
        // Header (20 bytes): magic(4) + blockSize(4) + pPerBlock(4) + width(4) + height(4)
        // Section 1: display pixels, all alpha=255 (width*height*4 bytes)
        // Section 2: numBlocks (4 bytes)
        // Section 3: for each block: bx(4) + by(4) + cipherBytes(pPerBlock*4)
        const fileBlockSize = view.getUint32(4, true) as 256 | 512 | 1024;
        const filePPerBlock = view.getUint32(8, true);
        const w = view.getUint32(12, true);
        const h = view.getUint32(16, true);
        const displayPixels = new Uint8ClampedArray(buf, 20, w * h * 4);

        if (!canvasRef.current || !bgCanvasRef.current) return;
        canvasRef.current.width = w;
        canvasRef.current.height = h;
        bgCanvasRef.current.width = w;
        bgCanvasRef.current.height = h;

        // Write display pixels directly — alpha=255 everywhere, no premultiplication issue
        const displayImg = new ImageData(displayPixels, w, h);
        canvasRef.current.getContext('2d')?.putImageData(displayImg, 0, 0);
        bgCanvasRef.current.getContext('2d')?.putImageData(displayImg, 0, 0);

        // Restore cipher block map from file
        encryptedBlocks.current.clear();
        encryptedBlockData.current.clear();

        const bytesPerCipherBlock = filePPerBlock * 4;
        let offset = 20 + w * h * 4;
        const numBlocks = view.getUint32(offset, true);
        offset += 4;
        for (let i = 0; i < numBlocks; i++) {
          const bx = view.getUint32(offset, true);
          const by = view.getUint32(offset + 4, true);
          const cipherBytes = new Uint8Array(buf, offset + 8, bytesPerCipherBlock);
          const blockKey = `${bx},${by}`;
          encryptedBlocks.current.add(blockKey);
          encryptedBlockData.current.set(blockKey, new Uint8Array(cipherBytes));
          offset += 8 + bytesPerCipherBlock;
        }

        updateEncryptedCount();
        clearHighlight();
        updateImageLoaded(true);

        // Auto-switch to decrypt mode when loading a .ciphercanvas file
        onModeSwitch?.('decrypt');

        if (fileBlockSize !== blockSize) {
          setBlockSize(fileBlockSize);
          alert(`Notice: Block size automatically set to ${fileBlockSize}-bit to match the loaded encrypted image.`);
        }
      } else {
        // ---- Regular image ----
        if (!file.type.startsWith('image/')) return;
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
          if (canvasRef.current && bgCanvasRef.current) {
            canvasRef.current.width = img.width;
            canvasRef.current.height = img.height;
            bgCanvasRef.current.width = img.width;
            bgCanvasRef.current.height = img.height;
            canvasRef.current.getContext('2d')?.drawImage(img, 0, 0);
            bgCanvasRef.current.getContext('2d')?.drawImage(img, 0, 0);
            encryptedBlocks.current.clear();
            encryptedBlockData.current.clear();
            updateEncryptedCount();
            clearHighlight();
            updateImageLoaded(true);
            onModeSwitch?.('encrypt');
          }
          URL.revokeObjectURL(url);
        };
        img.src = url;
      }
    });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadImageFile(file);
  };

  // --- Drag and drop handlers ---
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) loadImageFile(file);
  };

  function getPixelsPerBlock() {
    // 256 bits = 32 bytes = 8 pixels
    // 512 bits = 64 bytes = 16 pixels
    // 1024 bits = 128 bytes = 32 pixels
    return (blockSizeRef.current / 8) / 4; 
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

    // In encrypt mode, skip blocks that are already encrypted (prevents double-encryption)
    if (mode === 'encrypt' && encryptedBlocks.current.has(blockKey)) return;

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
          // Data not available yet — encryption may still be in-flight. Skip for now.
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
      updateProcessingState(true);

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

    // Skip orphan blocks (in encryptedBlocks but not yet in encryptedBlockData — still in-flight)
    // They'll be decryptable once their encryption response arrives
    updateEncryptedCount();

    if (encryptedBlockData.current.size === 0) return;

    updateProcessingState(true);

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

  // --- Encrypt every block in the image (required before sharing via download) ---
  const encryptAll = () => {
    if (!canvasRef.current || !workerRef.current) return;
    const pPerBlock = getPixelsPerBlock();
    const w = canvasRef.current.width;
    const h = canvasRef.current.height;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    updateProcessingState(true);
    let scheduled = 0;

    // Use Math.ceil so partial edge blocks are included
    const blocksPerRow = Math.ceil(w / pPerBlock);
    for (let y = 0; y < h; y++) {
      for (let bx = 0; bx < blocksPerRow; bx++) {
        const blockKey = `${bx},${y}`;
        if (encryptedBlocks.current.has(blockKey)) continue; // already encrypted

        const x = bx * pPerBlock;
        const actualWidth = Math.min(pPerBlock, w - x);

        // Read available pixels, then pad to full block size if on the edge
        const imgData = ctx.getImageData(x, y, actualWidth, 1);
        let blockData: Uint8ClampedArray;
        if (actualWidth < pPerBlock) {
          // Pad partial edge block with zeros to fill a full cipher block
          blockData = new Uint8ClampedArray(pPerBlock * 4);
          blockData.set(imgData.data);
        } else {
          blockData = imgData.data;
        }
        encryptedBlocks.current.add(blockKey);

        const tweakStr = `TWK${bx.toString().padStart(5, '0')}${y.toString().padStart(5, '0')}000`;
        const reqId = `encall-${bx}-${y}-${Math.random()}`;
        pendingRequests.current.set(reqId, { x, y, w: pPerBlock, h: 1, blockKey, reqMode: 'encrypt' });
        workerRef.current.postMessage({
          id: reqId, mode: 'encrypt', blockData, blockSize, tweak: tweakStr, key: encryptionKey,
        } as ThreefishWorkerRequest);
        scheduled++;
      }
    }

    if (scheduled === 0) {
      updateProcessingState(false);
    }
    updateEncryptedCount();
  };

  // Keep refs in sync so the imperative handle always calls the latest closure
  encryptAllRef.current = encryptAll;
  decryptAllRef.current = decryptAll;

  // --- Download as .ciphercanvas binary ---
  // Format:
  //   Header (20B): magic(4) + blockSize(4) + pPerBlock(4) + width(4) + height(4)
  //   Section 1: display pixels with alpha=255 (width*height*4 bytes)
  //   Section 2: numBlocks (4 bytes)
  //   Section 3: per-block: bx(4) + by(4) + raw cipher bytes (pPerBlock*4 bytes)
  const downloadImage = () => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    const w = canvasRef.current.width;
    const h = canvasRef.current.height;
    const pPerBlock = getPixelsPerBlock();
    const bytesPerCipherBlock = pPerBlock * 4;

    // Section 1: get display pixels (already alpha=255 in canvas from our putImageData with forced alpha)
    const displayPixels = new Uint8Array(ctx.getImageData(0, 0, w, h).data.buffer);

    // Collect cipher blocks
    const blocks = Array.from(encryptedBlockData.current.entries());
    const numBlocks = blocks.length;

    // Build binary buffer
    const headerSize = 20;
    const section1Size = w * h * 4;
    const section2Size = 4;
    const section3Size = numBlocks * (8 + bytesPerCipherBlock);
    const totalSize = headerSize + section1Size + section2Size + section3Size;

    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);

    // Header
    view.setUint32(0, 0x43434e56, true);  // magic "CCNV"
    view.setUint32(4, blockSize, true);
    view.setUint32(8, pPerBlock, true);
    view.setUint32(12, w, true);
    view.setUint32(16, h, true);

    // Section 1: display pixels
    bytes.set(displayPixels, headerSize);

    // Section 2: block count
    view.setUint32(headerSize + section1Size, numBlocks, true);

    // Section 3: cipher blocks (exact raw bytes, never touched by canvas)
    let offset = headerSize + section1Size + section2Size;
    for (const [blockKey, cipherBytes] of blocks) {
      const [bx, by] = blockKey.split(',').map(Number);
      view.setUint32(offset, bx, true);
      view.setUint32(offset + 4, by, true);
      bytes.set(cipherBytes, offset + 8);
      offset += 8 + bytesPerCipherBlock;
    }

    const blob = new Blob([buffer], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `ciphercanvas_${Date.now()}.ciphercanvas`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  // --- Download as standard PNG when fully decrypted ---
  const downloadNormalImage = () => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = `decrypted_image_${Date.now()}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
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
    <div
      className="flex flex-col items-center justify-center w-full h-full p-4 relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag-over overlay */}
      {isDraggingOver && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-emerald-500/10 backdrop-blur-sm border-2 border-dashed border-emerald-400/50 rounded-2xl pointer-events-none">
          <span className="text-emerald-400 font-semibold text-lg tracking-widest uppercase">Drop image or .ciphercanvas file</span>
        </div>
      )}

      {!imageLoaded && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <label className="cursor-pointer pointer-events-auto group">
            <div className="flex flex-col items-center gap-4 p-8 rounded-2xl bg-white/5 border border-dashed border-white/20 backdrop-blur-md transition-all group-hover:bg-white/10 group-hover:scale-105">
              <span className="text-white/60 font-medium tracking-widest text-sm">UPLOAD OR DROP IMAGE TO INITIALIZE</span>
              <span className="text-white/30 text-xs">Click to browse or drag & drop</span>
              <input type="file" accept="image/*,.ciphercanvas" onChange={handleImageUpload} className="hidden" />
            </div>
          </label>
        </div>
      )}
      
      {/* Image container with noticeable glow */}
      <div className={`relative rounded-xl overflow-hidden transition-all duration-500 ${
        imageLoaded
          ? 'ring-1 ring-white/15 shadow-[0_0_30px_rgba(16,185,129,0.2),0_0_60px_rgba(16,185,129,0.1),0_0_100px_rgba(59,130,246,0.12)]'
          : 'opacity-0'
      }`}>
        <canvas ref={bgCanvasRef} className="hidden" />
        <canvas
          ref={canvasRef}
          className="cursor-crosshair max-w-full max-h-[80vh] object-contain"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerOut={handlePointerUp}
        />
        {/* Highlight overlay canvas */}
        <canvas
          ref={overlayCanvasRef}
          className="absolute top-0 left-0 w-full h-full pointer-events-none"
        />

      </div>

      {/* Toolbar */}
      {imageLoaded && (
        <div className="flex flex-col items-center gap-2 mt-4">
          <div className="flex items-center flex-wrap justify-center gap-2">
            {isProcessing ? (
              <button
                disabled
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all duration-300 ring-1 bg-white/5 text-white/50 ring-white/10 cursor-not-allowed"
              >
                <div className="w-3 h-3 rounded-full border-2 border-white/20 border-t-white/80 animate-spin" />
                Processing...
              </button>
            ) : (
              <>
                {/* Download */}
                {localEncryptedCount > 0 ? (
                  <button
                    onClick={downloadImage}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all duration-300 bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/30 hover:bg-blue-500/25 active:scale-[0.97]"
                  >
                    ⬇ Download .ciphercanvas
                  </button>
                ) : (
                  <button
                    onClick={downloadNormalImage}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all duration-300 bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/30 hover:bg-blue-500/25 active:scale-[0.97]"
                  >
                    ⬇ Download PNG
                  </button>
                )}

                {localEncryptedCount > 0 && (
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
                )}
              </>
            )}
          </div>

          {/* Contextual hint */}
          <p className="text-[10px] text-white/25 tracking-widest uppercase text-center">
            {isFullyEncrypted
              ? 'Fully encrypted — safe to download and share'
              : localEncryptedCount > 0
                ? 'Partially encrypted — use Encrypt All before sharing'
                : 'Upload an encrypted image → enter key → Full Image Decrypt'}
          </p>
        </div>
      )}
    </div>
  );
});

export default CanvasWorkspace;
