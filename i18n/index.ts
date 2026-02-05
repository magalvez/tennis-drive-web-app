import * as Localization from 'expo-localization';
import { I18n } from 'i18n-js';

import en from './locales/en.json';
import es from './locales/es.json';

// Create i18n instance
const i18n = new I18n({
    en,
    es,
});

// Set the locale, preferring 'es' as default
const deviceLocales = Localization.getLocales();
const deviceLocale = deviceLocales && deviceLocales.length > 0 ? deviceLocales[0].languageCode : 'es';

i18n.locale = deviceLocale === 'en' ? 'en' : 'es';

// When a value is missing from a language it'll fall back to Spanish
i18n.enableFallback = true;
i18n.defaultLocale = 'es';

export default i18n;
export { en, es };
