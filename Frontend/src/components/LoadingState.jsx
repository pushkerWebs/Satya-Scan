import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from '../context/LanguageContext';

const STEP_KEYS = ['extract', 'sources', 'evidence', 'ai', 'score'];

function ShieldLogo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <defs>
        <linearGradient id="slgLoading" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#14B8A6" />
          <stop offset="100%" stopColor="#5eead4" />
        </linearGradient>
      </defs>
      <path d="M50 6 L88 22 L88 54 C88 72 70 88 50 95 C30 88 12 72 12 54 L12 22 Z"
        fill="url(#slgLoading)" opacity="0.15" stroke="url(#slgLoading)" strokeWidth="2.5" />
      <text x="50" y="66" textAnchor="middle" fontSize="44" fontWeight="800"
        fontFamily="Inter,Arial,sans-serif" fill="url(#slgLoading)">S</text>
    </svg>
  );
}

export default function LoadingState({ currentStep = 0 }) {
  const { t } = useTranslation();
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [barWidths, setBarWidths] = useState({});

  const QUOTES = t('loading.quotes');

  // Rotate quote every 5s
  useEffect(() => {
    const quotesArr = Array.isArray(QUOTES) ? QUOTES : [];
    if (quotesArr.length === 0) return;
    const interval = setInterval(() => setQuoteIndex((i) => (i + 1) % quotesArr.length), 5000);
    return () => clearInterval(interval);
  }, [QUOTES]);

  // Animate bar widths
  useEffect(() => {
    const widths = {};
    STEP_KEYS.forEach((_, i) => {
      if (i < currentStep) widths[i] = 100;
      else if (i === currentStep) widths[i] = 60 + Math.random() * 30;
      else widths[i] = 0;
    });
    setBarWidths(widths);
  }, [currentStep]);

  const isComplete = currentStep >= STEP_KEYS.length;
  const quotesArr = Array.isArray(QUOTES) ? QUOTES : [];

  return (
    <div className="min-h-screen bg-[#0B0B0B] text-white flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-[#2A2A2A]">
        <div className="flex items-center gap-2.5">
          <ShieldLogo size={24} />
          <span className="font-bold text-base">
            <span className="text-[#14B8A6]">Satya</span>Scan
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm text-[#D1D5DB]">
          <span className="text-[#14B8A6] font-medium border-b border-[#14B8A6] pb-0.5">
            {t('nav.dashboard')}
          </span>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        {/* Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-lg bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-8"
        >
          {/* Header */}
          <div className="text-center mb-8">
            <motion.h2
              className="text-3xl font-extrabold mb-2"
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              {isComplete ? t('loading.complete') : t('loading.title')}
            </motion.h2>
            <p className="text-[#D1D5DB] text-sm">
              {t('loading.subtitle')}
            </p>
          </div>

          {/* Step list */}
          <div className="space-y-5">
            {STEP_KEYS.map((key, i) => {
              const done = i < currentStep;
              const active = i === currentStep && !isComplete;
              const pending = i > currentStep;

              return (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-3">
                      {/* Status icon */}
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border transition-all duration-500
                        ${done
                          ? 'bg-[#14B8A6]/20 border-[#14B8A6]'
                          : active
                          ? 'bg-[#14B8A6]/10 border-[#14B8A6]/60'
                          : 'bg-[#1A1A1A] border-[#2A2A2A]'}`}>
                        {done ? (
                          <span className="text-[#14B8A6] text-xs font-bold">✓</span>
                        ) : active ? (
                          <motion.span
                            className="w-2 h-2 rounded-full bg-[#14B8A6]"
                            animate={{ scale: [1, 1.4, 1] }}
                            transition={{ duration: 1, repeat: Infinity }}
                          />
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#2A2A2A]" />
                        )}
                      </div>

                      <span className={`text-xs font-bold uppercase tracking-widest
                        ${done ? 'text-[#14B8A6]' : active ? 'text-white' : 'text-[#D1D5DB]/30'}`}>
                        {t(`loading.steps.${key}`)}
                      </span>
                    </div>

                    <span className={`text-xs font-semibold uppercase tracking-wider
                      ${done ? 'text-[#14B8A6]' : active ? 'text-[#5eead4]' : 'text-[#D1D5DB]/30'}`}>
                      {done ? t('loading.status.complete') : active ? t('loading.status.running') : t('loading.status.pending')}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="ml-9">
                    <div className="h-0.5 bg-[#2A2A2A] rounded-full overflow-hidden">
                      <motion.div
                        className="h-0.5 rounded-full"
                        style={{
                          background: done
                            ? 'linear-gradient(90deg, #14B8A6, #5eead4)'
                            : 'linear-gradient(90deg, #14B8A6, #0d9488)',
                        }}
                        initial={{ width: '0%' }}
                        animate={{ width: done ? '100%' : active ? `${barWidths[i] || 60}%` : '0%' }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                      />
                    </div>
                    <p className={`text-xs mt-1 ${done || active ? 'text-[#D1D5DB]/50' : 'text-[#D1D5DB]/20'}`}>
                      {t(`loading.stepDescs.${key}`)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom node info */}
          <div className="mt-8 pt-5 border-t border-[#2A2A2A] flex items-center justify-between">
            <div className="text-xs text-[#D1D5DB]/40 font-mono uppercase tracking-widest">
              {t('loading.node')}: <span className="text-[#D1D5DB]/70">Satya-Core-01</span>
            </div>
            <div className="text-right">
              <p className={`text-sm font-bold ${isComplete ? 'text-[#14B8A6]' : 'text-[#5eead4]'}`}>
                {isComplete
                  ? t('loading.processingComplete')
                  : `${t('loading.step')} ${Math.min(currentStep + 1, STEP_KEYS.length)} ${t('loading.of')} ${STEP_KEYS.length}`}
              </p>
              <p className="text-xs text-[#D1D5DB]/40 uppercase tracking-widest">{t('loading.estimatedCompletion')}</p>
            </div>
          </div>
        </motion.div>

        {/* Rotating quote */}
        <AnimatePresence mode="wait">
          <motion.p
            key={quoteIndex}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.5 }}
            className="text-[#D1D5DB]/40 text-xs text-center max-w-lg mt-8 italic leading-relaxed"
          >
            {quotesArr[quoteIndex] ? `"${quotesArr[quoteIndex]}"` : ''}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="border-t border-[#2A2A2A] px-8 py-5 flex items-center justify-between">
        <div>
          <p className="font-bold text-sm"><span className="text-[#14B8A6]">Satya</span>Scan AI</p>
          <p className="text-[#D1D5DB]/40 text-xs">{t('landing.footer.rights')}</p>
        </div>
        <div className="flex gap-5 text-xs text-[#D1D5DB]/40">
          {[t('landing.footer.about'), t('landing.footer.features'), t('landing.footer.github'), t('landing.footer.contact')].map((l) => (
            <a key={l} href="#" className="hover:text-[#14B8A6] transition-colors">{l}</a>
          ))}
        </div>
      </div>
    </div>
  );
}
