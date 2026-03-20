
import { useLanguage } from '../../context/LanguageContext';
import { Link } from 'react-router-dom';

export default function MarketingPage() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-tennis-dark text-white font-sans selection:bg-tennis-green selection:text-black">
      {/* Hero Section */}
      <div className="relative overflow-hidden pt-24 pb-32">
        <div className="absolute inset-0 bg-gradient-to-b from-tennis-green/10 to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10 text-center">
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8">
            <span className="block text-white">{t('public.marketing.hero.title1')}</span>
            <span className="block text-tennis-green">{t('public.marketing.hero.title2')}</span>
          </h1>
          <p className="mt-6 text-xl text-gray-300 max-w-3xl mx-auto mb-10">
            {t('public.marketing.hero.subtitle')}
          </p>
          <div className="flex gap-4 justify-center">
            <Link to="/login" className="bg-tennis-green text-black px-8 py-4 rounded-full font-bold text-lg hover:bg-white transition-colors shadow-[0_0_20px_rgba(186,229,59,0.3)]">
              {t('public.marketing.hero.cta')}
            </Link>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-20 border-t border-white/10">
        <div className="grid md:grid-cols-3 gap-8">
          <div className="glass p-8 rounded-2xl hover:-translate-y-2 transition-transform duration-300">
            <div className="w-12 h-12 bg-tennis-green/20 rounded-lg flex items-center justify-center mb-6 text-2xl">🎾</div>
            <h3 className="text-2xl font-bold mb-4">{t('public.marketing.features.1.title')}</h3>
            <p className="text-gray-400">{t('public.marketing.features.1.desc')}</p>
          </div>
          <div className="glass p-8 rounded-2xl hover:-translate-y-2 transition-transform duration-300">
            <div className="w-12 h-12 bg-tennis-green/20 rounded-lg flex items-center justify-center mb-6 text-2xl">🏆</div>
            <h3 className="text-2xl font-bold mb-4">{t('public.marketing.features.2.title')}</h3>
            <p className="text-gray-400">{t('public.marketing.features.2.desc')}</p>
          </div>
          <div className="glass p-8 rounded-2xl hover:-translate-y-2 transition-transform duration-300">
            <div className="w-12 h-12 bg-tennis-green/20 rounded-lg flex items-center justify-center mb-6 text-2xl">📊</div>
            <h3 className="text-2xl font-bold mb-4">{t('public.marketing.features.3.title')}</h3>
            <p className="text-gray-400">{t('public.marketing.features.3.desc')}</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/10 py-12 mt-20 text-center text-gray-500">
        <p>© 2026 PlayOnCourt. {t('public.marketing.footer')}</p>
        <div className="mt-4 flex justify-center gap-6">
          <Link to="/support" className="hover:text-tennis-green transition-colors">{t('public.support.title')}</Link>
          <Link to="/privacy" className="hover:text-tennis-green transition-colors">{t('public.privacy.title')}</Link>
          <Link to="/terms" className="hover:text-tennis-green transition-colors">{t('public.terms.title')}</Link>
        </div>
      </footer>
    </div>
  );
}
