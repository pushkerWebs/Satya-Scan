import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  CircleCheckBig,
  CircleX,
  BadgeCheck,
  TriangleAlert,
  ShieldQuestion,
  ShieldCheck,
  ExternalLink,
  Brain,
  Globe,
  Share2,
  Check,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { getReport } from '../api/api';
import ImageDualAnalysis from '../components/ImageDualAnalysis';
import { useTranslation } from '../context/LanguageContext';

const VERDICT_THEME = {
  Supported: { color: '#2E7D32', bg: 'rgba(46, 125, 50, 0.12)', border: 'rgba(46, 125, 50, 0.25)', Icon: CircleCheckBig, label: 'Verified Claim' },
  True: { color: '#2E7D32', bg: 'rgba(46, 125, 50, 0.12)', border: 'rgba(46, 125, 50, 0.25)', Icon: CircleCheckBig, label: 'Verified Claim' },
  Contradicted: { color: '#C62828', bg: 'rgba(198, 40, 40, 0.12)', border: 'rgba(198, 40, 40, 0.25)', Icon: CircleX, label: 'Contradicted / False' },
  False: { color: '#C62828', bg: 'rgba(198, 40, 40, 0.12)', border: 'rgba(198, 40, 40, 0.25)', Icon: CircleX, label: 'Contradicted / False' },
  Misleading: { color: '#E65100', bg: 'rgba(230, 81, 0, 0.12)', border: 'rgba(230, 81, 0, 0.25)', Icon: TriangleAlert, label: 'Misleading Claim' },
  PARTIALLY_TRUE: { color: '#D87D0A', bg: 'rgba(216, 125, 10, 0.12)', border: 'rgba(216, 125, 10, 0.25)', Icon: BadgeCheck, label: 'Partially Verified' },
  Unverified: { color: '#5C6650', bg: 'rgba(92, 102, 80, 0.12)', border: 'rgba(92, 102, 80, 0.25)', Icon: ShieldQuestion, label: 'Unverified' },
  AUTHENTIC: { color: '#2E7D32', bg: 'rgba(46, 125, 50, 0.12)', border: 'rgba(46, 125, 50, 0.25)', Icon: CircleCheckBig, label: 'Authentic Image' },
  LIKELY_AUTHENTIC: { color: '#00796B', bg: 'rgba(0, 121, 107, 0.12)', border: 'rgba(0, 121, 107, 0.25)', Icon: BadgeCheck, label: 'Likely Authentic Image' },
  AI_GENERATED: { color: '#C62828', bg: 'rgba(198, 40, 40, 0.12)', border: 'rgba(198, 40, 40, 0.25)', Icon: CircleX, label: 'AI-Generated Image' },
  LIKELY_AI_GENERATED: { color: '#E65100', bg: 'rgba(230, 81, 0, 0.12)', border: 'rgba(230, 81, 0, 0.25)', Icon: TriangleAlert, label: 'Likely AI-Generated' },
  DEEPFAKE: { color: '#C62828', bg: 'rgba(198, 40, 40, 0.12)', border: 'rgba(198, 40, 40, 0.25)', Icon: CircleX, label: 'Deepfake Manipulation' },
  MANIPULATED: { color: '#C62828', bg: 'rgba(198, 40, 40, 0.12)', border: 'rgba(198, 40, 40, 0.25)', Icon: CircleX, label: 'Digitally Manipulated' },
  INCONCLUSIVE: { color: '#5C6650', bg: 'rgba(92, 102, 80, 0.12)', border: 'rgba(92, 102, 80, 0.25)', Icon: ShieldQuestion, label: 'Inconclusive' },
};

function getTheme(verdict) {
  return VERDICT_THEME[verdict] || {
    color: '#5C6650',
    bg: 'rgba(92, 102, 80, 0.12)',
    border: 'rgba(92, 102, 80, 0.25)',
    Icon: ShieldQuestion,
    label: verdict || 'Verification Report',
  };
}

function getTrustColor(score) {
  if (score >= 70) return '#2E7D32';
  if (score >= 40) return '#D87D0A';
  return '#C62828';
}

export default function SharedReportPage() {
  const { id } = useParams();
  const { t } = useTranslation();
  const [check, setCheck] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    getReport(id)
      .then(({ data }) => setCheck(data))
      .catch((err) => setError(err.response?.data?.message || 'Verification report not found.'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FBE8CE] flex flex-col items-center justify-center gap-4 text-center px-4">
        <div className="w-9 h-9 border-3 border-[#C3CC9B] border-t-[#768E56] rounded-full animate-spin" />
        <p className="text-[#5C6650] text-sm font-medium">Loading verified report…</p>
      </div>
    );
  }

  if (error || !check) {
    return (
      <div className="min-h-screen bg-[#FBE8CE] flex flex-col items-center justify-center text-center px-4 py-12">
        <div className="w-16 h-16 rounded-2xl bg-[#E4DFB5] border border-[#C3CC9B] flex items-center justify-center mb-4 text-[#5C6650]">
          <ShieldQuestion size={32} />
        </div>
        <h1 className="text-xl font-bold text-[#232B1B] mb-2">Report Not Available</h1>
        <p className="text-[#5C6650] text-sm max-w-sm mb-6 leading-relaxed">
          {error || 'This shared report link is invalid or has expired.'}
        </p>
        <Link
          to="/"
          className="bg-[#232B1B] hover:bg-[#343F29] text-[#FBE8CE] font-bold px-6 py-2.5 rounded-xl text-sm no-underline transition-all shadow-sm"
        >
          ← Go to SatyaScan Home
        </Link>
      </div>
    );
  }

  const isImage = check.inputType === 'image';
  const rawVerdict = isImage
    ? check.imageVerdict || 'INCONCLUSIVE'
    : check.pageVerdict || (check.trustScore >= 70 ? 'Supported' : check.trustScore >= 40 ? 'Misleading' : 'Contradicted');

  const theme = getTheme(rawVerdict);
  const VerdictIcon = theme.Icon;
  const displayScore = isImage ? (check.imageConfidence ?? 50) : (check.trustScore ?? 50);

  return (
    <div className="min-h-screen bg-[#FBE8CE] text-[#232B1B] font-sans pb-16 overflow-x-hidden">
      {/* ── Top Bar ── */}
      <div className="sticky top-0 z-40 bg-[#FBE8CE]/90 backdrop-blur-lg border-b border-[#C3CC9B] px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-3">
          <Link to="/" className="flex items-center gap-2 no-underline text-[#232B1B]">
            <img src="/SatyaScan_logo_transparent.png" alt="SatyaScan Logo" className="h-8 sm:h-9 w-auto object-contain" />
            <span className="font-bold text-sm sm:text-base tracking-tight">
              Satya<span className="text-[#5C6650] font-medium">Scan</span>
            </span>
          </Link>
          <span className="text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full bg-[#768E56]/15 text-[#768E56] border border-[#768E56]/20">
            Public Report
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-[#E4DFB5] hover:bg-[#E4DFB5]/70 text-[#232B1B] border border-[#C3CC9B] transition-colors cursor-pointer"
          >
            {copied ? (
              <>
                <Check size={12} className="text-[#2E7D32]" />
                <span className="text-[#2E7D32]">Copied!</span>
              </>
            ) : (
              <>
                <Share2 size={12} />
                <span>Share</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Main Container ── */}
      <div className="max-w-3xl mx-auto px-3 sm:px-6 py-5 sm:py-8 space-y-4 sm:space-y-6">

        {/* ── Public Banner ── */}
        <div className="bg-[#E4DFB5] border border-[#C3CC9B] rounded-xl px-3.5 sm:px-4 py-2.5 flex items-center justify-between text-xs text-[#5C6650] flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck size={14} className="text-[#768E56] shrink-0" />
            <span className="text-[11px] sm:text-xs font-medium">Independent Verification Report generated by SatyaScan</span>
          </div>
          <span className="text-[10px] sm:text-[11px] font-mono text-[#5C6650]/70">
            {new Date(check.createdAt).toLocaleDateString()}
          </span>
        </div>

        {isImage ? (
          <ImageDualAnalysis result={check} />
        ) : (
          <>
            {/* ── Hero Verdict Card ── */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl overflow-hidden bg-[#E4DFB5]"
              style={{ border: `1px solid ${theme.border}` }}
            >
              <div className="h-1 w-full" style={{ background: theme.color }} />

              <div className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 w-full">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#5C6650] block mb-2">
                      Fact-Check Verification Verdict
                    </span>

                    <div className="flex items-center gap-2.5 sm:gap-3 mb-3">
                      <div
                        className="w-10 sm:w-11 h-10 sm:h-11 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: theme.bg, border: `1px solid ${theme.border}` }}
                      >
                        <VerdictIcon size={22} style={{ color: theme.color }} />
                      </div>
                      <h1 className="text-xl sm:text-3xl font-black tracking-tight break-words" style={{ color: theme.color }}>
                        {theme.label}
                      </h1>
                    </div>

                    {/* Summary */}
                    {(check.finalAssessment || check.aiReasoning) && (
                      <p className="text-xs sm:text-sm text-[#232B1B] leading-relaxed font-medium mt-3 bg-[#FBE8CE] p-3 sm:p-4 rounded-xl border border-[#C3CC9B] break-words">
                        {check.finalAssessment || (Array.isArray(check.aiReasoning) ? check.aiReasoning.join(' ') : check.aiReasoning)}
                      </p>
                    )}
                  </div>

                  {/* Score Badge */}
                  <div className="w-full sm:w-auto flex flex-row sm:flex-col items-center justify-between sm:justify-center p-3.5 sm:p-4 rounded-xl bg-[#FBE8CE] border border-[#C3CC9B] shrink-0 sm:min-w-[110px]">
                    <span className="text-2xl sm:text-3xl font-black leading-none" style={{ color: getTrustColor(displayScore) }}>
                      {displayScore}
                    </span>
                    <div className="text-right sm:text-center">
                      <span className="text-[10px] font-bold text-[#5C6650] uppercase tracking-wider block sm:mt-1">
                        Trust Score
                      </span>
                      <span className="text-[9px] text-[#5C6650]/60">out of 100</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* ── Key Findings Card ── */}
            {check.keyFindings?.length > 0 && (
              <div className="rounded-2xl p-4 sm:p-5 bg-[#E4DFB5] border border-[#C3CC9B] space-y-3">
                <h3 className="text-xs font-bold text-[#232B1B] flex items-center gap-1.5 uppercase tracking-wider">
                  <Brain size={14} className="text-[#768E56] shrink-0" />
                  <span>Key Findings & Corroboration</span>
                </h3>
                <ul className="space-y-2">
                  {check.keyFindings.map((finding, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs text-[#232B1B] leading-relaxed font-medium">
                      <span className="text-[#768E56] font-black shrink-0">✓</span>
                      <span className="break-words">{finding}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* ── Original Submitted Claim ── */}
            {check.originalText && (
              <div className="rounded-2xl p-4 sm:p-5 bg-[#E4DFB5] border border-[#C3CC9B]">
                <h3 className="text-xs font-bold text-[#5C6650] uppercase tracking-wider mb-2">
                  Original Claim Text
                </h3>
                <p className="text-xs sm:text-sm text-[#232B1B] leading-relaxed font-serif italic bg-[#FBE8CE] p-3 sm:p-4 rounded-xl border border-[#C3CC9B] break-words">
                  "{check.originalText}"
                </p>
              </div>
            )}

            {/* ── Claims & Cited Sources (if text/url) ── */}
            {check.claims?.length > 0 && (
              <div className="rounded-2xl p-4 sm:p-5 bg-[#E4DFB5] border border-[#C3CC9B] space-y-4">
                <h3 className="text-xs font-bold text-[#232B1B] uppercase tracking-wider flex items-center gap-1.5">
                  <Globe size={14} className="text-[#768E56] shrink-0" />
                  <span>Verified Claims & Evidence Sources ({check.claims.length})</span>
                </h3>

                <div className="space-y-3">
                  {check.claims.map((claim, idx) => {
                    const claimTheme = getTheme(claim.verdict);
                    return (
                      <div key={idx} className="p-3.5 sm:p-4 rounded-xl bg-[#FBE8CE] border border-[#C3CC9B] space-y-2.5">
                        <div className="flex flex-col sm:flex-row items-start justify-between gap-2">
                          <p className="text-xs sm:text-sm font-semibold text-[#232B1B] leading-relaxed flex-1 break-words">
                            "{claim.text}"
                          </p>
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                            style={{ background: claimTheme.bg, color: claimTheme.color, border: `1px solid ${claimTheme.border}` }}
                          >
                            {claim.verdict}
                          </span>
                        </div>

                        {claim.reasoning && (
                          <p className="text-xs text-[#5C6650] leading-relaxed break-words">
                            {claim.reasoning}
                          </p>
                        )}

                        {claim.sources?.length > 0 && (
                          <div className="pt-2 border-t border-[#C3CC9B]/60 space-y-1.5">
                            <span className="text-[10px] font-bold text-[#5C6650] uppercase tracking-wider block">
                              Cited Sources:
                            </span>
                            {claim.sources.map((src, sIdx) => {
                              const url = src.url || src;
                              const title = src.title || url;
                              return (
                                <a
                                  key={sIdx}
                                  href={typeof url === 'string' ? url : '#'}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1.5 text-xs text-[#768E56] hover:underline break-all"
                                >
                                  <ExternalLink size={11} className="shrink-0" />
                                  <span className="truncate">{title}</span>
                                </a>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Call to Action / Footer ── */}
        <div className="p-5 sm:p-6 rounded-2xl bg-[#E4DFB5] border border-[#C3CC9B] text-center space-y-3">
          <Sparkles size={20} className="text-[#768E56] mx-auto" />
          <h3 className="text-sm font-bold text-[#232B1B]">Want to verify your own text, URL, or image?</h3>
          <p className="text-xs text-[#5C6650] max-w-md mx-auto leading-relaxed">
            SatyaScan provides multi-modal AI verification against global trusted wire services, government databases, and fact-checking authorities.
          </p>
          <Link
            to="/analyze"
            className="inline-flex items-center gap-1.5 bg-[#232B1B] hover:bg-[#343F29] text-[#FBE8CE] font-bold text-xs px-5 py-2.5 rounded-xl no-underline transition-all shadow-sm"
          >
            <span>Start a Free Verification</span>
            <ArrowRight size={13} />
          </Link>
        </div>

      </div>
    </div>
  );
}
