import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getHistory, deleteHistoryItem } from '../api/api';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';

function getTrustColor(score) {
  if (score >= 70) return 'text-[#14B8A6]';
  if (score >= 40) return 'text-yellow-400';
  return 'text-red-400';
}

function getVerdictSummary(claims = []) {
  const counts = { True: 0, Supported: 0, False: 0, Contradicted: 0, Unverified: 0, Misleading: 0 };
  claims.forEach((c) => { if (c.verdict in counts) counts[c.verdict]++; });
  const falseCount = counts.False + counts.Contradicted + counts.Misleading;
  const trueCount = counts.True + counts.Supported;
  const unverified = counts.Unverified;
  return `${trueCount} ✓  ${falseCount} ✗  ${unverified} ?`;
}

export default function HistoryPage() {
  const { t } = useTranslation();
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const [checks, setChecks] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    if (!isLoggedIn) return;
    setLoading(true);
    setError('');
    getHistory(page)
      .then(({ data }) => {
        setChecks(data.checks);
        setPagination(data.pagination);
      })
      .catch((err) => setError(err.response?.data?.message || 'Failed to load history'))
      .finally(() => setLoading(false));
  }, [page, isLoggedIn]);

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#0B0B0B] flex flex-col items-center justify-center text-center px-4">
        <div className="ss-card max-w-sm w-full text-center py-12">
          <p className="text-4xl mb-4">🔒</p>
          <p className="text-[#D1D5DB] mb-6">{t('history.loginRequired')}</p>
          <a href="/login" className="ss-btn-primary text-sm px-6 py-2.5">
            {t('history.loginLink')} →
          </a>
        </div>
      </div>
    );
  }

  const handleDelete = async (id) => {
    if (!confirm(t('history.deleteConfirm'))) return;
    setDeletingId(id);
    try {
      await deleteHistoryItem(id);
      setChecks((prev) => prev.filter((c) => c._id !== id));
    } catch {
      alert(t('history.deleteFailed'));
    } finally {
      setDeletingId(null);
    }
  };

  const handleClick = (check) => {
    // Reconstruct minimal result shape to pass to ResultsPage
    navigate('/results', {
      state: {
        result: {
          trustScore: check.trustScore,
          aiLikelihood: 100 - check.aiScore,
          sourceCredibility: check.sourceScore,
          language: check.language,
          claims: check.claims.map((c) => ({
            text: c.text,
            verdict: c.verdict,
            sources: c.sources?.map((url) => ({ url })) || [],
          })),
          checkId: check._id,
        },
      },
    });
  };

  return (
    <div className="min-h-screen bg-[#0B0B0B] px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-extrabold text-white mb-2">{t('history.title')}</h1>
        <div className="w-16 h-1 bg-[#14B8A6] rounded-full mb-8" />

        {loading && (
          <div className="flex items-center gap-2 text-[#D1D5DB]">
            <span className="w-4 h-4 border-2 border-[#2A2A2A] border-t-[#14B8A6] rounded-full animate-spin" />
            {t('history.loading')}…
          </div>
        )}
        {error && <p className="text-red-400 mb-4">{error}</p>}

        {!loading && checks.length === 0 && (
          <div className="ss-card text-center py-16">
            <p className="text-4xl mb-4">📋</p>
            <p className="text-[#D1D5DB] mb-4">{t('history.empty')}</p>
            <a href="/analyze" className="ss-btn-primary text-sm px-5 py-2.5">
              {t('history.emptyLink')} →
            </a>
          </div>
        )}

        <div className="space-y-3">
          {checks.map((check) => (
            <div
              key={check._id}
              className="ss-card cursor-pointer hover:border-[#14B8A6]/40 transition-all duration-200"
              onClick={() => handleClick(check)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-xs bg-[#0B0B0B] border border-[#2A2A2A] text-[#D1D5DB] px-2 py-0.5 rounded-lg capitalize">
                      {check.inputType === 'text' ? '📝' : check.inputType === 'url' ? '🔗' : '🖼️'} {check.inputType}
                    </span>
                    {check.language && check.language !== 'unknown' && (
                      <span className="text-xs bg-[#14B8A6]/10 border border-[#14B8A6]/30 text-[#14B8A6] px-2 py-0.5 rounded-lg">
                        {check.language.toUpperCase()}
                      </span>
                    )}
                    <span className="text-xs text-[#D1D5DB]/40">
                      {new Date(check.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-[#D1D5DB] text-sm truncate">
                    {check.originalText?.slice(0, 120)}{check.originalText?.length > 120 ? '…' : ''}
                  </p>
                  <p className="text-[#D1D5DB]/40 text-xs mt-1 font-mono">{getVerdictSummary(check.claims)}</p>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span className={`text-2xl font-extrabold ${getTrustColor(check.trustScore)}`}>
                    {check.trustScore}
                  </span>
                  <span className="text-xs text-[#D1D5DB]/40">{t('history.trust')}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(check._id); }}
                    disabled={deletingId === check._id}
                    className="text-xs text-red-500 hover:text-red-400 disabled:opacity-50 transition-colors"
                  >
                    {deletingId === check._id ? t('history.deleting') : t('history.delete')}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex justify-center gap-3 mt-8">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="ss-btn-secondary px-4 py-2 text-sm disabled:opacity-40"
            >
              ← {t('history.prev')}
            </button>
            <span className="text-[#D1D5DB] text-sm self-center">
              {t('history.page')} {pagination.page} {t('history.of')} {pagination.totalPages}
            </span>
            <button
              disabled={page === pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="ss-btn-secondary px-4 py-2 text-sm disabled:opacity-40"
            >
              {t('history.next')} →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
