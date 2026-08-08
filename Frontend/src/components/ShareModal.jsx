import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Check, X, Share2 } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';

export default function ShareModal({ checkId, onClose }) {
  const { t } = useTranslation();
  const shareUrl = `${window.location.origin}/shared/${checkId}`;
  const [copied, setCopied] = useState(false);
  const [showToast, setShowToast] = useState(false);

  // Lock body scroll and listen for Escape key
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setShowToast(true);
      setTimeout(() => setCopied(false), 2500);
      setTimeout(() => setShowToast(false), 3000);
    }).catch(() => {
      const el = document.createElement('textarea');
      el.value = shareUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setShowToast(true);
      setTimeout(() => setCopied(false), 2500);
      setTimeout(() => setShowToast(false), 3000);
    });
  };

  const modalContent = (
    <div
      className="fixed inset-0 top-0 left-0 w-screen h-screen z-[99999] bg-[#232B1B]/75 backdrop-blur-sm flex items-center justify-center p-4 m-0"
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh' }}
      onClick={onClose}
    >
      {/* Toast Notification */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-6 z-[100000] bg-[#2E7D32] text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 border border-white/20"
          >
            <Check size={14} className="stroke-[3]" />
            <span>Link copied to clipboard!</span>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 0 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-[#FBE8CE] border border-[#C3CC9B] rounded-2xl p-5 sm:p-6 shadow-2xl text-[#232B1B] my-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#E4DFB5] border border-[#C3CC9B] flex items-center justify-center shrink-0">
              <Share2 size={16} className="text-[#768E56]" />
            </div>
            <h2 className="text-[#232B1B] font-bold text-base">Share Verification Report</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-[#5C6650] hover:text-[#232B1B] w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#E4DFB5] transition-colors border-none bg-transparent cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <p className="text-xs text-[#5C6650] mb-4 leading-relaxed">
          Anyone with this link can view this verified report and its source breakdown without needing to sign in.
        </p>

        {/* Shareable Link Box */}
        <div className="mb-5">
          <label className="block text-[11px] font-bold text-[#5C6650] uppercase tracking-wider mb-1.5">
            Public Report Link
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              readOnly
              value={shareUrl}
              onClick={(e) => e.target.select()}
              className="w-full bg-[#E4DFB5] border border-[#C3CC9B] text-[#232B1B] text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#768E56] font-mono select-all truncate"
            />
            <button
              onClick={handleCopy}
              className={`shrink-0 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer border-none shadow-sm ${
                copied
                  ? 'bg-[#2E7D32] text-white'
                  : 'bg-[#232B1B] hover:bg-[#343F29] text-[#FBE8CE]'
              }`}
            >
              {copied ? (
                <>
                  <Check size={14} className="stroke-[3]" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy size={13} />
                  <span>Copy Link</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-2 border-t border-[#C3CC9B]/60">
          <button
            onClick={onClose}
            className="w-full text-center text-xs font-bold py-2.5 px-4 rounded-xl bg-[#E4DFB5] hover:bg-[#E4DFB5]/70 text-[#232B1B] border border-[#C3CC9B] transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
