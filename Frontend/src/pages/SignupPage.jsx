import { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { signup } from '../api/api';
import { useTranslation } from '../context/LanguageContext';
import { Lock, Mail, User, Eye, EyeOff, Shield, Zap, ShieldCheck } from 'lucide-react';

/* ── Animation ─────────────────────────────────────────────────────────────── */
const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.45, delay: i * 0.08, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
};

/* ── Floating particles ────────────────────────────────────────────────────── */
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
            background: `rgba(154,177,122,${d.opacity})`,
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
      <div className="absolute inset-0 -m-8 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(195,204,155,0.2) 0%, transparent 70%)' }} />

      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <img src="/SatyaScan_logo_transparent.png" alt="SatyaScan Logo" className="w-24 h-24 object-contain" />
      </motion.div>
    </motion.div>
  );
}

/* ── Password strength ─────────────────────────────────────────────────────── */
function getPasswordStrength(pw) {
  if (!pw) return { level: 0, label: '', color: '' };
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  if (score <= 1) return { level: 20, label: 'Weak', color: '#C62828' };
  if (score === 2) return { level: 40, label: 'Fair', color: '#D87D0A' };
  if (score === 3) return { level: 70, label: 'Good', color: '#768E56' };
  return { level: 100, label: 'Strong', color: '#2E7D32' };
}

/* ── Main ──────────────────────────────────────────────────────────────────── */
export default function SignupPage() {
  const { t } = useTranslation();
  const { saveAuth } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const pwStrength = useMemo(() => getPasswordStrength(form.password), [form.password]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 6) {
      setError(t('signup.passwordShort'));
      return;
    }
    setLoading(true);
    try {
      const { data } = await signup(form.name, form.email, form.password);
      saveAuth(data.token, data.user);
      navigate('/analyze');
    } catch (err) {
      setError(err.response?.data?.message || t('signup.failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#FBE8CE] text-[#232B1B] font-sans">

      {/* ── Left: Form ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">

          {/* mobile logo */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="lg:hidden flex items-center gap-2.5 mb-10">
            <img src="/SatyaScan_logo_transparent.png" alt="SatyaScan Logo" className="h-10 w-auto object-contain" />
            <span className="font-bold text-lg text-[#232B1B]">
              <span>Satya</span><span className="text-[#5C6650] font-medium">Scan</span>
            </span>
          </motion.div>

          <motion.h1 custom={0} variants={fadeUp} initial="hidden" animate="visible"
            className="text-2xl font-bold text-[#232B1B] mb-1">
            {t('signup.title')}
          </motion.h1>
          <motion.p custom={1} variants={fadeUp} initial="hidden" animate="visible"
            className="text-sm mb-8 text-[#5C6650]">
            {t('signup.subtitle')}
          </motion.p>

          {/* error */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: -8, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -8, height: 0 }}
                className="mb-5 px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-2 overflow-hidden bg-red-50 border border-red-200 text-red-800 font-medium"
              >
                <span>⚠</span> {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* card */}
          <motion.div custom={2} variants={fadeUp} initial="hidden" animate="visible"
            className="rounded-2xl p-7 bg-[#E4DFB5] border border-[#C3CC9B] shadow-xl">

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* name */}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider mb-2 block text-[#5C6650]">
                  {t('signup.name')}
                </label>
                <div className="relative">
                  <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5C6650]/60" />
                  <input
                    type="text" required value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Your full name"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm bg-[#FBE8CE] border border-[#C3CC9B] text-[#232B1B] placeholder:text-[#5C6650]/40 outline-none transition-all duration-200"
                    onFocus={(e) => { e.target.style.borderColor = '#5C6650'; e.target.style.boxShadow = '0 0 0 2px rgba(92,102,80,0.1)'; }}
                    onBlur={(e) => { e.target.style.borderColor = '#C3CC9B'; e.target.style.boxShadow = 'none'; }}
                  />
                </div>
              </div>

              {/* email */}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider mb-2 block text-[#5C6650]">
                  {t('signup.email')}
                </label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5C6650]/60" />
                  <input
                    type="email" required value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="you@example.com"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm bg-[#FBE8CE] border border-[#C3CC9B] text-[#232B1B] placeholder:text-[#5C6650]/40 outline-none transition-all duration-200"
                    onFocus={(e) => { e.target.style.borderColor = '#5C6650'; e.target.style.boxShadow = '0 0 0 2px rgba(92,102,80,0.1)'; }}
                    onBlur={(e) => { e.target.style.borderColor = '#C3CC9B'; e.target.style.boxShadow = 'none'; }}
                  />
                </div>
              </div>

              {/* password */}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider mb-2 block text-[#5C6650]">
                  {t('signup.password')}
                </label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5C6650]/60" />
                  <input
                    type={showPw ? 'text' : 'password'} required value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder={t('signup.passwordHint')}
                    className="w-full pl-9 pr-10 py-2.5 rounded-xl text-sm bg-[#FBE8CE] border border-[#C3CC9B] text-[#232B1B] placeholder:text-[#5C6650]/40 outline-none transition-all duration-200"
                    onFocus={(e) => { e.target.style.borderColor = '#5C6650'; e.target.style.boxShadow = '0 0 0 2px rgba(92,102,80,0.1)'; }}
                    onBlur={(e) => { e.target.style.borderColor = '#C3CC9B'; e.target.style.boxShadow = 'none'; }}
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 outline-none text-[#5C6650]/60"
                    tabIndex={-1}>
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>

                {/* strength bar */}
                <div className="mt-2.5">
                  <div className="h-1 rounded-full overflow-hidden bg-[#C3CC9B]">
                    <motion.div
                      className="h-1 rounded-full"
                      style={{ background: pwStrength.color || 'transparent' }}
                      initial={{ width: 0 }}
                      animate={{ width: `${pwStrength.level}%` }}
                      transition={{ duration: 0.35, ease: 'easeOut' }}
                    />
                  </div>
                  <AnimatePresence mode="wait">
                    {form.password && (
                      <motion.p
                        key={pwStrength.label}
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="text-[10px] mt-1.5 font-bold"
                        style={{ color: pwStrength.color }}
                      >
                        {pwStrength.label}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* submit */}
              <motion.button
                type="submit" disabled={loading}
                whileHover={{ scale: 1.015, backgroundColor: '#343F29' }} whileTap={{ scale: 0.985 }}
                className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed bg-[#232B1B] text-[#FBE8CE] shadow-md shadow-[#232B1B]/10"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <motion.span
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                      className="inline-block w-3.5 h-3.5 border-2 border-[#FBE8CE]/20 border-t-[#FBE8CE] rounded-full"
                    />
                    {t('signup.loading')}
                  </span>
                ) : t('signup.submit')}
              </motion.button>
            </form>
          </motion.div>

          {/* login link */}
          <motion.p custom={3} variants={fadeUp} initial="hidden" animate="visible"
            className="text-sm text-center mt-7 text-[#5C6650]" >
            {t('signup.hasAccount')}{' '}
            <Link to="/login" className="font-bold hover:underline text-[#768E56]">
              {t('signup.loginLink')}
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
              <div key={text} className="flex items-center gap-1.5 text-[#5C6650]/80">
                <Icon size={12} strokeWidth={1.8} />
                <span className="text-[10px] font-bold">{text}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* ── Right: Branding ────────────────────────────────────────────── */}
      <div className="hidden lg:flex flex-1 items-center justify-center relative overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #FBE8CE 0%, #E4DFB5 50%, #FBE8CE 100%)' }}>

        <Particles />

        <div className="absolute inset-0"
          style={{ background: 'radial-gradient(ellipse 50% 50% at 50% 45%, rgba(195,204,155,0.2) 0%, transparent 70%)' }} />

        <div className="relative z-10 flex flex-col items-center text-center px-12 max-w-sm">
          <ShieldIllustration />

          <motion.h2
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="text-3xl font-extrabold text-[#232B1B] mt-8 mb-3"
          >
            Join <span>Satya</span><span className="text-[#5C6650] font-medium">Scan</span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ delay: 0.55, duration: 0.5 }}
            className="text-sm leading-relaxed text-[#5C6650]"
          >
            Start verifying facts with AI today.
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
              <div key={text} className="flex items-center gap-1.5 text-[#5C6650]/80">
                <Icon size={13} strokeWidth={1.8} />
                <span className="text-[11px] font-bold">{text}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
