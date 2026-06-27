import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getReport } from '../api/api';
import { useTranslation } from '../context/LanguageContext';

function getTrustColor(score) {
  if (score >= 70) return '#14B8A6';
  if (score >= 40) return '#f59e0b';
  return '#ef4444';
}

function getVerdictColor(verdict) {
  const map = {
    True: '#14B8A6', Supported: '#14B8A6',
    False: '#ef4444', Contradicted: '#ef4444',
    Misleading: '#f97316', Unverified: '#6b7280',
    'Partially True': '#f59e0b',
  };
  return map[verdict] || '#6b7280';
}

// Shield logo with teal
function ShieldLogo({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <defs>
        <linearGradient id="slgReport" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#14B8A6" />
          <stop offset="100%" stopColor="#5eead4" />
        </linearGradient>
      </defs>
      <path d="M50 6 L88 22 L88 54 C88 72 70 88 50 95 C30 88 12 72 12 54 L12 22 Z"
        fill="url(#slgReport)" opacity="0.15" stroke="url(#slgReport)" strokeWidth="2.5" />
      <text x="50" y="66" textAnchor="middle" fontSize="44" fontWeight="800"
        fontFamily="Inter,Arial,sans-serif" fill="url(#slgReport)">S</text>
    </svg>
  );
}

export default function ReportPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const [check, setCheck] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getReport(id)
      .then(({ data }) => setCheck(data))
      .catch((err) => setError(err.response?.data?.message || t('report.notFound')))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="min-h-screen bg-[#0B0B0B] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <ShieldLogo size={40} />
        <div className="w-8 h-8 border-2 border-[#2A2A2A] border-t-[#14B8A6] rounded-full animate-spin" />
        <p className="text-[#D1D5DB] text-sm">{t('report.loading')}</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-[#0B0B0B] flex flex-col items-center justify-center text-center px-4">
      <ShieldLogo size={40} />
      <p className="text-red-400 mt-4 mb-6">{error}</p>
      <Link to="/" className="ss-btn-secondary text-sm px-5 py-2">← {t('report.backHome')}</Link>
    </div>
  );

  const pdfUrl = `/api/report/${id}?format=pdf`;

  return (
    <div className="min-h-screen bg-[#0B0B0B] px-4 py-10">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <ShieldLogo size={28} />
            <div>
              <h1 className="text-2xl font-bold text-white">{t('report.publicReport')}</h1>
              <p className="text-[#D1D5DB]/50 text-sm">{new Date(check.createdAt).toLocaleString()}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link to="/" className="ss-btn-secondary text-sm px-4 py-2">
              ← {t('report.backHome')}
            </Link>
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ss-btn-primary text-sm px-4 py-2"
            >
              📄 PDF
            </a>
          </div>
        </div>

        {/* Scores */}
        <div className="ss-card mb-5">
          <h2 className="text-white font-semibold mb-4 text-sm uppercase tracking-widest">Scores</h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            {[
              { label: 'Trust Score', value: check.trustScore },
              { label: 'AI Score', value: check.aiScore },
              { label: 'Source Trust', value: check.sourceScore },
            ].map((s) => (
              <div key={s.label} className="bg-[#0B0B0B] rounded-xl p-4 border border-[#2A2A2A]">
                <div className="text-3xl font-black mb-1" style={{ color: getTrustColor(s.value) }}>{s.value}</div>
                <div className="text-xs text-[#D1D5DB]/50 uppercase tracking-wider">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Meta */}
        <div className="ss-card mb-5">
          <div className="flex gap-4 text-sm flex-wrap">
            <span className="text-[#D1D5DB]/50">Input: <span className="text-white capitalize">{check.inputType}</span></span>
            {(check.detectedLanguage || check.language) && (
              <span className="text-[#D1D5DB]/50">
                {t('results.detected')}: <span className="text-[#14B8A6] uppercase">{check.detectedLanguage || check.language}</span>
              </span>
            )}
            {check.responseLanguage && (
              <span className="text-[#D1D5DB]/50">
                {t('results.response')}: <span className="text-[#5eead4] uppercase">{check.responseLanguage}</span>
              </span>
            )}
            <span className="text-[#D1D5DB]/50">Claims: <span className="text-white">{check.claims?.length}</span></span>
          </div>
        </div>

        {/* Original text */}
        <div className="ss-card mb-5">
          <h2 className="text-white font-semibold mb-3 text-sm uppercase tracking-widest">Original Content</h2>
          <p className="text-[#D1D5DB] text-sm whitespace-pre-wrap line-clamp-6 leading-relaxed">{check.originalText}</p>
        </div>

        {/* Claims */}
        <div className="ss-card">
          <h2 className="text-white font-semibold mb-4 text-sm uppercase tracking-widest">Claims</h2>
          <div className="space-y-3">
            {check.claims?.map((claim, i) => (
              <div key={i} className="border border-[#2A2A2A] rounded-xl p-4 hover:border-[#14B8A6]/30 transition-colors">
                <p className="text-[#D1D5DB] text-sm mb-3 leading-relaxed">"{claim.text}"</p>
                <span
                  className="text-xs font-bold px-3 py-1 rounded-full"
                  style={{ background: getVerdictColor(claim.verdict) + '22', color: getVerdictColor(claim.verdict) }}
                >
                  {claim.verdict}
                </span>
                {claim.sources?.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs text-[#D1D5DB]/40 mb-1.5 uppercase tracking-wider">Sources:</p>
                    {claim.sources.map((s, j) => (
                      <a key={j} href={s} target="_blank" rel="noopener noreferrer"
                        className="block text-xs text-[#14B8A6] hover:underline truncate mb-1">
                        {s}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-[#D1D5DB]/30 text-xs">
            <span className="text-[#14B8A6] font-semibold">Satya</span>Scan AI — Digital Truth Verification
          </p>
        </div>
      </div>
    </div>
  );
}
