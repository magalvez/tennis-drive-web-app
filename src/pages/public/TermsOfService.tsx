
import { useLanguage } from '../../context/LanguageContext';

export default function TermsOfService() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-tennis-dark text-white p-6 md:p-12 font-sans">
      <div className="max-w-4xl mx-auto glass p-8 md:p-12 rounded-3xl shadow-2xl">
        <h1 className="text-4xl md:text-5xl font-extrabold text-tennis-green mb-4">
          {t('public.terms.title')}
        </h1>
        <p className="text-gray-500 mb-8 italic">
          {t('public.terms.lastUpdated')}
        </p>

        <div className="space-y-8 text-gray-300 leading-relaxed">
          <section>
            <h2 className="text-2xl font-bold text-white mb-3">
              {t('public.terms.sections.acceptance.title')}
            </h2>
            <p>{t('public.terms.sections.acceptance.content')}</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">
              {t('public.terms.sections.userConduct.title')}
            </h2>
            <p>{t('public.terms.sections.userConduct.content')}</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">
              {t('public.terms.sections.accountability.title')}
            </h2>
            <p>{t('public.terms.sections.accountability.content')}</p>
          </section>

          <section className="pt-8 border-t border-white/10 italic text-sm text-center">
            {t('public.marketing.footer')}
          </section>
        </div>
      </div>
    </div>
  );
}
