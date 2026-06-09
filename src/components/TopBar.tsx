"use client";

import React, { useState, useEffect } from 'react';
import { Sun, Moon, Menu } from 'lucide-react';
import { useTheme } from './ThemeProvider';
import { motion, AnimatePresence } from 'framer-motion';

type Props = {
  onToggleSidebar: () => void;
};

export default function TopBar({ onToggleSidebar }: Props) {
  const [time, setTime] = useState<string>('');
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const update = () => {
      setTime(
        new Date().toLocaleTimeString('en-US', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-3 py-3 md:px-5 md:py-4 pointer-events-none">
      {/* Hamburger — mobile only */}
      <button
        className="pointer-events-auto p-2.5 rounded-xl bg-[var(--bg-surface)] backdrop-blur-xl border border-[var(--border-primary)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-all duration-200 md:hidden active:scale-95"
        onClick={onToggleSidebar}
        aria-label="Toggle sidebar"
      >
        <Menu size={20} />
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Clock + Theme toggle pill */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="pointer-events-auto flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-[var(--bg-surface)] backdrop-blur-xl border border-[var(--border-primary)] shadow-lg"
      >
        {/* IST Clock */}
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-xs text-[var(--text-secondary)] tabular-nums tracking-wide">
            {time || '12:00:00 AM'}
          </span>
          <span className="text-[9px] font-semibold text-[var(--text-muted)] tracking-wider">
            IST
          </span>
        </div>

        {/* Divider */}
        <div className="w-px h-4 bg-[var(--border-primary)]" />

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="relative w-7 h-7 flex items-center justify-center rounded-full hover:bg-[var(--bg-surface-hover)] transition-all duration-200 active:scale-90"
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          <AnimatePresence mode="wait" initial={false}>
            {theme === 'dark' ? (
              <motion.div
                key="sun"
                initial={{ scale: 0, rotate: -90, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                exit={{ scale: 0, rotate: 90, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute"
              >
                <Sun size={16} className="text-amber-400" />
              </motion.div>
            ) : (
              <motion.div
                key="moon"
                initial={{ scale: 0, rotate: 90, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                exit={{ scale: 0, rotate: -90, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute"
              >
                <Moon size={16} className="text-indigo-500" />
              </motion.div>
            )}
          </AnimatePresence>
        </button>
      </motion.div>
    </div>
  );
}
