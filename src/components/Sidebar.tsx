"use client";

import React, { useState } from 'react';
import Image from 'next/image';
import { Shield, Unlock, Zap, Database, KeyRound, Cpu, Shuffle, QrCode, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type Props = {
  mode: 'encrypt' | 'decrypt';
  setMode: (mode: 'encrypt' | 'decrypt') => void;
  blockSize: 256 | 512 | 1024;
  setBlockSize: (size: 256 | 512 | 1024) => void;
  tweak: string;
  encryptionKey: string;
  setEncryptionKey: (key: string) => void;
  hasEncryptedBlocks: boolean;
  encryptedCount: number;
  imageLoaded: boolean;
  isProcessing: boolean;
  isFullyEncrypted: boolean;
  onEncryptAll: () => void;
  onDecryptAll: () => void;
  onOpenShareModal?: () => void;
  onClose?: () => void;
};

export default function Sidebar({ mode, setMode, blockSize, setBlockSize, tweak, encryptionKey, setEncryptionKey, hasEncryptedBlocks, encryptedCount, imageLoaded, isProcessing, isFullyEncrypted, onEncryptAll, onDecryptAll, onOpenShareModal, onClose }: Props) {
  const [keyCopied, setKeyCopied] = useState(false);

  const generateRandomKey = () => {
    // Key length in bytes: blockSize / 8 (e.g. 256 bits → 32 bytes)
    const keyBytes = blockSize / 8;
    const randomBytes = new Uint8Array(keyBytes);
    crypto.getRandomValues(randomBytes);
    // Convert to hex string
    const hexKey = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    setEncryptionKey(hexKey);
    
    // Copy to clipboard
    navigator.clipboard.writeText(hexKey).then(() => {
      setKeyCopied(true);
      setTimeout(() => setKeyCopied(false), 2000);
    });
  };

  return (
    <div className="w-80 flex flex-col h-full bg-[var(--bg-sidebar)] backdrop-blur-xl border-r border-[var(--border-primary)] p-6 gap-8 overflow-y-auto z-20 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-[var(--accent-emerald-bg)] rounded-lg">
            <Image src="/encryption.png" alt="CipherCanvas" width={28} height={28} priority />
          </div>
          <h1 className="text-xl font-bold tracking-wider text-[var(--text-primary)]">CipherCanvas</h1>
        </div>
        {/* Close button — mobile only */}
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] transition-all md:hidden active:scale-95"
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Operation Mode */}
      <div className="flex flex-col gap-3">
        <label className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">Operation Mode</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setMode('encrypt')}
            className={`flex items-center justify-center gap-2 py-3 rounded-lg font-medium text-sm transition-all duration-300 ${
              mode === 'encrypt' ? 'bg-[var(--accent-emerald-dim)] text-[var(--accent-emerald)] ring-1 ring-[var(--accent-emerald-ring)]' : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]'
            }`}
          >
            <Shield size={16} /> Encrypt
          </button>
          <button
            onClick={() => setMode('decrypt')}
            className={`flex items-center justify-center gap-2 py-3 rounded-lg font-medium text-sm transition-all duration-300 ${
              mode === 'decrypt' ? 'bg-[var(--accent-rose-dim)] text-[var(--accent-rose)] ring-1 ring-[var(--accent-rose-ring)]' : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]'
            }`}
          >
            <Unlock size={16} /> Decrypt
          </button>
        </div>

        {/* Encrypt All / Decrypt All — shown below mode switch when image is loaded */}
        {imageLoaded && (
          <div className="mt-1">
            {isProcessing ? (
              <button
                disabled
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all duration-300 ring-1 bg-[var(--bg-surface)] text-[var(--text-muted)] ring-[var(--ring-default)] cursor-not-allowed"
              >
                <div className="w-3 h-3 rounded-full border-2 border-[var(--spinner-track)] border-t-[var(--spinner-head)] animate-spin" />
                Processing...
              </button>
            ) : mode === 'encrypt' ? (
              <button
                onClick={onEncryptAll}
                disabled={isFullyEncrypted}
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all duration-300 ${
                  !isFullyEncrypted
                    ? 'bg-[var(--accent-emerald-soft)] text-[var(--accent-emerald)] ring-1 ring-[var(--accent-emerald-ring-soft)] hover:bg-[var(--accent-emerald-hover)] active:scale-[0.98]'
                    : 'bg-[var(--bg-surface)] text-[var(--text-muted)] ring-1 ring-[var(--ring-default)] cursor-not-allowed'
                }`}
              >
                <Zap size={14} /> {isFullyEncrypted ? "Fully Encrypted" : "Encrypt All"}
              </button>
            ) : (
              <button
                onClick={onDecryptAll}
                disabled={encryptedCount === 0}
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all duration-300 ${
                  encryptedCount > 0 
                    ? 'bg-[var(--accent-rose-dim)] text-[var(--accent-rose)] ring-1 ring-[var(--accent-rose-ring-soft)] hover:bg-[var(--accent-rose-hover)] active:scale-[0.98]' 
                    : 'bg-[var(--bg-surface)] text-[var(--text-muted)] ring-1 ring-[var(--ring-default)] cursor-not-allowed'
                }`}
              >
                <Unlock size={14} /> {encryptedCount === 0 ? "Fully Decrypted" : `Decrypt All (${encryptedCount} blocks)`}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Block Size */}
      <div className="flex flex-col gap-3">
        <label className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider flex items-center gap-2">
          <Database size={14} /> Block Size (Bits)
        </label>
        <div className="grid grid-cols-3 gap-2">
          {[256, 512, 1024].map((size) => (
            <button
              key={size}
              onClick={() => !hasEncryptedBlocks && setBlockSize(size as 256 | 512 | 1024)}
              disabled={hasEncryptedBlocks}
              className={`py-2 rounded-md font-mono text-xs transition-all duration-300 ${
                blockSize === size ? 'bg-[var(--accent-blue-dim)] text-[var(--accent-blue)] ring-1 ring-[var(--accent-blue-ring)]' : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]'
              } ${hasEncryptedBlocks ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              {size}
            </button>
          ))}
        </div>
        {hasEncryptedBlocks && (
          <p className="text-[10px] text-[var(--accent-amber-dim)] uppercase tracking-widest">
            ⚠ Decrypt all blocks or upload a new image to change block size
          </p>
        )}
      </div>

      {/* Secret Key */}
      <div className="flex flex-col gap-3">
        <label className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider flex items-center gap-2">
          <KeyRound size={14} /> Secret Key
        </label>
        {(() => {
          const isKeyLocked = mode === 'encrypt' && hasEncryptedBlocks;
          return (
            <>
              <input 
                type="text" 
                value={encryptionKey}
                onChange={(e) => !isKeyLocked && setEncryptionKey(e.target.value)}
                disabled={isKeyLocked}
                className={`bg-[var(--bg-input)] border border-[var(--border-primary)] rounded-lg px-4 py-3 text-sm text-[var(--text-primary)] focus:outline-none transition-all font-mono ${
                  isKeyLocked ? 'opacity-50 cursor-not-allowed' : 'focus:ring-1 focus:ring-[var(--accent-emerald-ring)]'
                }`}
                placeholder="Enter 16-128 char key..."
              />
              <button
                onClick={() => !isKeyLocked && generateRandomKey()}
                disabled={isKeyLocked}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium text-xs transition-all duration-300 ${
                  isKeyLocked
                    ? 'bg-[var(--bg-surface)] text-[var(--text-muted)] ring-1 ring-[var(--ring-default)] cursor-not-allowed'
                    : 'bg-gradient-to-r from-[var(--accent-emerald-soft)] to-[var(--accent-blue-soft)] text-[var(--accent-emerald)] ring-1 ring-[var(--accent-emerald-ring-soft)] hover:from-[var(--accent-emerald-hover)] hover:to-[var(--accent-blue-hover)] hover:ring-[var(--accent-emerald-ring)] active:scale-[0.98]'
                }`}
              >
                <Shuffle size={14} /> {keyCopied ? "Copied to Clipboard!" : "Generate Random Key"}
              </button>
              {isKeyLocked && (
                <p className="text-[10px] text-[var(--accent-amber-dim)] uppercase tracking-widest">
                  ⚠ Switch to decrypt mode or clear image to change secret key
                </p>
              )}
            </>
          );
        })()}
      </div>

      {/* Share with Device — always visible (Scan QR doesn't need an image loaded) */}
      <div className="flex flex-col gap-3">
        <label className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider flex items-center gap-2">
          <QrCode size={14} /> Share with Device
        </label>
        <button
          onClick={onOpenShareModal}
          disabled={isProcessing}
          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all duration-300 ${
            !isProcessing
              ? 'bg-gradient-to-r from-[var(--accent-blue-soft)] to-[var(--accent-emerald-soft)] text-[var(--accent-blue)] ring-1 ring-[var(--accent-blue-ring-soft)] hover:from-[var(--accent-blue-hover)] hover:to-[var(--accent-emerald-hover)] active:scale-[0.98]'
              : 'bg-[var(--bg-surface)] text-[var(--text-muted)] ring-1 ring-[var(--ring-default)] cursor-not-allowed'
          }`}
        >
          <QrCode size={14} /> {imageLoaded ? 'Generate QR / Scan QR' : 'Scan QR Code'}
        </button>
        <p className="text-[10px] text-[var(--text-muted)] text-center uppercase tracking-widest">
          {imageLoaded ? 'Transfer image to another device via QR code' : 'Scan a QR code to receive an image'}
        </p>
        </div>

      {/* Real-Time Tweak */}
      <div className="flex flex-col gap-3 mt-auto mb-4">
        <label className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider flex items-center gap-2">
          <Cpu size={14} /> Real-Time Tweak
        </label>
        <div className="relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-blue-500 rounded-lg blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
          <div className="relative bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg p-4 font-mono text-xs text-[var(--accent-emerald)] tracking-widest break-all">
            {tweak || "0000000000000000"}
          </div>
        </div>
        <p className="text-[10px] text-[var(--text-muted)] text-center uppercase tracking-widest mt-2">
          Tweak driven by coordinate hash
        </p>
      </div>
    </div>
  );
}
