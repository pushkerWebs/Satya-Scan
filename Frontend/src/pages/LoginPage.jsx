import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { login } from '../api/api';
import { useTranslation } from '../context/LanguageContext';
import { Lock, Mail, Eye, EyeOff, Shield, Zap, ShieldCheck } from 'lucide-react';

/* ── Animation ─────────────────────────────────────────────────────────────── */
const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.45, delay: i * 0.08, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
};

/* ── Floating particles background ─────────────────────────────────────────── */
function Particles() {
  const dots = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 2.5 + 1,
    dur: Math.random() * 20 + 15,
    delay: Math.random() * -20,
    opacity: Math.random() * 0.25 + 0.05,
  }));

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {dots.map((d) => (
        <motion.div
          key={d.id}
          className="absolute rounded-full"
          style={{
            left: `${d.x}%`, top: `${d.y}%`,
            width: d.size, height: d.size,
            background: `rgba(20,184,166,${d.opacity})`,
          }}
          animate={{ y: [0, -30, 0], x: [0, 12, 0], opacity: [d.opacity, d.opacity * 2, d.opacity] }}
          transition={{ duration: d.dur, repeat: Infinity, ease: 'easeInOut', delay: d.delay }}
        />
      ))}
    </div>
  );
}

/* ── Shield illustration ───────────────────────────────────────────────────── */
function ShieldIllustration() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="relative"
    >
      {/* outer glow ring */}
      <div className="absolute inset-0 -m-8 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(20,184,166,0.12) 0%, transparent 70%)' }} />

      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <svg width="100" height="100" viewBox="0 0 100 100" fill="none">
          <defs>
            <linearGradient id="shieldGradLogin" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#14B8A6" />
              <stop offset="100%" stopColor="#5eead4" />
            </linearGradient>
            <filter id="shieldGlowLogin">
              <feGaussianBlur stdDeviation="4" result="coloredBlur" />
              <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          <path d="M50 6 L88 22 L88 54 C88 72 70 88 50 95 C30 88 12 72 12 54 L12 22 Z"
            fill="url(#shieldGradLogin)" opacity="0.15" stroke="url(#shieldGradLogin)" strokeWidth="1.5" />
          <text x="50" y="64" textAnchor="middle" fontSize="40" fontWeight="800"
            fontFamily="Inter,Arial,sans-serif" fill="url(#shieldGradLogin)" filter="url(#shieldGlowLogin)">S</text>
        </svg>
      </motion.div>
    </motion.div>
  );
}

/* ── Main ──────────────────────────────────────────────────────────────────── */
export default function LoginPage() {
  const { t } = useTranslation();
  const { saveAuth } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await login(form.email, form.password);
      saveAuth(data.token, data.user);
      navigate('/analyze');
    } catch (err) {
      setError(err.response?.data?.message || t('login.failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: '#09090B' }}>

      {/* ── Left: Branding ─────────────────────────────────────────────── */}
      <div className="hidden lg:flex flex-1 items-center justify-center relative overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #09090B 0%, #0f1117 50%, #09090B 100%)' }}>

        <Particles />

        {/* gradient wash */}
        <div className="absolute inset-0"
          style={{ background: 'radial-gradient(ellipse 50% 50% at 50% 45%, rgba(20,184,166,0.07) 0%, transparent 70%)' }} />

        <div className="relative z-10 flex flex-col items-center text-center px-12 max-w-sm">
          <ShieldIllustration />

          <motion.h2
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="text-3xl font-extrabold text-white mt-8 mb-3"
          >
            <span style={{ color: '#14B8A6' }}>Satya</span>Scan
          </motion.h2>

          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ delay: 0.55, duration: 0.5 }}
            className="text-sm leading-relaxed"
            style={{ color: 'rgba(209,213,219,0.55)' }}
          >
            AI-Powered Fact Verification
          </motion.p>

          {/* trust badges */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ delay: 0.75, duration: 0.5 }}
            className="flex items-center gap-5 mt-10"
          >
            {[
              { Icon: Lock, text: 'Secure' },
              { Icon: Zap, text: 'Fast' },
              { Icon: ShieldCheck, text: 'Private' },
            ].map(({ Icon, text }) => (
              <div key={text} className="flex items-center gap-1.5" style={{ color: 'rgba(20,184,166,0.5)' }}>
                <Icon size={13} strokeWidth={1.8} />
                <span className="text-[11px] font-medium">{text}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* ── Right: Form ────────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">

          {/* mobile logo */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="lg:hidden flex items-center gap-2.5 mb-10">
            <Shield size={22} style={{ color: '#14B8A6' }} strokeWidth={2} />
            <span className="font-bold text-lg text-white">
              <span style={{ color: '#14B8A6' }}>Satya</span>Scan
            </span>
          </motion.div>

          <motion.h1 custom={0} variants={fadeUp} initial="hidden" animate="visible"
            className="text-2xl font-bold text-white mb-1">
            {t('login.title')}
          </motion.h1>
          <motion.p custom={1} variants={fadeUp} initial="hidden" animate="visible"
            className="text-sm mb-8" style={{ color: 'rgba(209,213,219,0.45)' }}>
            {t('login.subtitle')}
          </motion.p>

          {/* error */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: -8, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -8, height: 0 }}
                className="mb-5 px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-2 overflow-hidden"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5' }}
              >
                <span>⚠</span> {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* card */}
          <motion.div custom={2} variants={fadeUp} initial="hidden" animate="visible"
            className="rounded-2xl p-7"
            style={{
              background: 'rgba(17,24,39,0.55)',
              border: '1px solid rgba(255,255,255,0.06)',
              backdropFilter: 'blur(20px)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            }}>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* email */}
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider mb-2 block"
                  style={{ color: 'rgba(209,213,219,0.4)' }}>{t('login.email')}</label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2"
                    style={{ color: 'rgba(209,213,219,0.25)' }} />
                  <input
                    type="email" required value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="you@example.com"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm text-white placeholder:text-white/20 outline-none transition-all duration-200 focus:ring-1"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      focusRingColor: '#14B8A6',
                    }}
                    onFocus={(e) => { e.target.style.borderColor = 'rgba(20,184,166,0.4)'; e.target.style.boxShadow = '0 0 0 2px rgba(20,184,166,0.1)'; }}
                    onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none'; }}
                  />
                </div>
              </div>

              {/* password */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[11px] font-semibold uppercase tracking-wider"
                    style={{ color: 'rgba(209,213,219,0.4)' }}>{t('login.password')}</label>
                  <a href="#" className="text-[11px] font-medium hover:underline" style={{ color: '#14B8A6' }}>
                    {t('login.forgotPassword')}
                  </a>
                </div>
                <div className="relative">
                  <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2"
                    style={{ color: 'rgba(209,213,219,0.25)' }} />
                  <input
                    type={showPw ? 'text' : 'password'} required value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-10 py-2.5 rounded-xl text-sm text-white placeholder:text-white/20 outline-none transition-all duration-200"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                    onFocus={(e) => { e.target.style.borderColor = 'rgba(20,184,166,0.4)'; e.target.style.boxShadow = '0 0 0 2px rgba(20,184,166,0.1)'; }}
                    onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none'; }}
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 outline-none"
                    style={{ color: 'rgba(209,213,219,0.3)' }}
                    tabIndex={-1}>
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* submit */}
              <motion.button
                type="submit" disabled={loading}
                whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.985 }}
                className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: 'linear-gradient(135deg, #14B8A6 0%, #0d9488 100%)',
                  color: '#000',
                  boxShadow: '0 2px 12px rgba(20,184,166,0.25)',
                }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <motion.span
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                      className="inline-block w-3.5 h-3.5 border-2 border-black/20 border-t-black rounded-full"
                    />
                    {t('login.loading')}
                  </span>
                ) : t('login.submit')}
              </motion.button>
            </form>
          </motion.div>

          {/* sign up link */}
          <motion.p custom={3} variants={fadeUp} initial="hidden" animate="visible"
            className="text-sm text-center mt-7" style={{ color: 'rgba(209,213,219,0.4)' }}>
            {t('login.noAccount')}{' '}
            <Link to="/signup" className="font-semibold hover:underline" style={{ color: '#14B8A6' }}>
              {t('login.signupLink')}
            </Link>
          </motion.p>

          {/* trust badges (mobile) */}
          <motion.div custom={4} variants={fadeUp} initial="hidden" animate="visible"
            className="lg:hidden flex items-center justify-center gap-5 mt-8">
            {[
              { Icon: Lock, text: 'Secure' },
              { Icon: Zap, text: 'Fast' },
              { Icon: ShieldCheck, text: 'Private' },
            ].map(({ Icon, text }) => (
              <div key={text} className="flex items-center gap-1.5" style={{ color: 'rgba(20,184,166,0.4)' }}>
                <Icon size={12} strokeWidth={1.8} />
                <span className="text-[10px] font-medium">{text}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
