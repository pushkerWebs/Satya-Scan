import { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CircleCheckBig, CircleX, BadgeCheck, TriangleAlert, ShieldQuestion,
  Newspaper, FileText, ShieldCheck, ChevronDown, ChevronUp,
  ExternalLink, ArrowLeft, Share2, Search, Scale, GitCompare,
  AlertTriangle, CheckCircle2, XCircle, Info, Eye, Layers,
  TrendingUp, Clock, Globe, Award, Zap
} from 'lucide-react';
import ShareModal from '../components/ShareModal';
import { useTranslation } from '../context/LanguageContext';

// ─── Verdict config ────────────────────────────────────────────────────────────

const VERDICT_CONFIG = {
  Supported:        { color: '#22c55e', bg: '#22c55e12', border: '#22c55e30', Icon: CircleCheckBig,  label: 'Verified',           microcopy: 'Multiple trusted sources independently support this claim.' },
  True:             { color: '#22c55e', bg: '#22c55e12', border: '#22c55e30', Icon: CircleCheckBig,  label: 'Verified',           microcopy: 'Multiple trusted sources independently support this claim.' },
  Contradicted:     { color: '#ef4444', bg: '#ef444412', border: '#ef444430', Icon: CircleX,         label: 'False',              microcopy: 'Reliable evidence from independent sources contradicts this claim.' },
  False:            { color: '#ef4444', bg: '#ef444412', border: '#ef444430', Icon: CircleX,         label: 'False',              microcopy: 'Reliable evidence from independent sources contradicts this claim.' },
  Misleading:       { color: '#f97316', bg: '#f9731612', border: '#f9731630', Icon: TriangleAlert,   label: 'Misleading',         microcopy: 'The claim mixes factual information with misleading context or omits key facts.' },
  PARTIALLY_TRUE:   { color: '#f59e0b', bg: '#f59e0b12', border: '#f59e0b30', Icon: BadgeCheck,      label: 'Partially Verified', microcopy: 'Some parts are supported by evidence, but important context is missing.' },
  Unverified:       { color: '#6b7280', bg: '#6b728012', border: '#6b728030', Icon: ShieldQuestion,  label: "Couldn't Verify",    microcopy: 'There is not enough reliable evidence from trusted sources to verify this claim.' },
  // URL page-type verdicts
  Informational:    { color: '#14B8A6', bg: '#14B8A612', border: '#14B8A630', Icon: Info,            label: 'Official Information', microcopy: 'This is authoritative information from an official or reference source. It is presented as established information, not evaluated as true or false.' },
  Opinion:          { color: '#8b5cf6', bg: '#8b5cf612', border: '#8b5cf630', Icon: FileText,        label: 'Opinion Content',    microcopy: 'This page contains opinion or editorial content. Factual statements within have been verified separately where possible.' },
  // Image verdicts
  AUTHENTIC:           { color: '#22c55e', bg: '#22c55e12', border: '#22c55e30', Icon: CircleCheckBig, label: 'Authentic',          microcopy: 'This image appears to be genuine and unmodified.' },
  LIKELY_AUTHENTIC:    { color: '#5eead4', bg: '#5eead412', border: '#5eead430', Icon: BadgeCheck,     label: 'Likely Authentic',   microcopy: 'This image is probably genuine, with no major signs of manipulation.' },
  AI_GENERATED:        { color: '#ef4444', bg: '#ef444412', border: '#ef444430', Icon: CircleX,        label: 'AI Generated',       microcopy: 'This image was likely created entirely by artificial intelligence.' },
  LIKELY_AI_GENERATED: { color: '#f97316', bg: '#f9731612', border: '#f9731630', Icon: TriangleAlert,  label: 'Likely AI Generated',microcopy: 'This image shows strong signs of being AI-generated.' },
  DEEPFAKE:            { color: '#ef4444', bg: '#ef444412', border: '#ef444430', Icon: CircleX,        label: 'Deepfake Detected',  microcopy: 'This image shows clear signs of deepfake manipulation.' },
  MANIPULATED:         { color: '#ef4444', bg: '#ef444412', border: '#ef444430', Icon: CircleX,        label: 'Manipulated',        microcopy: 'This image has been digitally altered or edited.' },
  INCONCLUSIVE:        { color: '#6b7280', bg: '#6b728012', border: '#6b728030', Icon: ShieldQuestion, label: 'Inconclusive',       microcopy: 'The analysis could not reach a definitive conclusion.' },
};

function getVerdict(v) {
  return VERDICT_CONFIG[v] || { color: '#6b7280', bg: '#6b728012', border: '#6b728030', Icon: ShieldQuestion, label: v || 'Unknown', microcopy: 'Result unclear.' };
}

function getReliabilityColor(score) {
  if (score >= 70) return '#22c55e';
  if (score >= 40) return '#f59e0b';
  return '#ef4444';
}

function scoreToLabel(score) {
  if (score >= 80) return 'Strong';
  if (score >= 60) return 'Moderate';
  if (score >= 40) return 'Weak';
  return 'Very Weak';
}

function qualityLabel(score) {
  if (score >= 80) return 'High';
  if (score >= 60) return 'Moderate';
  if (score >= 40) return 'Low';
  return 'Very Low';
}

function splitReasoning(text) {
  if (!text) return [];
  if (Array.isArray(text)) {
    return text.map(s => String(s).trim()).filter(s => s.length > 5).slice(0, 5);
  }
  return String(text)
    .split(/(?<=[.!?])\s+|\n+/)
    .map(s => s.replace(/^[-•*]\s*/, '').trim())
    .filter(s => s.length > 5)
    .slice(0, 5);
}

function getDomain(url) {
  try { return new URL(url || '').hostname.replace(/^www\./, ''); }
  catch { return ''; }
}

// Trusted publisher detection
const TIER1_PUBLISHERS = ['reuters', 'bbc', 'apnews', 'ap.org', 'pib.gov', 'who.int', 'cdc.gov', 'nih.gov', 'gov.in'];
const TIER2_PUBLISHERS = ['ndtv', 'thehindu', 'indianexpress', 'theguardian', 'nytimes', 'washingtonpost', 'economist', 'bloomberg', 'ft.com', 'forbes', 'cnbc', 'abc', 'cbs', 'nbc'];

function publisherReliability(src) {
  const s = (src.source || src.url || '').toLowerCase();
  if (TIER1_PUBLISHERS.some(k => s.includes(k))) return { label: 'Highly Trusted', color: '#22c55e', tier: 1, reason: 'International wire service or official government source' };
  if (TIER2_PUBLISHERS.some(k => s.includes(k))) return { label: 'Trusted', color: '#22c55e', tier: 2, reason: 'Established national publication with editorial standards' };
  if (src.trusted) return { label: 'Verified', color: '#22c55e', tier: 3, reason: 'Source passed reliability checks' };
  return { label: 'Moderate', color: '#f59e0b', tier: 4, reason: 'Source reliability not independently confirmed' };
}

function getMissingContextText(verdict, reasoning) {
  const bullets = splitReasoning(reasoning);
  if (verdict === 'Misleading' || verdict === 'PARTIALLY_TRUE') {
    const contextHints = [
      'The claim is technically accurate but omits critical surrounding context that changes its meaning.',
      'Important time-frame details, qualifications, or conditions are absent from this claim.',
      'The statistic or fact cited is real, but applies to a different context than implied.',
    ];
    return bullets.length > 2 ? bullets.slice(2) : contextHints;
  }
  return null;
}

function getConfidenceExplanation(score, verdict, trustedCount, totalSources) {
  const level = score >= 80 ? 'High' : score >= 60 ? 'Moderate' : score >= 40 ? 'Low' : 'Very Low';
  const reasons = [];

  if (trustedCount >= 3) reasons.push('Multiple independent trusted publications agree');
  else if (trustedCount >= 1) reasons.push('At least one trusted publication found');
  else reasons.push('No established trusted publications found');

  if (totalSources >= 5) reasons.push('Wide evidence base across many sources');
  else if (totalSources >= 2) reasons.push('Evidence found from multiple sources');
  else reasons.push('Limited evidence sources available');

  if (verdict === 'Supported' || verdict === 'True') reasons.push('No credible contradictions detected');
  else if (verdict === 'Contradicted' || verdict === 'False') reasons.push('Credible sources actively contradict this claim');
  else if (verdict === 'Misleading') reasons.push('Context gaps or selective framing detected');

  if (score >= 70) reasons.push('Evidence is from recent, verifiable publications');

  return { level, reasons };
}

// ─── Logo ──────────────────────────────────────────────────────────────────────

function SatyaScanLogo() {
  return (
    <div className="flex items-center gap-2">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #14B8A6, #5eead4)' }}>
        <ShieldCheck size={15} className="text-black" strokeWidth={2.5} />
      </div>
      <span className="font-bold text-[15px] tracking-tight text-white">
        <span style={{ color: '#14B8A6' }}>Satya</span>Scan
      </span>
    </div>
  );
}

// ─── Reliability Ring ─────────────────────────────────────────────────────────

function ReliabilityRing({ score }) {
  const color = getReliabilityColor(score);
  const r = 38;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;

  return (
    <div className="relative w-24 h-24 flex-shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 88 88">
        <circle cx="44" cy="44" r={r} fill="none" stroke="#1e2433" strokeWidth="7" />
        <motion.circle
          cx="44" cy="44" r={r}
          fill="none" stroke={color} strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.3, ease: [0.4, 0, 0.2, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black text-white leading-none">{score}</span>
        <span className="text-[9px] text-white/40 mt-0.5">/ 100</span>
      </div>
    </div>
  );
}

// ─── Animated Bar ─────────────────────────────────────────────────────────────

function AnimatedBar({ value, color, height = 6 }) {
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ height, background: '#1a2030' }}>
      <motion.div
        className="h-full rounded-full"
        style={{ background: color }}
        initial={{ width: 0 }}
        animate={{ width: `${value}%` }}
        transition={{ duration: 1, ease: [0.4, 0, 0.2, 1] }}
      />
    </div>
  );
}

// ─── Page Type Banner (shown for non-news URL inputs) ─────────────────────────

const PAGE_TYPE_CONFIG = {
  official:     { Icon: Award,     color: '#14B8A6', bg: 'rgba(20,184,166,0.06)',  border: 'rgba(20,184,166,0.2)',  reportLabel: 'Official Information Report' },
  reference:    { Icon: Info,      color: '#3b82f6', bg: 'rgba(59,130,246,0.06)',  border: 'rgba(59,130,246,0.2)',  reportLabel: 'Reference Information Report' },
  opinion:      { Icon: FileText,  color: '#8b5cf6', bg: 'rgba(139,92,246,0.06)', border: 'rgba(139,92,246,0.2)', reportLabel: 'Opinion Content Analysis' },
  social_media: { Icon: Globe,     color: '#f59e0b', bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.2)', reportLabel: 'Social Media Fact-Check' },
};

function PageTypeBanner({ pageType, pageTypeLabel, pageTypeDescription }) {
  const cfg = PAGE_TYPE_CONFIG[pageType];
  if (!cfg) return null;
  const { Icon, color, bg, border } = cfg;
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex items-start gap-3 px-4 py-3.5 rounded-xl"
      style={{ background: bg, border: `1px solid ${border}` }}
    >
      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
        style={{ background: color + '18', border: `1px solid ${color}30` }}>
        <Icon size={13} style={{ color }} strokeWidth={2} />
      </div>
      <div>
        <p className="text-xs font-bold mb-0.5" style={{ color }}>{pageTypeLabel}</p>
        <p className="text-[11px] text-white/45 leading-relaxed">{pageTypeDescription}</p>
      </div>
    </motion.div>
  );
}

function SectionHeading({ icon: Icon, children, iconColor, badge }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-white/80">
        <Icon size={15} style={{ color: iconColor || '#14B8A6' }} strokeWidth={2} />
        {children}
      </h2>
      {badge && (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(20,184,166,0.1)', color: '#14B8A6', border: '1px solid rgba(20,184,166,0.2)' }}>
          {badge}
        </span>
      )}
    </div>
  );
}

// ─── How We Verified — Transparent Pipeline ───────────────────────────────────

const PIPELINE_STEPS = [
  { icon: FileText,   label: 'Claim Submitted',           desc: 'Your input is received and parsed for verifiable claims' },
  { icon: Search,     label: 'Claims Extracted',           desc: 'Individual factual assertions are identified and isolated' },
  { icon: Globe,      label: 'Trusted Sources Retrieved',  desc: 'Relevant articles pulled from verified publication databases' },
  { icon: GitCompare, label: 'Cross-Source Comparison',    desc: 'Claims matched against retrieved evidence across all sources' },
  { icon: AlertTriangle, label: 'Contradictions Detected', desc: 'Conflicting reports identified and flagged for review' },
  { icon: Scale,      label: 'Evidence Weighted',          desc: 'Sources scored by publisher trust tier and publication recency' },
  { icon: ShieldCheck,label: 'Final Verdict Issued',       desc: 'Independent conclusion drawn from the full evidence body' },
];

function HowWeVerified() {
  const [open, setOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="rounded-2xl overflow-hidden"
      style={{ background: '#0e1117', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2">
          <Eye size={15} style={{ color: '#14B8A6' }} strokeWidth={2} />
          <span className="text-sm font-semibold text-white/80">How We Verified This</span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full ml-1"
            style={{ background: 'rgba(20,184,166,0.1)', color: '#14B8A6', border: '1px solid rgba(20,184,166,0.2)' }}>
            Transparent Methodology
          </span>
        </div>
        {open
          ? <ChevronUp size={14} className="text-white/30" />
          : <ChevronDown size={14} className="text-white/30" />}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="pipeline"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div className="px-5 pb-5 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <p className="text-xs text-white/35 mb-4 leading-relaxed">
                SatyaScan uses a multi-stage evidence pipeline — not a single AI response. Every verdict is built on independently retrieved sources.
              </p>
              <div className="relative">
                {/* Vertical connector line */}
                <div className="absolute left-[17px] top-4 bottom-4 w-px"
                  style={{ background: 'linear-gradient(to bottom, #14B8A640, #14B8A610)' }} />

                <div className="space-y-0">
                  {PIPELINE_STEPS.map((step, i) => {
                    const Icon = step.icon;
                    const isLast = i === PIPELINE_STEPS.length - 1;
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.04 * i }}
                        className="flex items-start gap-3 relative"
                        style={{ paddingBottom: isLast ? 0 : '12px' }}
                      >
                        {/* Step node */}
                        <div className="w-[34px] h-[34px] rounded-full flex items-center justify-center shrink-0 z-10"
                          style={{
                            background: isLast ? 'rgba(20,184,166,0.15)' : '#0e1117',
                            border: `1px solid ${isLast ? '#14B8A6' : 'rgba(20,184,166,0.3)'}`,
                          }}>
                          <Icon size={13} style={{ color: isLast ? '#14B8A6' : '#14B8A680' }} strokeWidth={2} />
                        </div>
                        <div className="flex-1 pt-0.5 pb-1">
                          <p className={`text-xs font-semibold mb-0.5 ${isLast ? 'text-[#14B8A6]' : 'text-white/70'}`}>
                            {step.label}
                          </p>
                          <p className="text-[11px] text-white/30 leading-relaxed">{step.desc}</p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Evidence Consensus ───────────────────────────────────────────────────────

function PublisherPill({ name, tier }) {
  const colors = {
    1: { bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.25)', text: '#22c55e' },
    2: { bg: 'rgba(34,197,94,0.07)', border: 'rgba(34,197,94,0.18)', text: '#4ade80' },
    3: { bg: 'rgba(20,184,166,0.08)', border: 'rgba(20,184,166,0.2)', text: '#14B8A6' },
    4: { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)', text: '#f59e0b' },
  };
  const style = colors[tier] || colors[4];
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full"
      style={{ background: style.bg, border: `1px solid ${style.border}`, color: style.text }}>
      {tier <= 2 && <CheckCircle2 size={9} strokeWidth={2.5} />}
      {name}
    </span>
  );
}

function EvidenceConsensus({ claims }) {
  const allSrc = claims.flatMap(c => c.sources || []);
  const seenUrls = new Set();
  const unique = allSrc.filter(s => {
    const key = s.url || s.title || '';
    if (!key || seenUrls.has(key)) return false;
    seenUrls.add(key); return true;
  });

  // Split: trusted → supporting; untrusted → uncertain
  const supporting = unique.filter(s => s.trusted || TIER1_PUBLISHERS.some(k => (s.source || s.url || '').toLowerCase().includes(k)) || TIER2_PUBLISHERS.some(k => (s.source || s.url || '').toLowerCase().includes(k)));
  const uncertain = unique.filter(s => !supporting.includes(s));

  if (unique.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="rounded-2xl p-5"
      style={{ background: '#0e1117', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <SectionHeading icon={Layers} badge={`${unique.length} sources`}>Evidence Consensus</SectionHeading>
      <p className="text-[11px] text-white/30 mb-4 leading-relaxed">
        See at a glance whether trusted, independent publications agree or disagree with this claim.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Supporting */}
        <div className="rounded-xl p-4" style={{ background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.12)' }}>
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 size={13} style={{ color: '#22c55e' }} strokeWidth={2.5} />
            <span className="text-xs font-bold" style={{ color: '#22c55e' }}>
              Supporting ({supporting.length})
            </span>
          </div>
          {supporting.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {supporting.slice(0, 8).map((s, i) => {
                const pub = publisherReliability(s);
                const name = s.source || getDomain(s.url) || 'Source';
                return <PublisherPill key={i} name={name} tier={pub.tier} />;
              })}
            </div>
          ) : (
            <p className="text-[11px] text-white/25 italic">No established trusted publications found</p>
          )}
        </div>

        {/* Uncertain / low-trust */}
        <div className="rounded-xl p-4" style={{ background: 'rgba(107,114,128,0.04)', border: '1px solid rgba(107,114,128,0.12)' }}>
          <div className="flex items-center gap-2 mb-3">
            <ShieldQuestion size={13} className="text-white/30" strokeWidth={2} />
            <span className="text-xs font-bold text-white/40">
              Unverified Sources ({uncertain.length})
            </span>
          </div>
          {uncertain.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {uncertain.slice(0, 8).map((s, i) => {
                const pub = publisherReliability(s);
                const name = s.source || getDomain(s.url) || 'Unknown';
                return <PublisherPill key={i} name={name} tier={pub.tier} />;
              })}
            </div>
          ) : (
            <p className="text-[11px] text-white/25 italic">All retrieved sources passed trust checks</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Can I Trust This? Card ───────────────────────────────────────────────────

function TrustCard({ score, verdict, trustedCount, totalSources }) {
  const { level, reasons } = getConfidenceExplanation(score, verdict, trustedCount, totalSources);
  const isHigh = score >= 70;
  const isMed = score >= 40 && score < 70;
  const color = getReliabilityColor(score);
  const bgColor = isHigh ? 'rgba(34,197,94,0.05)' : isMed ? 'rgba(245,158,11,0.05)' : 'rgba(239,68,68,0.05)';
  const borderColor = isHigh ? 'rgba(34,197,94,0.15)' : isMed ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)';
  const TrustIcon = isHigh ? Award : isMed ? BadgeCheck : AlertTriangle;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
      className="rounded-2xl p-5"
      style={{ background: bgColor, border: `1px solid ${borderColor}` }}
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
          style={{ background: color + '15', border: `1px solid ${color}30` }}>
          <TrustIcon size={18} style={{ color }} strokeWidth={2} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-bold text-white/90">Can I trust this result?</h3>
          </div>
          <p className="text-base font-black mb-2.5" style={{ color }}>
            {level} Reliability
          </p>
          <ul className="space-y-1.5">
            {reasons.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-white/55 leading-relaxed">
                <span className="mt-0.5 shrink-0" style={{ color: color, fontSize: 10 }}>
                  {isHigh ? '✓' : isMed ? '◦' : '✕'}
                </span>
                {r}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Missing Context Section ──────────────────────────────────────────────────

function MissingContext({ verdict, reasoning }) {
  const contextPoints = getMissingContextText(verdict, reasoning);
  if (!contextPoints || contextPoints.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.22 }}
      className="rounded-2xl p-5"
      style={{ background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.18)' }}
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
          style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)' }}>
          <Info size={14} style={{ color: '#f59e0b' }} strokeWidth={2} />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-bold text-amber-300 mb-1">Important Context Missing</h3>
          <p className="text-xs text-white/45 mb-3 leading-relaxed">
            This claim leaves out important facts that change how it should be understood.
          </p>
          <ul className="space-y-2">
            {contextPoints.slice(0, 3).map((pt, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-white/60 leading-relaxed">
                <span className="mt-0.5 shrink-0 text-amber-400" style={{ fontSize: 10 }}>◈</span>
                {pt}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Confidence Explanation ───────────────────────────────────────────────────

function ConfidenceExplainer({ score, verdict, trustedCount, totalSources }) {
  const { level, reasons } = getConfidenceExplanation(score, verdict, trustedCount, totalSources);
  const color = getReliabilityColor(score);

  return (
    <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold text-white/30 uppercase tracking-widest">Confidence Explained</span>
        <span className="text-sm font-black" style={{ color }}>{level} ({score}%)</span>
      </div>
      <AnimatedBar value={score} color={color} height={5} />
      <div className="mt-3 space-y-1.5">
        {reasons.slice(0, 3).map((r, i) => (
          <div key={i} className="flex items-start gap-2 text-[11px] text-white/45 leading-relaxed">
            <span style={{ color, fontSize: 9, marginTop: 3, flexShrink: 0 }}>▸</span>
            {r}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Enriched Source Card ─────────────────────────────────────────────────────

function SourceCard({ src, index }) {
  const domain = getDomain(src.url);
  const pub = publisherReliability(src);
  const displayName = src.source || domain || 'Trusted Source';

  return (
    <motion.a
      href={src.url || '#'}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 * index }}
      className="group block bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] hover:border-[#14B8A6]/30 rounded-xl p-4 transition-all duration-200 cursor-pointer no-underline"
      onClick={e => { if (!src.url) e.preventDefault(); }}
    >
      <div className="flex items-start gap-3">
        {/* Publisher icon */}
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: '#1a2030', border: '1px solid rgba(255,255,255,0.08)' }}>
          <Newspaper size={14} style={{ color: '#14B8A6' }} />
        </div>
        <div className="flex-1 min-w-0">
          {/* Publisher name + trust badge */}
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-white/70 truncate">{displayName}</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
              style={{ background: pub.color + '18', color: pub.color }}>
              {pub.label}
            </span>
          </div>
          {/* Why trusted */}
          <p className="text-[10px] text-white/25 mb-1.5 leading-snug">{pub.reason}</p>
          {/* Article title */}
          <p className="text-sm font-medium text-white/85 leading-snug line-clamp-2 group-hover:text-white transition-colors">
            {src.title || 'Untitled article'}
          </p>
          {/* Open link */}
          {src.url && (
            <div className="flex items-center gap-1 mt-2">
              <span className="text-[10px] text-white/25 group-hover:text-[#14B8A6] transition-colors font-medium">Open article</span>
              <ExternalLink size={9} className="text-white/20 group-hover:text-[#14B8A6] transition-colors" />
            </div>
          )}
        </div>
      </div>
    </motion.a>
  );
}

// ─── Claim Card ──────────────────────────────────────────────────────────────

function ClaimCard({ claim, index }) {
  const [open, setOpen] = useState(false);
  const cfg = getVerdict(claim.verdict);
  const { Icon } = cfg;
  const bullets = splitReasoning(claim.reasoning);
  const trustedCount = claim.sources ? claim.sources.filter(s => publisherReliability(s).tier <= 2).length : 0;
  const totalSources = claim.sources?.length || 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 * index }}
      className="rounded-xl border overflow-hidden"
      style={{ borderColor: cfg.border, background: '#0e1117' }}
    >
      {/* Header row */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-start gap-3 p-4 text-left transition-colors hover:bg-white/[0.02]"
      >
        <Icon size={17} style={{ color: cfg.color, marginTop: 2, flexShrink: 0 }} strokeWidth={2} />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white/80 leading-relaxed line-clamp-2">
            {claim.text}
          </p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0 mt-0.5">
          <span className="text-xs font-bold px-2.5 py-1 rounded-full"
            style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
            {cfg.label}
          </span>
          {open
            ? <ChevronUp size={14} className="text-white/30" />
            : <ChevronDown size={14} className="text-white/30" />}
        </div>
      </button>

      {/* Expanded body */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div className="border-t px-5 pb-5 pt-4 space-y-4"
              style={{ borderColor: cfg.border + '60', background: '#080c12' }}>

              {/* Confidence explained */}
              {typeof claim.confidence === 'number' && (
                <ConfidenceExplainer
                  score={claim.confidence}
                  verdict={claim.verdict}
                  trustedCount={trustedCount}
                  totalSources={totalSources}
                />
              )}

              {/* Why we reached this */}
              {bullets.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-white/30 uppercase tracking-widest mb-2.5">
                    Evidence reasoning
                  </p>
                  <ul className="space-y-2">
                    {bullets.map((b, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-white/65 leading-relaxed">
                        <span style={{ color: '#14B8A6', marginTop: 3, flexShrink: 0, fontSize: 11 }}>✓</span>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Sources inside claim */}
              {claim.sources && claim.sources.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-white/30 uppercase tracking-widest mb-2.5">
                    Sources checked ({claim.sources.length})
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {claim.sources.slice(0, 4).map((src, i) => (
                      <SourceCard key={i} src={src} index={i} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ResultsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [showShare, setShowShare] = useState(false);

  const result = location.state?.result;

  if (!result) {
    return (
      <div className="min-h-screen bg-[#080c12] flex flex-col items-center justify-center gap-4 text-center px-4">
        <ShieldQuestion size={40} className="text-white/20" />
        <p className="text-white/50 text-sm">No results to display. Please run an analysis first.</p>
        <Link to="/analyze" className="ss-btn-primary text-sm px-5 py-2">← Back to Analyze</Link>
      </div>
    );
  }

  const {
    inputType, trustScore, aiLikelihood, aiScore, aiReasoning,
    sourceCredibility, detectedLanguage,
    claims = [], checkId, apiWorking,
    // URL classification (only present for URL inputs)
    pageType, pageTypeLabel, pageTypeDescription, pageVerdict,
    // image
    verdict: imgVerdict, confidence: imgConf,
    aiProbability, deepfakeProbability, manipulationProbability,
    metadataIntegrity, findings = [], summary: imgSummary,
  } = result;

  const isImage = inputType === 'image';
  const isSpecialUrlType = !isImage && pageType && pageType !== 'news';

  // Determine overall verdict
  // pageVerdict (from backend URL classification) takes priority for official/reference/opinion pages.
  // For all other inputs, derive from trustScore as before.
  const rawVerdict = isImage
    ? imgVerdict
    : (pageVerdict || (trustScore >= 70 ? 'Supported' : trustScore >= 40 ? 'Misleading' : 'Contradicted'));
  const cfg = getVerdict(rawVerdict);
  const { Icon: VerdictIcon } = cfg;

  const displayScore = isImage ? Math.round(imgConf ?? 50) : Math.round(trustScore ?? 50);
  const reliabilityColor = getReliabilityColor(displayScore);

  // Stats
  const supported    = claims.filter(c => ['Supported', 'True'].includes(c.verdict)).length;
  const contradicted = claims.filter(c => ['Contradicted', 'False', 'Misleading'].includes(c.verdict)).length;
  const unverified   = claims.length - supported - contradicted;

  // Summary sentence
  const summaryBullets = splitReasoning(aiReasoning || imgSummary || '');
  const firstSummary = summaryBullets[0] || cfg.microcopy;

  // Unique sources across all claims
  const allSrc = claims.flatMap(c => c.sources || []);
  const seenUrls = new Set();
  const uniqueSources = allSrc.filter(s => {
    const key = s.url || s.title || '';
    if (!key || seenUrls.has(key)) return false;
    seenUrls.add(key);
    return true;
  }).slice(0, 8);

  // Global trust metrics
  const allTrustedCount = uniqueSources.filter(s => publisherReliability(s).tier <= 2).length;
  const totalSourceCount = uniqueSources.length;

  // Metrics
  const evidenceStrength = scoreToLabel(Math.round(sourceCredibility ?? 0));

  // Show misleading context?
  const showMissingContext = ['Misleading', 'PARTIALLY_TRUE'].includes(rawVerdict) && !isImage;

  return (
    <div className="min-h-screen text-white" style={{ background: '#080c12', fontFamily: "'Inter', sans-serif" }}>

      {/* ── Topbar ──────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-40 flex items-center justify-between px-5 py-3.5"
        style={{ background: 'rgba(8,12,18,0.9)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/analyze')}
            className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors font-medium">
            <ArrowLeft size={14} />
            New Analysis
          </button>
          <span className="text-white/15">|</span>
          <SatyaScanLogo />
        </div>
        <div className="flex items-center gap-2">
          {/* Evidence-first tagline */}
          <span className="hidden sm:flex items-center gap-1.5 text-[10px] font-medium text-white/20">
            <ShieldCheck size={10} style={{ color: '#14B8A6' }} />
            Independent Verification
          </span>
          {checkId && (
            <button onClick={() => setShowShare(true)}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
              style={{ background: 'rgba(20,184,166,0.12)', color: '#14B8A6', border: '1px solid rgba(20,184,166,0.2)' }}>
              <Share2 size={12} />
              Share
            </button>
          )}
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-5">

        {/* API degraded warning */}
        {apiWorking === false && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex items-start gap-3 px-4 py-3 rounded-xl text-sm"
            style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
            <TriangleAlert size={16} className="text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-300">Limited analysis — evidence retrieval running in fallback mode</p>
              <p className="text-amber-400/60 text-xs mt-0.5">Results are based on partial evidence only. Manual verification is recommended.</p>
            </div>
          </motion.div>
        )}

        {/* ── PAGE TYPE BANNER (non-news URL inputs only) ─────────────────── */}
        {isSpecialUrlType && (
          <PageTypeBanner
            pageType={pageType}
            pageTypeLabel={pageTypeLabel}
            pageTypeDescription={pageTypeDescription}
          />
        )}

        {/* ── HERO CARD ─────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="rounded-2xl overflow-hidden"
          style={{ background: '#0e1117', border: `1px solid ${cfg.border}` }}
        >
          {/* Top status bar */}
          <div className="h-[3px] w-full" style={{ background: `linear-gradient(90deg, ${cfg.color}80, ${cfg.color}20)` }} />

          <div className="p-6">
            {/* Verdict row */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                {/* Label above */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">
                    {isImage ? 'Image Authenticity Report'
                    : inputType === 'url'
                      ? (PAGE_TYPE_CONFIG[pageType]?.reportLabel || 'URL Verification Report')
                      : 'Fact-Check Report'}
                  </span>
                  {detectedLanguage && detectedLanguage !== 'unknown' && detectedLanguage !== 'en' && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                      style={{ background: '#14B8A6' + '15', color: '#14B8A6', border: '1px solid #14B8A6' + '25' }}>
                      {detectedLanguage.toUpperCase()}
                    </span>
                  )}
                </div>

                {/* Main verdict */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-xl" style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                    <VerdictIcon size={22} style={{ color: cfg.color }} strokeWidth={2} />
                  </div>
                  <div>
                    <h1 className="text-3xl font-black leading-none tracking-tight" style={{ color: cfg.color }}>
                      {cfg.label}
                    </h1>
                  </div>
                </div>

                {/* Microcopy */}
                <p className="text-sm text-white/55 leading-relaxed mb-4 max-w-lg">{cfg.microcopy}</p>

                {/* Verification Summary */}
                {firstSummary && (
                  <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="flex items-start gap-2.5">
                      <ShieldCheck size={13} style={{ color: '#14B8A6', marginTop: 3, flexShrink: 0 }} />
                      <p className="text-sm text-white/75 leading-relaxed">
                        <span className="font-semibold text-white/90">Verification Summary — </span>
                        {firstSummary}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Score ring */}
              <div className="flex flex-col items-center gap-1.5 shrink-0">
                <ReliabilityRing score={displayScore} />
                <p className="text-[10px] text-white/30 text-center leading-tight">
                  Overall<br/>Reliability
                </p>
              </div>
            </div>

            {/* Claim stat pills */}
            {!isImage && claims.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                {supported > 0 && (
                  <span className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full"
                    style={{ background: '#22c55e12', color: '#22c55e', border: '1px solid #22c55e25' }}>
                    <CircleCheckBig size={11} strokeWidth={2.5} />
                    {supported} evidence-supported
                  </span>
                )}
                {contradicted > 0 && (
                  <span className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full"
                    style={{ background: '#ef444412', color: '#ef4444', border: '1px solid #ef444425' }}>
                    <CircleX size={11} strokeWidth={2.5} />
                    {contradicted} disputed by sources
                  </span>
                )}
                {unverified > 0 && (
                  <span className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full"
                    style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <ShieldQuestion size={11} strokeWidth={2} />
                    {unverified} insufficient evidence
                  </span>
                )}
                {totalSourceCount > 0 && (
                  <span className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full"
                    style={{ background: 'rgba(20,184,166,0.06)', color: '#14B8A6', border: '1px solid rgba(20,184,166,0.15)' }}>
                    <Globe size={11} strokeWidth={2} />
                    {totalSourceCount} sources checked
                  </span>
                )}
              </div>
            )}
          </div>
        </motion.div>

        {/* ── CAN I TRUST THIS? ──────────────────────────────────────────────── */}
        {!isImage && rawVerdict !== 'Informational' && (
          <TrustCard
            score={displayScore}
            verdict={rawVerdict}
            trustedCount={allTrustedCount}
            totalSources={totalSourceCount}
          />
        )}

        {/* ── MISSING CONTEXT ────────────────────────────────────────────────── */}
        {showMissingContext && (
          <MissingContext verdict={rawVerdict} reasoning={aiReasoning} />
        )}

        {/* ── HOW WE VERIFIED ───────────────────────────────────────────────── */}
        <HowWeVerified />

        {/* ── VERIFICATION DETAILS ─────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="rounded-2xl p-5"
          style={{ background: '#0e1117', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <SectionHeading icon={TrendingUp}>Evidence Analysis Metrics</SectionHeading>

          {isImage ? (
            <div className="space-y-4">
              {[
                { label: 'AI Generated Probability', value: aiProbability ?? 0, inverse: true },
                { label: 'Deepfake Probability', value: deepfakeProbability ?? 0, inverse: true },
                { label: 'Manipulation Probability', value: manipulationProbability ?? 0, inverse: true },
              ].map(({ label, value, inverse }) => {
                const color = inverse ? (value > 50 ? '#ef4444' : '#22c55e') : getReliabilityColor(value);
                return (
                  <div key={label}>
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="text-white/55 font-medium">{label}</span>
                      <span className="font-bold" style={{ color }}>
                        {value > 70 ? 'High' : value > 40 ? 'Moderate' : 'Low'} ({value}%)
                      </span>
                    </div>
                    <AnimatedBar value={value} color={color} />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Source credibility bar */}
              <div>
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-white/55 font-medium">Source Credibility</span>
                  <span className="font-bold" style={{ color: getReliabilityColor(sourceCredibility ?? 0) }}>
                    {evidenceStrength} ({Math.round(sourceCredibility ?? 0)}%)
                  </span>
                </div>
                <AnimatedBar value={sourceCredibility ?? 0} color={getReliabilityColor(sourceCredibility ?? 0)} />
                <p className="text-[10px] text-white/25 mt-1">
                  Based on publisher trust tier and editorial standards of retrieved sources
                </p>
              </div>

              {/* Overall confidence */}
              <ConfidenceExplainer
                score={displayScore}
                verdict={rawVerdict}
                trustedCount={allTrustedCount}
                totalSources={totalSourceCount}
              />

              {/* Trusted source ratio */}
              {totalSourceCount > 0 && (
                <div className="flex items-center gap-3 text-xs text-white/40">
                  <ShieldCheck size={12} style={{ color: '#14B8A6' }} />
                  <span>
                    <span className="font-bold text-white/70">{allTrustedCount}</span> of{' '}
                    <span className="font-bold text-white/70">{totalSourceCount}</span> sources are from verified publishers
                  </span>
                </div>
              )}
            </div>
          )}
        </motion.div>

        {/* ── IMAGE METADATA ────────────────────────────────────────────────── */}
        {isImage && (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            {/* Metadata status */}
            <div className="rounded-2xl p-5" style={{ background: '#0e1117', border: '1px solid rgba(255,255,255,0.07)' }}>
              <SectionHeading icon={ShieldCheck}>Metadata Status</SectionHeading>
              {(() => {
                const intact = metadataIntegrity === 'INTACT';
                const stripped = metadataIntegrity === 'STRIPPED';
                const mColor = intact ? '#22c55e' : stripped ? '#f59e0b' : '#ef4444';
                const mLabel = intact ? 'Original & Intact' : stripped ? 'Metadata Removed' : 'Suspicious';
                return (
                  <>
                    <p className="text-lg font-bold mb-1.5" style={{ color: mColor }}>{mLabel}</p>
                    <p className="text-xs text-white/45 leading-relaxed">
                      {intact
                        ? 'The image retains its original camera data — a strong sign of authenticity.'
                        : stripped
                        ? 'Metadata was removed. Common on social media, but can sometimes indicate editing.'
                        : 'Modified metadata was detected, which may indicate tampering.'}
                    </p>
                  </>
                );
              })()}
            </div>

            {/* Findings */}
            {findings.length > 0 && (
              <div className="rounded-2xl p-5" style={{ background: '#0e1117', border: '1px solid rgba(20,184,166,0.15)' }}>
                <SectionHeading icon={FileText}>What We Found</SectionHeading>
                <ul className="space-y-2">
                  {findings.slice(0, 5).map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-white/65 leading-relaxed">
                      <span style={{ color: '#14B8A6', marginTop: 4, fontSize: 10, flexShrink: 0 }}>✓</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </motion.div>
        )}

        {/* ── WHY WE REACHED THIS CONCLUSION ───────────────────────────────── */}
        {!isImage && summaryBullets.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
            className="rounded-2xl p-5"
            style={{ background: '#0e1117', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <SectionHeading icon={FileText}>Why We Reached This Conclusion</SectionHeading>
            <p className="text-[11px] text-white/30 mb-3 leading-relaxed">
              These conclusions are derived from cross-referencing evidence across independent sources — not from a single AI response.
            </p>
            <ul className="space-y-3">
              {summaryBullets.map((b, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-white/65 leading-relaxed">
                  <span className="mt-0.5 shrink-0 flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold"
                    style={{ background: '#14B8A6' + '20', color: '#14B8A6' }}>✓</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        )}

        {/* Image summary */}
        {isImage && imgSummary && (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22 }}
            className="rounded-2xl p-5"
            style={{ background: '#0e1117', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <SectionHeading icon={FileText}>Analysis Summary</SectionHeading>
            <p className="text-sm text-white/65 leading-relaxed">{imgSummary}</p>
          </motion.div>
        )}

        {/* ── EVIDENCE CONSENSUS ────────────────────────────────────────────── */}
        {!isImage && claims.length > 0 && (
          <EvidenceConsensus claims={claims} />
        )}

        {/* ── CLAIM BY CLAIM ────────────────────────────────────────────────── */}
        {!isImage && claims.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22 }}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-white/80">
                <BadgeCheck size={15} style={{ color: '#14B8A6' }} strokeWidth={2} />
                Claim-by-Claim Breakdown
              </h2>
              <span className="text-[11px] text-white/25 font-medium">Tap any claim to see evidence</span>
            </div>
            <div className="space-y-2.5">
              {claims.map((claim, i) => <ClaimCard key={i} claim={claim} index={i} />)}
            </div>
          </motion.div>
        )}



        {/* ── FOOTER NOTE ───────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
          className="rounded-2xl p-5 text-center"
          style={{ background: 'rgba(20,184,166,0.03)', border: '1px solid rgba(20,184,166,0.08)' }}
        >
          <ShieldCheck size={18} style={{ color: '#14B8A6', margin: '0 auto 10px' }} strokeWidth={1.5} />
          <p className="text-xs font-semibold text-white/50 mb-1">Evidence-Based Verification</p>
          <p className="text-[11px] text-white/25 leading-relaxed max-w-sm mx-auto">
            SatyaScan verifies claims through independent source retrieval and cross-reference analysis.
            You can evaluate every source used in this report.
          </p>
        </motion.div>

      </div>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <div className="mt-6 px-5 py-5 flex items-center justify-between"
        style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <SatyaScanLogo />
        <p className="text-[11px] text-white/15">© 2025 SatyaScan — Independent Verification</p>
      </div>

      {showShare && checkId && (
        <ShareModal checkId={checkId} onClose={() => setShowShare(false)} />
      )}
    </div>
  );
}
