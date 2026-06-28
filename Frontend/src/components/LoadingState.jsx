import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from '../context/LanguageContext';

const STEP_KEYS = ['extract', 'sources', 'evidence', 'ai', 'score'];

function ShieldLogo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <defs>
        <linearGradient id="slgLoading" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#232B1B" />
          <stop offset="100%" stopColor="#5C6650" />
        </linearGradient>
      </defs>
      <path d="M50 6 L88 22 L88 54 C88 72 70 88 50 95 C30 88 12 72 12 54 L12 22 Z"
        fill="url(#slgLoading)" opacity="0.08" stroke="url(#slgLoading)" strokeWidth="2.5" />
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
    <div className="min-h-screen bg-[#FBE8CE] text-[#232B1B] flex flex-col font-sans">
      {/* Top bar */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-[#C3CC9B]">
        <div className="flex items-center gap-2.5">
          <img src="/SatyaScan_logo_transparent.png" alt="SatyaScan Logo" className="h-10 w-auto object-contain" />
          <span className="font-bold text-base tracking-tight">
            <span className="text-[#232B1B]">Satya</span><span className="text-[#5C6650] font-medium">Scan</span>
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm text-[#5C6650]">
          <span className="text-[#232B1B] font-medium border-b border-[#232B1B] pb-0.5">
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
          className="w-full max-w-lg bg-[#E4DFB5] border border-[#C3CC9B] rounded-2xl p-8 shadow-xl"
        >
          {/* Header */}
          <div className="text-center mb-8">
            <motion.h2
              className="text-3xl font-extrabold mb-2 text-[#232B1B]"
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              {isComplete ? t('loading.complete') : t('loading.title')}
            </motion.h2>
            <p className="text-[#5C6650] text-sm">
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
                          ? 'bg-[#9AB17A]/20 border-[#9AB17A]'
                          : active
                          ? 'bg-[#9AB17A]/10 border-[#9AB17A]/60'
                          : 'bg-[#E4DFB5] border-[#C3CC9B]'}`}>
                        {done ? (
                          <span className="text-[#768E56] text-xs font-bold">✓</span>
                        ) : active ? (
                          <motion.span
                            className="w-2 h-2 rounded-full bg-[#9AB17A]"
                            animate={{ scale: [1, 1.4, 1] }}
                            transition={{ duration: 1, repeat: Infinity }}
                          />
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#C3CC9B]" />
                        )}
                      </div>

                      <span className={`text-xs font-bold uppercase tracking-widest
                        ${done ? 'text-[#232B1B]' : active ? 'text-[#232B1B]' : 'text-[#5C6650]/40'}`}>
                        {t(`loading.steps.${key}`)}
                      </span>
                    </div>

                    <span className={`text-xs font-semibold uppercase tracking-wider
                      ${done ? 'text-[#768E56]' : active ? 'text-[#768E56] font-bold' : 'text-[#5C6650]/40'}`}>
                      {done ? t('loading.status.complete') : active ? t('loading.status.running') : t('loading.status.pending')}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="ml-9">
                    <div className="h-0.5 bg-[#C3CC9B]/60 rounded-full overflow-hidden">
                      <motion.div
                        className="h-0.5 rounded-full"
                        style={{
                          background: done
                            ? 'linear-gradient(90deg, #9AB17A, #768E56)'
                            : 'linear-gradient(90deg, #9AB17A, #5C6650)',
                        }}
                        initial={{ width: '0%' }}
                        animate={{ width: done ? '100%' : active ? `${barWidths[i] || 60}%` : '0%' }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                      />
                    </div>
                    <p className={`text-xs mt-1 ${done || active ? 'text-[#5C6650]/80' : 'text-[#5C6650]/30'}`}>
                      {t(`loading.stepDescs.${key}`)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom node info */}
          <div className="mt-8 pt-5 border-t border-[#C3CC9B] flex items-center justify-between">
            <div className="text-xs text-[#5C6650]/60 font-mono uppercase tracking-widest">
              {t('loading.node')}: <span className="text-[#232B1B] font-bold">Satya-Core-01</span>
            </div>
            <div className="text-right">
              <p className={`text-sm font-bold ${isComplete ? 'text-[#768E56]' : 'text-[#232B1B]'}`}>
                {isComplete
                  ? t('loading.processingComplete')
                  : `${t('loading.step')} ${Math.min(currentStep + 1, STEP_KEYS.length)} ${t('loading.of')} ${STEP_KEYS.length}`}
              </p>
              <p className="text-xs text-[#5C6650]/50 uppercase tracking-widest">{t('loading.estimatedCompletion')}</p>
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
            className="text-[#5C6650]/60 text-xs text-center max-w-lg mt-8 italic leading-relaxed"
          >
            {quotesArr[quoteIndex] ? `"${quotesArr[quoteIndex]}"` : ''}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="border-t border-[#C3CC9B] bg-[#E4DFB5] px-8 py-5 flex items-center justify-between">
        <div>
          <p className="font-bold text-sm text-[#232B1B]">Satya<span className="text-[#5C6650] font-medium">Scan AI</span></p>
          <p className="text-[#5C6650] text-xs">{t('landing.footer.rights')}</p>
        </div>
        <div className="flex gap-5 text-xs text-[#5C6650]">
          {[t('landing.footer.about'), t('landing.footer.features'), t('landing.footer.github'), t('landing.footer.contact')].map((l) => (
            <a key={l} href="#" className="hover:text-[#232B1B] transition-colors">{l}</a>
          ))}
        </div>
      </div>
    </div>
  );
}
