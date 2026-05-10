"use client";

import React, { useState, useRef } from 'react';
import Sidebar from '@/components/Sidebar';
import CanvasWorkspace from '@/components/CanvasWorkspace';
import type { CanvasWorkspaceHandle } from '@/components/CanvasWorkspace';
import { motion } from 'framer-motion';

export default function Home() {
  const [mode, setMode] = useState<'encrypt' | 'decrypt'>('encrypt');
  const [blockSize, setBlockSize] = useState<256 | 512 | 1024>(256);
  const [tweak, setTweak] = useState<string>('');
  const [encryptionKey, setEncryptionKey] = useState<string>('CIPHERCANVAS2026');
  const [encryptedCount, setEncryptedCount] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isFullyEncrypted, setIsFullyEncrypted] = useState(false);

  const canvasRef = useRef<CanvasWorkspaceHandle>(null);

  return (
    <main className="flex h-screen w-full bg-slate-950 text-white overflow-hidden relative font-sans selection:bg-emerald-500/30">
      {/* Background Cyber Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />
      
      {/* Sidebar */}
      <motion.div 
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="z-10"
      >
        <Sidebar 
          mode={mode}
          setMode={setMode}
          blockSize={blockSize}
          setBlockSize={setBlockSize}
          tweak={tweak}
          encryptionKey={encryptionKey}
          setEncryptionKey={setEncryptionKey}
          hasEncryptedBlocks={encryptedCount > 0}
          encryptedCount={encryptedCount}
          imageLoaded={imageLoaded}
          isProcessing={isProcessing}
          isFullyEncrypted={isFullyEncrypted}
          onEncryptAll={() => canvasRef.current?.encryptAll()}
          onDecryptAll={() => canvasRef.current?.decryptAll()}
        />
      </motion.div>

      {/* Main Canvas Area */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
        className="flex-1 relative z-0"
      >
        <CanvasWorkspace 
          ref={canvasRef}
          mode={mode}
          blockSize={blockSize}
          setBlockSize={setBlockSize}
          onTweakUpdate={setTweak}
          encryptionKey={encryptionKey}
          onEncryptedCountChange={setEncryptedCount}
          onModeSwitch={setMode}
          onImageLoadedChange={setImageLoaded}
          onProcessingChange={setIsProcessing}
          onFullyEncryptedChange={setIsFullyEncrypted}
        />
      </motion.div>
    </main>
  );
}
