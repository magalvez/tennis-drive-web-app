
import { useLanguage } from '../../context/LanguageContext';

export default function PrivacyPolicy() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-tennis-dark text-white p-6 md:p-12 font-sans">
      <div className="max-w-4xl mx-auto glass p-8 md:p-12 rounded-3xl shadow-2xl">
        <h1 className="text-4xl md:text-5xl font-extrabold text-tennis-green mb-4">
          {t('public.privacy.title')}
        </h1>
        <p className="text-gray-500 mb-8 italic">
          {t('public.privacy.lastUpdated')}
        </p>

        <div className="space-y-8 text-gray-300 leading-relaxed">
          <p className="text-lg">
            {t('public.privacy.sections.intro')}
          </p>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">
              {t('public.privacy.sections.dataCollection.title')}
            </h2>
            <p>{t('public.privacy.sections.dataCollection.content')}</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">
              {t('public.privacy.sections.dataUsage.title')}
            </h2>
            <p>{t('public.privacy.sections.dataUsage.content')}</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">
              {t('public.privacy.sections.security.title')}
            </h2>
            <p>{t('public.privacy.sections.security.content')}</p>
          </section>

          <section className="pt-8 border-t border-white/10">
            <p className="text-center font-medium">
              {t('public.privacy.sections.contact')}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
