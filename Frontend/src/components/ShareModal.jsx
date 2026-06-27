import { useState } from 'react';
import { getReportPdfUrl } from '../api/api';
import { useTranslation } from '../context/LanguageContext';

export default function ShareModal({ checkId, onClose }) {
  const { t } = useTranslation();
  const shareUrl = `${window.location.origin}/report/${checkId}`;
  const pdfUrl = getReportPdfUrl(checkId);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-bold text-lg">{t('share.title')}</h2>
          <button
            onClick={onClose}
            className="text-[#D1D5DB] hover:text-white text-2xl leading-none transition-colors w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5"
          >
            ×
          </button>
        </div>

        {/* Shareable link */}
        <div className="mb-4">
          <label className="ss-label mb-2">{t('results.publicReport')}</label>
          <div className="flex gap-2">
            <input
              readOnly
              value={shareUrl}
              className="flex-1 bg-[#0B0B0B] border border-[#2A2A2A] text-[#D1D5DB] text-xs rounded-lg px-3 py-2.5 focus:outline-none font-mono"
            />
            <button
              onClick={handleCopy}
              className={`shrink-0 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200
                ${copied
                  ? 'bg-green-600 text-white'
                  : 'ss-btn-primary text-xs'}`}
            >
              {copied ? `✓ ${t('share.copied')}` : t('share.copyLink')}
            </button>
          </div>
        </div>

        {/* PDF download */}
        <a
          href={pdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="ss-btn-secondary w-full text-center text-sm py-2.5 mb-3"
        >
          📄 {t('share.downloadPdf')}
        </a>

        <p className="text-[#D1D5DB]/40 text-xs text-center">
          {t('results.publicReport')} — {shareUrl.split('/').pop()}
        </p>
      </div>
    </div>
  );
}
