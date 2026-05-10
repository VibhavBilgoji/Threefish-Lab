"use client";

import React from 'react';
import Image from 'next/image';
import { Shield, Unlock, Zap, Database, KeyRound, Cpu, Shuffle } from 'lucide-react';
import { motion } from 'framer-motion';

type Props = {
  mode: 'encrypt' | 'decrypt';
  setMode: (mode: 'encrypt' | 'decrypt') => void;
  blockSize: 256 | 512 | 1024;
  setBlockSize: (size: 256 | 512 | 1024) => void;
  tweak: string;
  encryptionKey: string;
  setEncryptionKey: (key: string) => void;
  hasEncryptedBlocks: boolean;
};

export default function Sidebar({ mode, setMode, blockSize, setBlockSize, tweak, encryptionKey, setEncryptionKey, hasEncryptedBlocks }: Props) {
  const generateRandomKey = () => {
    // Key length in bytes: blockSize / 8 (e.g. 256 bits → 32 bytes)
    const keyBytes = blockSize / 8;
    const randomBytes = new Uint8Array(keyBytes);
    crypto.getRandomValues(randomBytes);
    // Convert to hex string
    const hexKey = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    setEncryptionKey(hexKey);
  };

  return (
    <div className="w-80 flex flex-col h-full bg-black/40 backdrop-blur-xl border-l border-white/10 p-6 gap-8 overflow-y-auto z-20 shadow-2xl">
      <div className="flex items-center gap-3">
        <div className="p-1.5 bg-emerald-500/10 rounded-lg">
          <Image src="/encryption.png" alt="CipherCanvas" width={28} height={28} priority />
        </div>
        <h1 className="text-xl font-bold tracking-wider text-white">CipherCanvas</h1>
      </div>

      <div className="flex flex-col gap-3">
        <label className="text-xs font-semibold text-white/40 uppercase tracking-wider">Operation Mode</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setMode('encrypt')}
            className={`flex items-center justify-center gap-2 py-3 rounded-lg font-medium text-sm transition-all duration-300 ${
              mode === 'encrypt' ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/50' : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            <Shield size={16} /> Encrypt
          </button>
          <button
            onClick={() => setMode('decrypt')}
            className={`flex items-center justify-center gap-2 py-3 rounded-lg font-medium text-sm transition-all duration-300 ${
              mode === 'decrypt' ? 'bg-rose-500/20 text-rose-400 ring-1 ring-rose-500/50' : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            <Unlock size={16} /> Decrypt
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <label className="text-xs font-semibold text-white/40 uppercase tracking-wider flex items-center gap-2">
          <Database size={14} /> Block Size (Bits)
        </label>
        <div className="grid grid-cols-3 gap-2">
          {[256, 512, 1024].map((size) => (
            <button
              key={size}
              onClick={() => !hasEncryptedBlocks && setBlockSize(size as 256 | 512 | 1024)}
              disabled={hasEncryptedBlocks}
              className={`py-2 rounded-md font-mono text-xs transition-all duration-300 ${
                blockSize === size ? 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/50' : 'bg-white/5 text-white/50 hover:bg-white/10'
              } ${hasEncryptedBlocks ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              {size}
            </button>
          ))}
        </div>
        {hasEncryptedBlocks && (
          <p className="text-[10px] text-amber-400/70 uppercase tracking-widest">
            ⚠ Decrypt all blocks or upload a new image to change block size
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <label className="text-xs font-semibold text-white/40 uppercase tracking-wider flex items-center gap-2">
          <KeyRound size={14} /> Secret Key
        </label>
        <input 
          type="text" 
          value={encryptionKey}
          onChange={(e) => setEncryptionKey(e.target.value)}
          className="bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-all font-mono"
          placeholder="Enter 16-128 char key..."
        />
        <button
          onClick={generateRandomKey}
          className="flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium text-xs transition-all duration-300 bg-gradient-to-r from-emerald-500/15 to-blue-500/15 text-emerald-400 ring-1 ring-emerald-500/30 hover:from-emerald-500/25 hover:to-blue-500/25 hover:ring-emerald-500/50 active:scale-[0.98]"
        >
          <Shuffle size={14} /> Generate Random Key
        </button>
      </div>

      <div className="flex flex-col gap-3 mt-auto mb-4">
        <label className="text-xs font-semibold text-white/40 uppercase tracking-wider flex items-center gap-2">
          <Cpu size={14} /> Real-Time Tweak
        </label>
        <div className="relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-blue-500 rounded-lg blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
          <div className="relative bg-black border border-white/10 rounded-lg p-4 font-mono text-xs text-emerald-400 tracking-widest break-all">
            {tweak || "0000000000000000"}
          </div>
        </div>
        <p className="text-[10px] text-white/30 text-center uppercase tracking-widest mt-2">
          Tweak driven by coordinate hash
        </p>
      </div>
    </div>
  );
}
