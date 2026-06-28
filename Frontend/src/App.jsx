import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './context/LanguageContext';
import { useTranslation } from './context/LanguageContext';
import Navbar from './components/Navbar';
import LandingPage from './pages/LandingPage';
import AnalyzePage from './pages/AnalyzePage';
import ResultsPage from './pages/ResultsPage';
import HistoryPage from './pages/HistoryPage';
import ReportPage from './pages/ReportPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';

// Pages that have their own built-in top bar — don't show the global Navbar
const PAGES_WITH_OWN_NAV = ['/', '/analyze', '/results', '/login', '/signup'];

function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
      <h2 className="text-[#14B8A6] text-6xl font-black mb-4">{t('common.notFound')}</h2>
      <p className="text-[#D1D5DB] mb-6 text-lg">{t('common.notFoundMsg')}</p>
      <a
        href="/"
        className="ss-btn-primary px-6 py-2.5 text-sm"
      >
        ← {t('common.goHome')}
      </a>
    </div>
  );
}

function Layout({ children }) {
  const { pathname } = useLocation();
  const hideNav =
    PAGES_WITH_OWN_NAV.includes(pathname) ||
    pathname.startsWith('/results/');
  const showNav = !hideNav;
  return (
    <div className="min-h-screen bg-[#0B0B0B] flex flex-col">
      {showNav && <Navbar />}
      <main className="flex-1 page-enter">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <LanguageProvider>
          <BrowserRouter>
            <Layout>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/analyze" element={<AnalyzePage />} />
                <Route path="/results/:checkId" element={<ResultsPage />} />
                <Route path="/results" element={<ResultsPage />} />
                <Route path="/history" element={<HistoryPage />} />
                <Route path="/report/:id" element={<ReportPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Layout>
          </BrowserRouter>
        </LanguageProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
