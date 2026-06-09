"use client";

import React, { useState, useRef, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import CanvasWorkspace from '@/components/CanvasWorkspace';
import TopBar from '@/components/TopBar';
import ShareModal from '@/components/ShareModal';
import type { CanvasWorkspaceHandle } from '@/components/CanvasWorkspace';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, WifiOff, Loader2 } from 'lucide-react';

type PeerStatus = 'idle' | 'connecting' | 'receiving' | 'done' | 'error';

export default function Home() {
  const [mode, setMode] = useState<'encrypt' | 'decrypt'>('encrypt');
  const [blockSize, setBlockSize] = useState<256 | 512 | 1024>(256);
  const [tweak, setTweak] = useState<string>('');
  const [encryptionKey, setEncryptionKey] = useState<string>('CIPHERCANVAS2026');
  const [encryptedCount, setEncryptedCount] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isFullyEncrypted, setIsFullyEncrypted] = useState(false);

  // Mobile sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Share modal state
  const [shareModalOpen, setShareModalOpen] = useState(false);

  // Peer receiving state (when opened via QR link)
  const [peerStatus, setPeerStatus] = useState<PeerStatus>('idle');

  const canvasRef = useRef<CanvasWorkspaceHandle>(null);

  // --- Handle #peer= URL hash on mount (receiver flow) ---
  useEffect(() => {
    const hash = window.location.hash;
    const match = hash.match(/#peer=(.+)/);
    if (!match) return;

    const peerId = match[1];
    setPeerStatus('connecting');

    // Clear hash from URL immediately
    window.history.replaceState(null, '', window.location.pathname + window.location.search);

    import('peerjs').then(({ default: Peer }) => {
      const peer = new Peer();

      peer.on('open', () => {
        const conn = peer.connect(peerId, { reliable: true, serialization: 'binary' });

        conn.on('open', () => {
          setPeerStatus('receiving');
        });

        conn.on('data', (data: unknown) => {
          let buffer: ArrayBuffer;
          if (data instanceof ArrayBuffer) {
            buffer = data;
          } else if (data instanceof Uint8Array) {
            buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
          } else if (ArrayBuffer.isView(data)) {
            const view = data as Uint8Array;
            buffer = view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength) as ArrayBuffer;
          } else {
            console.error('Unexpected data type from peer:', typeof data);
            setPeerStatus('error');
            return;
          }

          canvasRef.current?.loadShareableData(buffer);
          setPeerStatus('done');
          try { peer.destroy(); } catch (e) {}
          setTimeout(() => setPeerStatus('idle'), 2500);
        });

        conn.on('error', (err: any) => {
          console.error('Connection error:', err);
          setPeerStatus('error');
          setTimeout(() => setPeerStatus('idle'), 4000);
        });
      });

      peer.on('error', (err: any) => {
        console.error('Peer error:', err);
        setPeerStatus('error');
        setTimeout(() => setPeerStatus('idle'), 4000);
      });
    });
  }, []);

  return (
    <main className="flex h-screen w-full bg-[var(--bg-app)] text-[var(--text-primary)] overflow-hidden relative font-sans">
      {/* Background Cyber Grid */}
      <div className="absolute inset-0 cyber-grid pointer-events-none" />

      {/* TopBar — always visible */}
      <TopBar onToggleSidebar={() => setSidebarOpen(prev => !prev)} />

      {/* Mobile backdrop */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar — desktop: static, mobile: slide-in drawer */}
      <div
        className={`
          fixed inset-y-0 left-0 z-40
          md:relative md:z-10
          transform transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
        `}
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
          onOpenShareModal={() => { setShareModalOpen(true); setSidebarOpen(false); }}
          onClose={() => setSidebarOpen(false)}
        />
      </div>

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

      {/* Share Modal */}
      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        imageLoaded={imageLoaded}
        getShareableData={() => canvasRef.current?.getShareableData() ?? null}
        loadShareableData={(data) => canvasRef.current?.loadShareableData(data)}
      />

      {/* Peer receiving overlay — shown when opened via QR link */}
      <AnimatePresence>
        {peerStatus !== 'idle' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--bg-modal)] backdrop-blur-xl"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="flex flex-col items-center gap-4 p-8 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-primary)] shadow-2xl"
            >
              {peerStatus === 'connecting' && (
                <>
                  <Loader2 size={32} className="animate-spin text-[var(--accent-emerald)]" />
                  <p className="text-[var(--text-secondary)] font-medium">Connecting to sender...</p>
                </>
              )}
              {peerStatus === 'receiving' && (
                <>
                  <Loader2 size={32} className="animate-spin text-[var(--accent-blue)]" />
                  <p className="text-[var(--text-secondary)] font-medium">Receiving image data...</p>
                </>
              )}
              {peerStatus === 'done' && (
                <>
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', damping: 15 }}
                    className="w-14 h-14 rounded-full bg-[var(--accent-emerald-dim)] flex items-center justify-center"
                  >
                    <Check size={28} className="text-[var(--accent-emerald)]" />
                  </motion.div>
                  <p className="text-[var(--accent-emerald)] font-semibold">Image received!</p>
                  <p className="text-xs text-[var(--text-muted)]">Enter the secret key to decrypt.</p>
                </>
              )}
              {peerStatus === 'error' && (
                <>
                  <div className="w-14 h-14 rounded-full bg-[var(--accent-rose-dim)] flex items-center justify-center">
                    <WifiOff size={28} className="text-[var(--accent-rose)]" />
                  </div>
                  <p className="text-[var(--accent-rose)] font-medium">Connection failed</p>
                  <p className="text-xs text-[var(--text-muted)]">The sender may have closed the share dialog.</p>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
