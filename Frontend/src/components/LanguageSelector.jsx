import { useLanguage } from '../context/LanguageContext';
import { useTranslation } from '../context/LanguageContext';
import languages from '../constants/languages.json';

export default function LanguageSelector() {
  const { selectedLanguage, setSelectedLanguage, detectedLanguage } = useLanguage();
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-3">
      {/* AI Analysis Language Dropdown */}
      <select
        value={selectedLanguage}
        onChange={(e) => setSelectedLanguage(e.target.value)}
        className="bg-[#1A1A1A] border border-[#2A2A2A] text-[#D1D5DB] rounded-lg px-3 py-1.5 text-xs font-medium focus:outline-none focus:border-[#14B8A6] hover:border-[#14B8A6] transition-colors cursor-pointer"
        aria-label={t('nav.language')}
      >
        {Object.entries(languages).map(([code, lang]) => (
          <option key={code} value={code} className="bg-[#1A1A1A]">
            {lang.flag} {lang.name}
          </option>
        ))}
      </select>

      {/* Detection indicator */}
      {selectedLanguage === 'auto' && detectedLanguage && (
        <span className="text-xs text-[#14B8A6] flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#14B8A6] animate-pulse" />
          {languages[detectedLanguage]?.flag || '🌐'} {languages[detectedLanguage]?.name || 'Unknown'}
        </span>
      )}
    </div>
  );
}
