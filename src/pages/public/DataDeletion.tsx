
import { useLanguage } from '../../context/LanguageContext';

export default function DataDeletion() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-tennis-dark text-white p-6 md:p-12 font-sans">
      <div className="max-w-4xl mx-auto glass p-8 md:p-12 rounded-3xl shadow-2xl">
        <h1 className="text-4xl md:text-5xl font-extrabold text-tennis-green mb-4">
          {t('public.deletion.title')}
        </h1>
        <p className="text-gray-500 mb-8 italic">
          {t('public.deletion.lastUpdated')}
        </p>

        <div className="space-y-8 text-gray-300 leading-relaxed">
          <p className="text-lg">
            {t('public.deletion.sections.intro')}
          </p>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">
              {t('public.deletion.sections.howTo.title')}
            </h2>
            <p>{t('public.deletion.sections.howTo.content')}</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">
              {t('public.deletion.sections.dataRemoved.title')}
            </h2>
            <p>{t('public.deletion.sections.dataRemoved.content')}</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">
              {t('public.deletion.sections.retention.title')}
            </h2>
            <p>{t('public.deletion.sections.retention.content')}</p>
          </section>

          <section className="pt-8 border-t border-white/10">
            <p className="text-center font-medium bg-tennis-green/10 p-6 rounded-2xl border border-tennis-green/20">
              {t('public.deletion.sections.contact')}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
