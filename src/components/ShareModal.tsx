"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, QrCode, ScanLine, Copy, Check, Camera, SwitchCamera, Loader2, Wifi, WifiOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  imageLoaded: boolean;
  getShareableData: () => ArrayBuffer | null;
  loadShareableData: (data: ArrayBuffer) => void;
};

type ShareStatus = 'initializing' | 'ready' | 'connected' | 'sent' | 'error';
type ScanStatus = 'idle' | 'scanning' | 'connecting' | 'receiving' | 'done' | 'error';

export default function ShareModal({ isOpen, onClose, imageLoaded, getShareableData, loadShareableData }: Props) {
  const [activeTab, setActiveTab] = useState<'share' | 'scan'>('scan');

  // Reset to appropriate default tab when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab(imageLoaded ? 'share' : 'scan');
    }
  }, [isOpen, imageLoaded]);
  
  // Share state
  const [shareStatus, setShareStatus] = useState<ShareStatus>('initializing');
  const [peerUrl, setPeerUrl] = useState('');
  const [urlCopied, setUrlCopied] = useState(false);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const peerRef = useRef<any>(null);

  // Scan state
  const [scanStatus, setScanStatus] = useState<ScanStatus>('idle');
  const [scanError, setScanError] = useState('');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const videoRef = useRef<HTMLVideoElement>(null);
  const scanCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);
  const scanPeerRef = useRef<any>(null);

  // Cleanup everything on close
  const cleanup = useCallback(() => {
    // Cleanup peer
    try { peerRef.current?.destroy(); } catch (e) {}
    peerRef.current = null;
    
    // Cleanup scan peer
    try { scanPeerRef.current?.destroy(); } catch (e) {}
    scanPeerRef.current = null;
    
    // Cleanup camera
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    
    // Cancel animation frame
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    
    // Reset states
    setShareStatus('initializing');
    setPeerUrl('');
    setUrlCopied(false);
    setScanStatus('idle');
    setScanError('');
  }, []);

  // Initialize peer when Share tab is shown AND an image is loaded
  useEffect(() => {
    if (!isOpen || activeTab !== 'share' || !imageLoaded) return;
    
    let destroyed = false;
    setShareStatus('initializing');

    import('peerjs').then(({ default: Peer }) => {
      if (destroyed) return;
      
      const peer = new Peer();
      peerRef.current = peer;

      peer.on('open', (id: string) => {
        if (destroyed) return;
        const url = `${window.location.origin}${window.location.pathname}#peer=${id}`;
        setPeerUrl(url);
        setShareStatus('ready');

        // Generate QR code
        import('qrcode').then((QRCode) => {
          if (destroyed || !qrCanvasRef.current) return;
          QRCode.toCanvas(qrCanvasRef.current, url, {
            width: 280,
            margin: 2,
            color: { dark: '#000000', light: '#ffffff' },
            errorCorrectionLevel: 'M',
          });
        });
      });

      peer.on('connection', (conn: any) => {
        if (destroyed) return;
        setShareStatus('connected');
        
        conn.on('open', () => {
          if (destroyed) return;
          const data = getShareableData();
          if (data) {
            conn.send(data);
            setShareStatus('sent');
          } else {
            setShareStatus('error');
          }
        });

        conn.on('error', () => {
          if (!destroyed) setShareStatus('error');
        });
      });

      peer.on('error', (err: any) => {
        console.error('Peer error:', err);
        if (!destroyed) setShareStatus('error');
      });
    });

    return () => {
      destroyed = true;
      try { peerRef.current?.destroy(); } catch (e) {}
      peerRef.current = null;
    };
  }, [isOpen, activeTab, imageLoaded, getShareableData]);

  // Camera scanning
  const startScanning = useCallback(async () => {
    setScanStatus('scanning');
    setScanError('');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 640 }, height: { ideal: 480 } }
      });
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        scanFrames();
      }
    } catch (err: any) {
      setScanStatus('error');
      if (err.name === 'NotAllowedError') {
        setScanError('Camera access denied. Please allow camera permissions in your browser settings.');
      } else if (err.name === 'NotFoundError') {
        setScanError('No camera found. Please connect a camera and try again.');
      } else {
        setScanError(`Camera error: ${err.message}`);
      }
    }
  }, [facingMode]);

  const scanFrames = useCallback(() => {
    const video = videoRef.current;
    const canvas = scanCanvasRef.current;
    if (!video || !canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animFrameRef.current = requestAnimationFrame(scanFrames);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    import('jsqr').then(({ default: jsQR }) => {
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      
      if (code) {
        const match = code.data.match(/#peer=(.+)/);
        if (match) {
          stopCamera();
          connectToPeer(match[1]);
          return;
        }
      }
      
      animFrameRef.current = requestAnimationFrame(scanFrames);
    });
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
  }, []);

  const switchCamera = useCallback(() => {
    stopCamera();
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  }, [stopCamera]);

  // Restart scanning when facingMode changes
  useEffect(() => {
    if (isOpen && activeTab === 'scan' && scanStatus === 'scanning') {
      startScanning();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode]);

  const connectToPeer = useCallback((peerId: string) => {
    setScanStatus('connecting');
    
    import('peerjs').then(({ default: Peer }) => {
      const peer = new Peer();
      scanPeerRef.current = peer;

      peer.on('open', () => {
        const conn = peer.connect(peerId, { reliable: true, serialization: 'binary' });
        
        conn.on('open', () => {
          setScanStatus('receiving');
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
            setScanStatus('error');
            setScanError('Received unexpected data format.');
            return;
          }
          
          loadShareableData(buffer);
          setScanStatus('done');
          try { peer.destroy(); } catch (e) {}
          scanPeerRef.current = null;
        });

        conn.on('error', (err: any) => {
          console.error('Connection error:', err);
          setScanStatus('error');
          setScanError('Connection failed. The sender may have closed the share dialog.');
        });
      });

      peer.on('error', (err: any) => {
        console.error('Peer error:', err);
        setScanStatus('error');
        setScanError('Failed to connect. Please try again.');
      });
    });
  }, [loadShareableData]);

  const copyUrl = () => {
    navigator.clipboard.writeText(peerUrl).then(() => {
      setUrlCopied(true);
      setTimeout(() => setUrlCopied(false), 2000);
    });
  };

  const handleClose = () => {
    cleanup();
    onClose();
  };

  // Cleanup on tab switch
  useEffect(() => {
    if (activeTab === 'share') {
      stopCamera();
      setScanStatus('idle');
    } else {
      try { peerRef.current?.destroy(); } catch (e) {}
      peerRef.current = null;
      setShareStatus('initializing');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[90] flex items-center justify-center bg-[var(--bg-modal)] backdrop-blur-xl p-4"
        onClick={handleClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="w-full max-w-md bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-primary)]">
            <h2 className="text-lg font-bold text-[var(--text-primary)] tracking-wide">Share with Device</h2>
            <button
              onClick={handleClose}
              className="p-2 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] transition-all active:scale-95"
            >
              <X size={18} />
            </button>
          </div>

          {/* Tab bar */}
          <div className="flex border-b border-[var(--border-primary)] relative">
            {(['share', 'scan'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold uppercase tracking-wider transition-colors duration-200 ${
                  activeTab === tab
                    ? 'text-[var(--accent-emerald)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                {tab === 'share' ? <QrCode size={16} /> : <ScanLine size={16} />}
                {tab === 'share' ? 'Share QR' : 'Scan QR'}
              </button>
            ))}
            {/* Animated tab indicator */}
            <motion.div
              className="absolute bottom-0 h-0.5 bg-[var(--accent-emerald)]"
              animate={{ left: activeTab === 'share' ? '0%' : '50%' }}
              style={{ width: '50%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            />
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-5">
            <AnimatePresence mode="wait">
              {activeTab === 'share' ? (
                <motion.div
                  key="share"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col items-center gap-4"
                >
                  {!imageLoaded ? (
                    /* No image loaded — show a helpful message */
                    <div className="flex flex-col items-center gap-4 py-8">
                      <div className="w-16 h-16 rounded-2xl bg-[var(--bg-surface)] flex items-center justify-center">
                        <QrCode size={28} className="text-[var(--text-muted)]" />
                      </div>
                      <p className="text-sm text-[var(--text-secondary)] text-center font-medium">
                        No image loaded
                      </p>
                      <p className="text-xs text-[var(--text-muted)] text-center leading-relaxed">
                        Upload or drop an image first, then come back here to generate a QR code and share it with another device.
                      </p>
                    </div>
                  ) : (
                    /* Image loaded — show QR and peer status */
                    <>
                      {/* QR Code */}
                      <div className="bg-white p-3 rounded-xl shadow-lg">
                        <canvas
                          ref={qrCanvasRef}
                          className={`rounded-lg transition-opacity duration-300 ${shareStatus === 'ready' || shareStatus === 'connected' || shareStatus === 'sent' ? 'opacity-100' : 'opacity-30'}`}
                          width={280}
                          height={280}
                        />
                      </div>

                      {/* Status */}
                      <div className="flex items-center gap-2 text-sm">
                        {shareStatus === 'initializing' && (
                          <>
                            <Loader2 size={16} className="animate-spin text-[var(--text-muted)]" />
                            <span className="text-[var(--text-muted)]">Setting up connection...</span>
                          </>
                        )}
                        {shareStatus === 'ready' && (
                          <>
                            <motion.div
                              animate={{ scale: [1, 1.3, 1] }}
                              transition={{ repeat: Infinity, duration: 2 }}
                              className="w-2 h-2 rounded-full bg-[var(--accent-emerald)]"
                            />
                            <span className="text-[var(--text-secondary)]">Waiting for device to connect...</span>
                          </>
                        )}
                        {shareStatus === 'connected' && (
                          <>
                            <Wifi size={16} className="text-[var(--accent-blue)]" />
                            <span className="text-[var(--accent-blue)]">Connected! Sending data...</span>
                          </>
                        )}
                        {shareStatus === 'sent' && (
                          <>
                            <Check size={16} className="text-[var(--accent-emerald)]" />
                            <span className="text-[var(--accent-emerald)]">Transfer complete!</span>
                          </>
                        )}
                        {shareStatus === 'error' && (
                          <>
                            <WifiOff size={16} className="text-[var(--accent-rose)]" />
                            <span className="text-[var(--accent-rose)]">Connection failed. Reopen to retry.</span>
                          </>
                        )}
                      </div>

                      {/* Copyable URL */}
                      {peerUrl && (
                        <div className="w-full flex items-center gap-2 bg-[var(--bg-surface)] rounded-lg p-2.5 border border-[var(--border-primary)]">
                          <p className="flex-1 text-[10px] font-mono text-[var(--text-muted)] truncate select-all">{peerUrl}</p>
                          <button
                            onClick={copyUrl}
                            className="shrink-0 p-1.5 rounded-md hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] transition-all active:scale-95"
                          >
                            {urlCopied ? <Check size={14} className="text-[var(--accent-emerald)]" /> : <Copy size={14} />}
                          </button>
                        </div>
                      )}

                      <p className="text-[10px] text-[var(--text-muted)] text-center uppercase tracking-widest leading-relaxed">
                        Scan the QR code with any scanner app, or use the &quot;Scan QR&quot; tab on another device running this website. The secret key is NOT shared — the receiver must know it.
                      </p>
                    </>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="scan"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col items-center gap-4"
                >
                  {scanStatus === 'idle' && (
                    <div className="flex flex-col items-center gap-4 py-6">
                      <div className="w-16 h-16 rounded-2xl bg-[var(--bg-surface)] flex items-center justify-center">
                        <Camera size={28} className="text-[var(--text-muted)]" />
                      </div>
                      <p className="text-sm text-[var(--text-secondary)] text-center">
                        Scan a CipherCanvas QR code to receive an image from another device.
                      </p>
                      <button
                        onClick={startScanning}
                        className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold bg-[var(--accent-emerald-dim)] text-[var(--accent-emerald)] ring-1 ring-[var(--accent-emerald-ring-soft)] hover:bg-[var(--accent-emerald-hover)] transition-all active:scale-[0.97]"
                      >
                        <Camera size={16} /> Open Camera
                      </button>
                    </div>
                  )}

                  {scanStatus === 'scanning' && (
                    <div className="w-full flex flex-col items-center gap-3">
                      {/* Camera preview */}
                      <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-black">
                        <video
                          ref={videoRef}
                          playsInline
                          muted
                          className="w-full h-full object-cover"
                        />
                        {/* Scan line animation */}
                        <div className="absolute inset-4 border-2 border-[var(--accent-emerald)] rounded-lg opacity-40 pointer-events-none" />
                        <div className="absolute left-4 right-4 h-0.5 bg-[var(--accent-emerald)] opacity-80 scan-line-anim pointer-events-none" />
                        
                        {/* Hidden canvas for frame capture */}
                        <canvas ref={scanCanvasRef} className="hidden" />
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={switchCamera}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-[var(--bg-surface)] text-[var(--text-secondary)] ring-1 ring-[var(--ring-default)] hover:bg-[var(--bg-surface-hover)] transition-all active:scale-95"
                        >
                          <SwitchCamera size={14} /> Switch Camera
                        </button>
                        <button
                          onClick={() => { stopCamera(); setScanStatus('idle'); }}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-[var(--accent-rose-dim)] text-[var(--accent-rose)] ring-1 ring-[var(--accent-rose-ring-soft)] hover:bg-[var(--accent-rose-hover)] transition-all active:scale-95"
                        >
                          <X size={14} /> Stop
                        </button>
                      </div>

                      <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest text-center">
                        Point camera at a CipherCanvas QR code
                      </p>
                    </div>
                  )}

                  {(scanStatus === 'connecting' || scanStatus === 'receiving') && (
                    <div className="flex flex-col items-center gap-4 py-8">
                      <div className="w-10 h-10 rounded-full border-3 border-[var(--spinner-track)] border-t-[var(--accent-blue)] animate-spin" />
                      <p className="text-sm text-[var(--text-secondary)]">
                        {scanStatus === 'connecting' ? 'Connecting to sender...' : 'Receiving image data...'}
                      </p>
                    </div>
                  )}

                  {scanStatus === 'done' && (
                    <div className="flex flex-col items-center gap-4 py-8">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', damping: 15 }}
                        className="w-12 h-12 rounded-full bg-[var(--accent-emerald-dim)] flex items-center justify-center"
                      >
                        <Check size={24} className="text-[var(--accent-emerald)]" />
                      </motion.div>
                      <p className="text-sm font-semibold text-[var(--accent-emerald)]">Image received successfully!</p>
                      <p className="text-xs text-[var(--text-muted)] text-center">
                        Enter the secret key to decrypt the image.
                      </p>
                      <button
                        onClick={handleClose}
                        className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-[var(--accent-emerald-dim)] text-[var(--accent-emerald)] ring-1 ring-[var(--accent-emerald-ring-soft)] hover:bg-[var(--accent-emerald-hover)] transition-all active:scale-[0.97]"
                      >
                        Close
                      </button>
                    </div>
                  )}

                  {scanStatus === 'error' && (
                    <div className="flex flex-col items-center gap-4 py-8">
                      <div className="w-12 h-12 rounded-full bg-[var(--accent-rose-dim)] flex items-center justify-center">
                        <WifiOff size={24} className="text-[var(--accent-rose)]" />
                      </div>
                      <p className="text-sm text-[var(--accent-rose)] text-center">{scanError || 'Something went wrong.'}</p>
                      <button
                        onClick={() => { setScanStatus('idle'); setScanError(''); }}
                        className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-[var(--bg-surface)] text-[var(--text-primary)] ring-1 ring-[var(--ring-default)] hover:bg-[var(--bg-surface-hover)] transition-all active:scale-[0.97]"
                      >
                        Try Again
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
