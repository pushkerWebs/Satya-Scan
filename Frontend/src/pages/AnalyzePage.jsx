import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { analyzeText, analyzeUrl, analyzeImage } from '../api/api';
import LoadingState from '../components/LoadingState';
import LanguageSelector from '../components/LanguageSelector';
import { useLanguage, useTranslation } from '../context/LanguageContext';

const MAX_CHARS = 10000;

function useFakeProgress(active) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!active) { setStep(0); return; }
    const delays = [3000, 7000, 15000, 30000, 45000];
    const timers = delays.map((d, i) => setTimeout(() => setStep(i + 1), d));
    return () => timers.forEach(clearTimeout);
  }, [active]);
  return step;
}

// Inline shield SVG with teal
function ShieldLogo({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="sgAnalyze" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#14B8A6" />
          <stop offset="100%" stopColor="#5eead4" />
        </linearGradient>
      </defs>
      <path d="M50 6 L88 22 L88 54 C88 72 70 88 50 95 C30 88 12 72 12 54 L12 22 Z"
        fill="url(#sgAnalyze)" opacity="0.15" stroke="url(#sgAnalyze)" strokeWidth="2.5" />
      <text x="50" y="66" textAnchor="middle" fontSize="44" fontWeight="800"
        fontFamily="Inter,Arial,sans-serif" fill="url(#sgAnalyze)">S</text>
    </svg>
  );
}

export default function AnalyzePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { selectedLanguage, setDetectedLanguage } = useLanguage();
  const { t } = useTranslation();

  const TABS = [
    { key: 'text', icon: '📝', label: t('analyze.tabs.text') },
    { key: 'url', icon: '🔗', label: t('analyze.tabs.url') },
    { key: 'image', icon: '🖼️', label: t('analyze.tabs.image') },
  ];

  const [tab, setTab] = useState('text');
  const [textInput, setTextInput] = useState(location.state?.prefill || '');
  const [urlInput, setUrlInput] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);
  const progressStep = useFakeProgress(loading);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (tab === 'text' && !textInput.trim()) return setError(t('analyze.errors.noText'));
    if (tab === 'url' && !urlInput.trim()) return setError(t('analyze.errors.noUrl'));
    if (tab === 'image' && !imageFile) return setError(t('analyze.errors.noImage'));
    setLoading(true);
    try {
      let res;
      if (tab === 'text') res = await analyzeText(textInput, selectedLanguage);
      else if (tab === 'url') res = await analyzeUrl(urlInput, selectedLanguage);
      else res = await analyzeImage(imageFile, selectedLanguage);

      // Update detected language in context
      if (res.data?.detectedLanguage) {
        setDetectedLanguage(res.data.detectedLanguage);
      }

      navigate('/results', { state: { result: res.data } });
    } catch (err) {
      setError(err.response?.data?.message || err.message || t('analyze.errors.failed'));
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingState currentStep={progressStep} />;

  return (
    <div className="min-h-screen bg-[#0B0B0B] text-white">
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-[#2A2A2A]">
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate('/')}>
          <ShieldLogo size={24} />
          <span className="font-bold text-base tracking-tight">
            <span className="text-[#14B8A6]">Satya</span>Scan
          </span>
        </div>
        <div className="flex items-center gap-5 text-sm text-[#D1D5DB]">
          <LanguageSelector />
          <button onClick={() => navigate('/history')} className="hover:text-[#14B8A6] transition-colors">
            {t('nav.history')}
          </button>
          <button
            onClick={() => navigate('/')}
            className="hover:text-[#14B8A6] transition-colors font-medium text-[#14B8A6] border-b border-[#14B8A6] pb-0.5"
          >
            {t('nav.dashboard')}
          </button>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="max-w-3xl mx-auto px-6 pt-14 pb-20">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <h1 className="text-4xl font-extrabold mb-2">
            {t('analyze.title')}{' '}
            <span className="gradient-text">{t('analyze.titleAccent')}</span>
          </h1>
          <p className="text-[#D1D5DB] text-sm mb-10 max-w-xl">
            {t('analyze.subtitle')}
          </p>
        </motion.div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
          className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl overflow-hidden"
        >
          {/* Tab bar */}
          <div className="flex border-b border-[#2A2A2A]">
            {TABS.map((tabItem) => (
              <button
                key={tabItem.key}
                onClick={() => { setTab(tabItem.key); setError(''); }}
                className={`flex-1 flex items-center justify-center gap-2 py-4 text-xs font-semibold uppercase tracking-widest transition-all duration-200 border-b-2 -mb-px
                  ${tab === tabItem.key
                    ? 'border-[#14B8A6] text-[#14B8A6] bg-[#14B8A6]/5'
                    : 'border-transparent text-[#D1D5DB]/50 hover:text-[#D1D5DB] hover:bg-white/5'}`}
              >
                <span>{tabItem.icon}</span> {tabItem.label}
              </button>
            ))}
          </div>

          {/* Input area */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <AnimatePresence mode="wait">
              {tab === 'text' && (
                <motion.div key="text" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.2 }}>
                  <div className="relative">
                    <textarea
                      rows={9}
                      value={textInput}
                      onChange={(e) => setTextInput(e.target.value.slice(0, MAX_CHARS))}
                      placeholder={t('analyze.textPlaceholder')}
                      className="w-full bg-[#0B0B0B] border border-[#2A2A2A] text-[#D1D5DB] rounded-xl px-5 py-4 focus:outline-none focus:border-[#14B8A6]/60 resize-none text-sm placeholder-[#D1D5DB]/25 transition-colors"
                    />
                    <div className="absolute bottom-3 right-3 flex items-center gap-3 text-xs text-[#D1D5DB]/30">
                      <span className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#14B8A6] animate-pulse" />
                        {t('analyze.detectingLanguage')}
                      </span>
                      <span>{textInput.length} / {MAX_CHARS.toLocaleString()}</span>
                    </div>
                  </div>
                </motion.div>
              )}

              {tab === 'url' && (
                <motion.div key="url" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.2 }}>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#D1D5DB]/40">🔗</span>
                    <input
                      type="url"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      placeholder={t('analyze.urlPlaceholder')}
                      className="w-full bg-[#0B0B0B] border border-[#2A2A2A] text-[#D1D5DB] rounded-xl pl-10 pr-4 py-4 focus:outline-none focus:border-[#14B8A6]/60 text-sm placeholder-[#D1D5DB]/25 transition-colors"
                    />
                  </div>
                  <p className="text-[#D1D5DB]/30 text-xs mt-2 ml-1">{t('analyze.urlHint')}</p>
                </motion.div>
              )}

              {tab === 'image' && (
                <motion.div key="image" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.2 }}>
                  <div
                    onClick={() => fileRef.current?.click()}
                    className={`w-full border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-200
                      ${imageFile ? 'border-[#14B8A6]/60 bg-[#14B8A6]/5' : 'border-[#2A2A2A] hover:border-[#14B8A6]/40 hover:bg-white/5'}`}
                  >
                    {imageFile ? (
                      <div className="text-[#14B8A6] text-sm">
                        <div className="text-3xl mb-2">✅</div>
                        <p className="font-medium">{imageFile.name}</p>
                        <p className="text-[#D1D5DB]/40 text-xs mt-1">{(imageFile.size / 1024).toFixed(1)} KB</p>
                      </div>
                    ) : (
                      <div>
                        <div className="text-4xl mb-3">🖼️</div>
                        <p className="text-[#D1D5DB] text-sm font-medium">{t('analyze.imageUpload')}</p>
                        <p className="text-[#D1D5DB]/30 text-xs mt-1">{t('analyze.imageHint')}</p>
                      </div>
                    )}
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden"
                    onChange={(e) => setImageFile(e.target.files[0] || null)} />
                  {imageFile && (
                    <button type="button" onClick={() => setImageFile(null)}
                      className="text-xs text-red-400 hover:underline mt-2 ml-1">
                      {t('analyze.removeFile')}
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error */}
            {error && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                className="bg-red-900/20 border border-red-700/50 text-red-300 rounded-xl px-4 py-3 text-sm flex items-center gap-2">
                <span>⚠️</span> {error}
              </motion.div>
            )}

            {/* Footer row */}
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-6 text-xs text-[#D1D5DB]/50">
                <div>
                  <p className="uppercase tracking-wider mb-0.5">{t('analyze.confidence')}</p>
                  <p className="text-[#14B8A6] font-bold text-sm">24ms</p>
                </div>
                <div>
                  <p className="uppercase tracking-wider mb-0.5">{t('analyze.modelVersion')}</p>
                  <p className="text-[#D1D5DB] font-medium">Satya-Neo v4.2</p>
                </div>
              </div>

              <motion.button
                type="submit"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                className="ss-btn-primary px-8 py-3 text-sm uppercase tracking-wider shadow-lg shadow-[#14B8A6]/20"
              >
                <span>⚡</span> {t('analyze.analyzeBtn')}
              </motion.button>
            </div>
          </form>
        </motion.div>

        {/* Status bar */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
          className="flex items-center justify-center gap-6 mt-6 text-xs text-[#D1D5DB]/40"
        >
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#14B8A6]" />
            {t('analyze.allOperational')}
          </span>
          <span>{t('analyze.updatedAgo')}</span>
        </motion.div>
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
