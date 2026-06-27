import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useInView, useMotionValue, useTransform, useSpring } from 'framer-motion';
import { useTranslation, useLanguage } from '../context/LanguageContext';

// ── Enhanced Animation variants ────────────────────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.6, delay: i * 0.1, ease: [0.4, 0, 0.2, 1] },
  }),
};

const fadeIn = {
  hidden: { opacity: 0 },
  visible: (i = 0) => ({
    opacity: 1,
    transition: { duration: 0.5, delay: i * 0.1 },
  }),
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.88 },
  visible: (i = 0) => ({
    opacity: 1, scale: 1,
    transition: { duration: 0.5, delay: i * 0.12, ease: [0.4, 0, 0.2, 1] },
  }),
};

const springUp = {
  hidden: { opacity: 0, y: 60 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { type: 'spring', stiffness: 100, damping: 15, delay: i * 0.12 },
  }),
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.15 } },
};

// ── 3D Tilt Card component ─────────────────────────────────────────────────────
function TiltCard({ children, className = '', style = {} }) {
  const ref = useRef(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useTransform(y, [-0.5, 0.5], [6, -6]);
  const rotateY = useTransform(x, [-0.5, 0.5], [-6, 6]);
  const springRotateX = useSpring(rotateX, { stiffness: 200, damping: 20 });
  const springRotateY = useSpring(rotateY, { stiffness: 200, damping: 20 });

  const handleMouse = useCallback((e) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    x.set((e.clientX - rect.left) / rect.width - 0.5);
    y.set((e.clientY - rect.top) / rect.height - 0.5);
  }, [x, y]);

  const handleLeave = useCallback(() => {
    x.set(0);
    y.set(0);
  }, [x, y]);

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouse}
      onMouseLeave={handleLeave}
      style={{ ...style, rotateX: springRotateX, rotateY: springRotateY, transformStyle: 'preserve-3d' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ── Animated section wrapper ───────────────────────────────────────────────────
function AnimatedSection({ children, className = '' }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <motion.div ref={ref} initial="hidden" animate={inView ? 'visible' : 'hidden'} className={className}>
      {children}
    </motion.div>
  );
}

// ── Shield Logo ────────────────────────────────────────────────────────────────
function ShieldLogo({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <defs>
        <linearGradient id="slgLanding" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#14B8A6" />
          <stop offset="100%" stopColor="#5eead4" />
        </linearGradient>
      </defs>
      <path d="M50 6 L88 22 L88 54 C88 72 70 88 50 95 C30 88 12 72 12 54 L12 22 Z"
        fill="url(#slgLanding)" opacity="0.15" stroke="url(#slgLanding)" strokeWidth="2.5" />
      <text x="50" y="66" textAnchor="middle" fontSize="44" fontWeight="800"
        fontFamily="Inter,Arial,sans-serif" fill="url(#slgLanding)">S</text>
    </svg>
  );
}

const FEATURE_ICONS = ['🔍', '🤖', '✅', '🌐'];
const STEP_NUMS = ['01', '02', '03', '04'];


export default function LandingPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { uiLang, setUiLang, setSelectedLanguage } = useLanguage();
  const [searchValue, setSearchValue] = useState('');
  const [navVisible, setNavVisible] = useState(true);
  const [navScrolled, setNavScrolled] = useState(false);

  useEffect(() => {
    let lastY = 0;
    const handler = ({ scroll }) => {
      const y = scroll;
      setNavScrolled(y > 50);
      setNavVisible(y < lastY || y < 60);
      lastY = y;
    };
    // Use Lenis if available, else fall back to native scroll
    const lenis = window.__lenis;
    if (lenis) {
      lenis.on('scroll', handler);
      return () => lenis.off('scroll', handler);
    } else {
      const nativeHandler = () => handler({ scroll: window.scrollY });
      window.addEventListener('scroll', nativeHandler, { passive: true });
      return () => window.removeEventListener('scroll', nativeHandler);
    }
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    navigate('/analyze', { state: { prefill: searchValue } });
  };

  const goAnalyze = () => navigate('/analyze');

  const FEATURES = [
    { icon: FEATURE_ICONS[0], title: t('landing.features.f1Title'), desc: t('landing.features.f1Desc') },
    { icon: FEATURE_ICONS[1], title: t('landing.features.f2Title'), desc: t('landing.features.f2Desc') },
    { icon: FEATURE_ICONS[2], title: t('landing.features.f3Title'), desc: t('landing.features.f3Desc') },
    { icon: FEATURE_ICONS[3], title: t('landing.features.f4Title'), desc: t('landing.features.f4Desc') },
  ];

  const STEPS = [
    { step: STEP_NUMS[0], title: t('landing.steps.s1Title'), desc: t('landing.steps.s1Desc') },
    { step: STEP_NUMS[1], title: t('landing.steps.s2Title'), desc: t('landing.steps.s2Desc') },
    { step: STEP_NUMS[2], title: t('landing.steps.s3Title'), desc: t('landing.steps.s3Desc') },
    { step: STEP_NUMS[3], title: t('landing.steps.s4Title'), desc: t('landing.steps.s4Desc') },
  ];

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white overflow-x-hidden">
      {/* ── Navbar ── */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 px-6 py-3.5 flex items-center justify-between"
        style={{
          transform: navVisible ? 'translateY(0)' : 'translateY(-110%)',
          transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), background 0.4s ease, backdrop-filter 0.4s ease, box-shadow 0.4s ease, border-color 0.4s ease',
          background: navScrolled
            ? 'rgba(7, 7, 7, 0.72)'
            : 'transparent',
          backdropFilter: navScrolled ? 'blur(24px) saturate(180%)' : 'none',
          WebkitBackdropFilter: navScrolled ? 'blur(24px) saturate(180%)' : 'none',
          borderBottom: navScrolled ? '1px solid rgba(20,184,166,0.12)' : '1px solid transparent',
          boxShadow: navScrolled ? '0 4px 40px rgba(0,0,0,0.5)' : 'none',
          willChange: 'transform',
        }}
      >
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
          <span className="font-bold text-xl tracking-tight cursor-pointer flex items-center gap-2.5" onClick={() => navigate('/')}>
            <ShieldLogo size={26} />
            <span><span className="text-[#14B8A6]">Satya</span>Scan</span>
          </span>
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}
          className="flex items-center gap-3">

          {/* Search bar → goes to /analyze */}
          <form onSubmit={handleSearchSubmit} className="hidden sm:flex items-center">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#D1D5DB]/40 text-sm">🔍</span>
              <input
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                onFocus={() => navigate('/analyze')}
                type="text"
                placeholder={t('landing.searchPlaceholder')}
                className="pl-9 pr-4 py-1.5 rounded-lg border border-white/10 bg-white/5 text-white placeholder-[#D1D5DB]/30 text-sm w-48 outline-none focus:border-[#14B8A6]/60 focus:bg-white/8 transition-all"
              />
            </div>
          </form>

          {/* UI Language toggle */}
          <button
            onClick={() => {
              const newLang = uiLang === 'en' ? 'hi' : 'en';
              setUiLang(newLang);
              setSelectedLanguage(newLang);
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-white/10 text-[#D1D5DB] hover:border-[#14B8A6]/60 hover:text-[#14B8A6] transition-all text-xs font-bold"
          >
            {uiLang === 'en' ? '🇮🇳 HI' : '🇬🇧 EN'}
          </button>

          {/* Sign In */}
          <button
            onClick={() => navigate('/login')}
            className="hidden sm:flex items-center gap-1.5 px-4 py-1.5 rounded-lg border border-white/15 text-[#D1D5DB] hover:border-[#14B8A6]/60 hover:text-[#14B8A6] transition-all text-sm font-semibold"
          >
            Sign In
          </button>

          {/* Get Started */}
          <button
            onClick={goAnalyze}
            className="ss-btn-primary text-sm px-4 py-1.5"
          >
            {t('landing.hero.cta')} →
          </button>
        </motion.div>
      </nav>

      {/* ── Hero ── */}
      <section className="hero-gradient grid-pattern pt-32 pb-20 px-6 max-w-6xl mx-auto relative">
        {/* Morphing gradient blob */}
        <div className="absolute top-10 right-10 w-[400px] h-[400px] morph-blob opacity-20 pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(20,184,166,0.2) 0%, transparent 70%)' }} />

        <div className="flex flex-col lg:flex-row items-center gap-12">
          <div className="flex-1 text-center lg:text-left">
            <motion.div variants={fadeIn} initial="hidden" animate="visible" custom={0}>
              <span className="ss-badge mb-6 inline-flex">
                <span className="w-1.5 h-1.5 rounded-full bg-[#14B8A6] accent-pulse" />
                {t('landing.badge')}
              </span>
            </motion.div>

            <motion.h1
              variants={fadeUp} initial="hidden" animate="visible" custom={1}
              className="text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-tight mb-6"
            >
              {t('landing.hero.title1')}
              <span className="block gradient-text">
                {t('landing.hero.title2')}
              </span>
            </motion.h1>

            <motion.p
              variants={fadeUp} initial="hidden" animate="visible" custom={2}
              className="text-lg text-[#D1D5DB] mb-8 max-w-lg mx-auto lg:mx-0"
            >
              {t('landing.hero.subtitle')}
            </motion.p>

            <motion.div
              variants={fadeUp} initial="hidden" animate="visible" custom={3}
              className="flex flex-wrap gap-4 justify-center lg:justify-start"
            >
              <motion.button
                whileHover={{ scale: 1.05, boxShadow: '0 0 40px rgba(20,184,166,0.3)' }}
                whileTap={{ scale: 0.97 }}
                onClick={goAnalyze}
                className="shimmer-btn px-8 py-3 text-sm font-bold text-black rounded-xl shadow-lg shadow-[#14B8A6]/20"
              >
                {t('landing.hero.cta')} →
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05, borderColor: 'rgba(20,184,166,0.6)' }}
                whileTap={{ scale: 0.97 }}
                onClick={goAnalyze}
                className="ss-btn-secondary px-8 py-3 text-sm"
              >
                {t('landing.hero.ctaSecondary')}
              </motion.button>
            </motion.div>

            <motion.div
              variants={fadeUp} initial="hidden" animate="visible" custom={4}
              className="flex gap-6 mt-8 justify-center lg:justify-start flex-wrap"
            >
              {[t('landing.trust.soc2'), t('landing.trust.encrypted'), t('landing.trust.gdpr')].map((tag) => (
                <span key={tag} className="text-xs flex items-center gap-1.5 text-[#D1D5DB]">
                  <span className="text-[#14B8A6]">✓</span> {tag}
                </span>
              ))}
            </motion.div>
          </div>

          {/* Hero visual cards */}
          <div className="flex-1 relative w-full max-w-sm mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
              className="relative"
            >
              {/* Floating verified card — figure-8 motion */}
              <motion.div
                animate={{
                  y: [0, -10, 0, 6, 0],
                  x: [0, 5, 0, -5, 0],
                  rotate: [0, 1, 0, -1, 0],
                }}
                transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute -top-4 right-0 flex items-center gap-3 px-4 py-3 rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] shadow-xl z-10"
              >
                <span className="text-[#14B8A6] text-xl">✅</span>
                <div>
                  <p className="text-xs text-[#D1D5DB]/60 uppercase tracking-wider">{t('landing.verified')}</p>
                  <p className="text-sm font-bold text-white">BBC News API</p>
                </div>
              </motion.div>

              {/* Main card with 3D tilt */}
              <TiltCard className="mt-12 rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] p-6 shadow-2xl">
                <div className="flex items-center gap-2 mb-4">
                  <motion.span animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 2, repeat: Infinity, delay: 0 }} className="w-3 h-3 rounded-full bg-red-500" />
                  <motion.span animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 2, repeat: Infinity, delay: 0.3 }} className="w-3 h-3 rounded-full bg-yellow-500" />
                  <motion.span animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 2, repeat: Infinity, delay: 0.6 }} className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="ml-auto text-xs text-[#D1D5DB]/50">{t('landing.analysisProgress')}…</span>
                </div>
                <div className="space-y-3">
                  {[
                    { label: t('landing.claimExtraction'), status: '✓', color: 'bg-[#14B8A6]', w: 'w-full' },
                    { label: t('landing.sourceMatching'), status: '✓', color: 'bg-[#14B8A6]', w: 'w-4/5' },
                    { label: t('landing.aiDetection'), status: '…', color: 'bg-[#5eead4]', w: 'w-3/5' },
                  ].map((item, idx) => (
                    <div key={item.label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-[#D1D5DB]/60">{item.label}</span>
                        <span className="text-[#14B8A6]">{item.status}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[#2A2A2A]">
                        <motion.div
                          className={`h-1.5 rounded-full ${item.color}`}
                          initial={{ width: 0 }} animate={{ width: item.w }}
                          transition={{ duration: 1.2, delay: 0.8 + idx * 0.2, ease: [0.4, 0, 0.2, 1] }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </TiltCard>

              {/* Floating AI confidence card — figure-8 motion */}
              <motion.div
                animate={{
                  y: [0, 8, 0, -6, 0],
                  x: [0, -6, 0, 4, 0],
                  rotate: [0, -1.5, 0, 1.5, 0],
                }}
                transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
                className="absolute -bottom-4 left-0 flex items-center gap-3 px-4 py-3 rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] shadow-xl"
              >
                <span className="text-[#5eead4] text-xl">🤖</span>
                <div>
                  <p className="text-xs text-[#D1D5DB]/60 uppercase tracking-wider">{t('landing.aiConfidence')}</p>
                  <p className="text-sm font-bold text-white">{t('landing.genuine')}</p>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

  

      {/* ── Features ── */}
      <AnimatedSection className="py-24 px-6 max-w-7xl mx-auto">
        {/* Section heading */}
        <motion.div variants={fadeUp} className="text-center mb-16">
          <span className="ss-badge mb-5 inline-flex">
            <span className="w-1.5 h-1.5 rounded-full bg-[#14B8A6] accent-pulse" />
            Intelligence Suite
          </span>
          <h2 className="text-4xl sm:text-5xl font-extrabold mb-4 leading-tight">
            Capabilities Built for{' '}
            <span className="gradient-text">Modern Verification</span>
          </h2>
          <p className="text-[#D1D5DB]/80 max-w-2xl mx-auto text-lg leading-relaxed">
            AI tools that detect misinformation, validate sources, and surface truth — in real time.
          </p>
        </motion.div>

        {/* Asymmetric feature grid with 3D tilt */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">

          {/* ── Large Left Card (2/3 width) ── */}
          <TiltCard
            className="lg:col-span-2 relative rounded-2xl border border-[#2A2A2A] overflow-hidden cursor-pointer group"
            style={{
              background: 'linear-gradient(145deg, rgba(26,26,26,0.95) 0%, rgba(14,14,14,0.98) 100%)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              boxShadow: '0 8px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)',
            }}
          >
            <motion.div variants={scaleIn} custom={0} className="h-full">
              {/* Subtle top-left glow */}
              <div className="absolute -top-16 -left-16 w-64 h-64 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                style={{ background: 'radial-gradient(circle, rgba(20,184,166,0.12) 0%, transparent 70%)' }} />

              <div className="relative z-10 p-8 sm:p-10 flex flex-col h-full">
                {/* Icon with glow ring */}
                <div className="mb-6">
                  <motion.div
                    whileHover={{ rotate: [0, -5, 5, 0], scale: 1.1 }}
                    transition={{ duration: 0.5 }}
                    className="feature-icon-glow inline-flex items-center justify-center w-14 h-14 rounded-xl text-2xl"
                    style={{
                      background: 'linear-gradient(135deg, rgba(20,184,166,0.15) 0%, rgba(94,234,212,0.08) 100%)',
                      border: '1px solid rgba(20,184,166,0.3)',
                      boxShadow: '0 0 20px rgba(20,184,166,0.2), inset 0 1px 0 rgba(255,255,255,0.06)',
                    }}
                  >
                    🔍
                  </motion.div>
                </div>

                <h3 className="text-2xl sm:text-3xl font-extrabold text-white mb-3 leading-snug">
                  Advanced Fact Checking
                </h3>
                <p className="text-[#D1D5DB]/70 text-base leading-relaxed max-w-lg">
                  Real-time verification using trusted databases, research publications, and official sources — surfacing truth with citation-backed confidence scores.
                </p>

                {/* Illustrative banner */}
                <div className="mt-8 flex-1 rounded-xl overflow-hidden relative min-h-[160px]"
                  style={{
                    background: 'linear-gradient(135deg, rgba(20,184,166,0.07) 0%, rgba(11,11,11,0.9) 80%)',
                    border: '1px solid rgba(20,184,166,0.12)',
                  }}
                >
                  {/* Animated scan lines */}
                  <div className="absolute inset-0 flex flex-col justify-center px-6 py-4 gap-3">
                    {[
                      { label: 'WHO Official Report', match: 'High', w: 'w-full', color: '#14B8A6' },
                      { label: 'Reuters Fact-Check', match: 'High', w: 'w-5/6', color: '#5eead4' },
                      { label: 'PubMed Research', match: 'Medium', w: 'w-4/5', color: '#14B8A6' },
                      { label: 'AP News Verification', match: 'Medium', w: 'w-3/4', color: '#5eead4' },
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-center gap-3">
                        <span className="text-[10px] text-[#D1D5DB]/40 w-36 shrink-0 truncate">{item.label}</span>
                        <div className="flex-1 h-1.5 rounded-full bg-[#2A2A2A] overflow-hidden">
                          <motion.div
                            className="h-1.5 rounded-full"
                            style={{ backgroundColor: item.color }}
                            initial={{ width: 0 }}
                            animate={{ width: item.w }}
                            transition={{ duration: 1.4, delay: 0.6 + idx * 0.15, ease: [0.4, 0, 0.2, 1] }}
                          />
                        </div>
                        <span className="text-[10px] font-bold shrink-0" style={{ color: item.color }}>{item.match}</span>
                      </div>
                    ))}
                  </div>
                  {/* Corner badge */}
                  <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold"
                    style={{ background: 'rgba(20,184,166,0.12)', border: '1px solid rgba(20,184,166,0.25)', color: '#14B8A6' }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-[#14B8A6] accent-pulse" />
                    LIVE
                  </div>
                </div>
              </div>
            </motion.div>
          </TiltCard>

          {/* ── Right Column: Two stacked cards ── */}
          <div className="flex flex-col gap-5">

            {/* Card 2 — AI Content Detection */}
            <TiltCard
              className="flex-1 relative rounded-2xl border border-[#2A2A2A] overflow-hidden cursor-pointer group"
              style={{
                background: 'linear-gradient(145deg, rgba(26,26,26,0.95) 0%, rgba(14,14,14,0.98) 100%)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                boxShadow: '0 8px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)',
              }}
            >
              <motion.div variants={scaleIn} custom={1} className="h-full">
                <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                  style={{ background: 'radial-gradient(circle, rgba(20,184,166,0.1) 0%, transparent 70%)' }} />
                <div className="relative z-10 p-7">
                  <motion.div
                    whileHover={{ rotate: [0, -5, 5, 0], scale: 1.1 }}
                    transition={{ duration: 0.5 }}
                    className="mb-5 inline-flex items-center justify-center w-11 h-11 rounded-xl text-xl"
                    style={{
                      background: 'linear-gradient(135deg, rgba(20,184,166,0.15) 0%, rgba(94,234,212,0.08) 100%)',
                      border: '1px solid rgba(20,184,166,0.3)',
                      boxShadow: '0 0 16px rgba(20,184,166,0.18)',
                    }}
                  >
                    🤖
                  </motion.div>
                  <h3 className="text-lg font-bold text-white mb-2 leading-snug">
                    AI Content Detection
                  </h3>
                  <p className="text-sm text-[#D1D5DB]/65 leading-relaxed">
                    Detect AI-generated text, manipulated content, synthetic media, and misinformation patterns with multi-signal forensic analysis.
                  </p>
                  {/* Mini stat pills */}
                  <div className="mt-5 flex flex-wrap gap-2">
                    {['GPT Detection', 'Deepfake', 'Synthetic'].map((tag) => (
                      <motion.span
                        key={tag}
                        whileHover={{ scale: 1.08, borderColor: 'rgba(20,184,166,0.5)' }}
                        className="px-2.5 py-1 rounded-full text-[10px] font-semibold cursor-default"
                        style={{ background: 'rgba(20,184,166,0.08)', border: '1px solid rgba(20,184,166,0.2)', color: '#5eead4' }}>
                        {tag}
                      </motion.span>
                    ))}
                  </div>
                </div>
              </motion.div>
            </TiltCard>

            {/* Card 3 — Source Credibility Analysis */}
            <TiltCard
              className="flex-1 relative rounded-2xl border border-[#2A2A2A] overflow-hidden cursor-pointer group"
              style={{
                background: 'linear-gradient(145deg, rgba(26,26,26,0.95) 0%, rgba(14,14,14,0.98) 100%)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                boxShadow: '0 8px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)',
              }}
            >
              <motion.div variants={scaleIn} custom={2} className="h-full">
                <div className="absolute -bottom-10 -right-10 w-40 h-40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                  style={{ background: 'radial-gradient(circle, rgba(94,234,212,0.1) 0%, transparent 70%)' }} />
                <div className="relative z-10 p-7">
                  <motion.div
                    whileHover={{ rotate: [0, -5, 5, 0], scale: 1.1 }}
                    transition={{ duration: 0.5 }}
                    className="mb-5 inline-flex items-center justify-center w-11 h-11 rounded-xl text-xl"
                    style={{
                      background: 'linear-gradient(135deg, rgba(20,184,166,0.15) 0%, rgba(94,234,212,0.08) 100%)',
                      border: '1px solid rgba(20,184,166,0.3)',
                      boxShadow: '0 0 16px rgba(20,184,166,0.18)',
                    }}
                  >
                    ✅
                  </motion.div>
                  <h3 className="text-lg font-bold text-white mb-2 leading-snug">
                    Source Credibility Analysis
                  </h3>
                  <p className="text-sm text-[#D1D5DB]/65 leading-relaxed">
                    Evaluate source trustworthiness using reputation scores, historical accuracy, citations, and reliability metrics from verified outlets.
                  </p>
                  {/* Credibility meter */}
                  <div className="mt-5">
                    <div className="flex justify-between text-[10px] text-[#D1D5DB]/40 mb-1.5">
                      <span>Credibility Score</span>
                      <span className="text-[#14B8A6] font-bold">High</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#2A2A2A] overflow-hidden">
                      <motion.div
                        className="h-1.5 rounded-full"
                        style={{ background: 'linear-gradient(90deg, #14B8A6, #5eead4)' }}
                        initial={{ width: 0 }}
                        animate={{ width: '94%' }}
                        transition={{ duration: 1.5, delay: 0.8, ease: [0.4, 0, 0.2, 1] }}
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            </TiltCard>

          </div>
        </div>
      </AnimatedSection>

      {/* ── How It Works ── */}
      <AnimatedSection className="py-20 px-6 max-w-5xl mx-auto">
        <motion.div variants={fadeUp} className="text-center mb-12">
          <h2 className="text-4xl font-extrabold mb-3">{t('landing.steps.title')}</h2>
          <p className="text-[#D1D5DB]">{t('landing.steps.subtitle')}</p>
        </motion.div>

        {/* Steps with connected timeline */}
        <div className="relative">
          {/* Connecting line (desktop only) */}
          <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-[2px] -translate-y-1/2 z-0">
            <motion.div
              className="h-full rounded-full"
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.2, ease: [0.4, 0, 0.2, 1] }}
              style={{ transformOrigin: 'left', background: 'linear-gradient(90deg, transparent 0%, rgba(20,184,166,0.3) 10%, rgba(20,184,166,0.3) 90%, transparent 100%)' }}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 relative z-10">
            {STEPS.map((s, i) => (
              <motion.div
                key={s.step} variants={springUp} custom={i}
                whileHover={{ y: -8, boxShadow: '0 12px 40px rgba(20,184,166,0.12)' }}
                className="ss-card relative bg-[#1A1A1A] backdrop-blur-sm"
              >
                {/* Step number with glow */}
                <motion.p
                  className="text-4xl font-black mb-3"
                  style={{ color: 'rgba(20,184,166,0.2)' }}
                  whileHover={{ color: 'rgba(20,184,166,0.4)' }}
                >
                  {s.step}
                </motion.p>
                <h3 className="font-bold text-base mb-1 text-white">{s.title}</h3>
                <p className="text-sm text-[#D1D5DB]">{s.desc}</p>

                {/* Arrow connector (desktop) */}
                {i < STEPS.length - 1 && (
                  <motion.div
                    initial={{ opacity: 0, x: -5 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 + i * 0.15 }}
                    className="hidden lg:block absolute -right-3 top-1/2 -translate-y-1/2 text-[#14B8A6]/50 text-xl z-10"
                  >
                    →
                  </motion.div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </AnimatedSection>

      {/* ── CTA ── */}
      <AnimatedSection className="py-20 px-6">
        <motion.div
          variants={scaleIn}
          className="max-w-2xl mx-auto text-center relative overflow-hidden rounded-3xl"
        >
          {/* Animated glow ring behind */}
          <div className="absolute inset-0 glass-card-glow rounded-3xl" />
          
          <div className="relative bg-[#1A1A1A] border border-[#14B8A6]/20 rounded-3xl p-12 shadow-2xl"
            style={{ boxShadow: '0 0 60px rgba(20,184,166,0.08)' }}
          >
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-4xl font-extrabold text-white mb-4"
            >
              {t('landing.cta.title')}
            </motion.h2>
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="text-[#D1D5DB] mb-8"
            >
              {t('landing.cta.subtitle')}
            </motion.p>
            <div className="flex gap-4 justify-center flex-wrap">
              <motion.button
                whileHover={{ scale: 1.05, boxShadow: '0 0 50px rgba(20,184,166,0.35)' }}
                whileTap={{ scale: 0.97 }}
                onClick={goAnalyze}
                className="shimmer-btn px-8 py-3 font-bold text-black rounded-xl shadow-lg shadow-[#14B8A6]/20"
              >
                {t('landing.cta.primary')}
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05, borderColor: 'rgba(20,184,166,0.6)' }}
                whileTap={{ scale: 0.97 }}
                onClick={goAnalyze}
                className="ss-btn-secondary px-8 py-3"
              >
                {t('landing.cta.secondary')}
              </motion.button>
            </div>
          </div>
        </motion.div>
      </AnimatedSection>

      {/* ── Footer ── */}
      <footer className="border-t border-[#2A2A2A] px-6 py-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="font-bold text-lg">
              <span className="text-[#14B8A6]">Satya</span>Scan
            </p>
            <p className="text-xs text-[#D1D5DB]/50">{t('landing.footer.rights')}</p>
          </div>
          <div className="flex gap-6 text-sm text-[#D1D5DB]/60">
            {[
              t('landing.footer.about'),
              t('landing.footer.features'),
              t('landing.footer.github'),
              t('landing.footer.contact'),
            ].map((l) => (
              <a key={l} href="#" className="hover:text-[#14B8A6] transition-colors">{l}</a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
