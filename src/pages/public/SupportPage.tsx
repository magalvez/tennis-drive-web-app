
import { useLanguage } from '../../context/LanguageContext';
import { Link } from 'react-router-dom';

export default function SupportPage() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-tennis-dark text-white flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-2xl glass p-8 rounded-2xl shadow-xl space-y-6">
        <h1 className="text-4xl font-bold text-tennis-green text-center">
          {t('public.support.title')}
        </h1>
        <p className="text-gray-300 text-center text-lg">
          {t('public.support.description')}
        </p>

        <div className="space-y-4 mt-8">
          <div className="bg-white/5 p-6 rounded-xl border border-white/10 hover:border-tennis-green/50 transition-colors">
            <h2 className="text-xl font-semibold mb-2">{t('public.support.faq.title')}</h2>
            <p className="text-gray-400">{t('public.support.faq.desc')}</p>
          </div>

          <div className="bg-white/5 p-6 rounded-xl border border-white/10 hover:border-tennis-green/50 transition-colors">
            <h2 className="text-xl font-semibold mb-2">{t('public.support.contact.title')}</h2>
            <p className="text-gray-400 mb-4">{t('public.support.contact.desc')}</p>
            <a href="mailto:support@playoncourt.com" className="inline-block bg-tennis-green text-black px-6 py-2 rounded-lg font-medium hover:bg-opacity-90 transition-all">
              {t('public.support.contact.button')}
            </a>
          </div>
        </div>

        <div className="pt-8 flex justify-center gap-6 border-t border-white/5">
          <Link to="/privacy" className="text-gray-500 hover:text-tennis-green transition-colors text-sm underline">{t('public.privacy.title')}</Link>
          <Link to="/terms" className="text-gray-500 hover:text-tennis-green transition-colors text-sm underline">{t('public.terms.title')}</Link>
        </div>
      </div>
    </div>
  );
}
