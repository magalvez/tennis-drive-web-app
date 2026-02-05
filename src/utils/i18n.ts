import en from '../i18n/locales/en.json';
import es from '../i18n/locales/es.json';

const translations: any = { en, es };

let currentLocale = localStorage.getItem('language') || (navigator.language.split('-')[0] === 'es' ? 'es' : 'en');
if (currentLocale !== 'en' && currentLocale !== 'es') currentLocale = 'es';

export const setGlobalLocale = (locale: 'en' | 'es') => {
    currentLocale = locale;
};

export const translate = (key: string, params?: Record<string, any>) => {
    const keys = key.split('.');
    let result = translations[currentLocale];

    for (const k of keys) {
        result = result?.[k];
    }

    if (typeof result !== 'string') return key;

    if (params) {
        let text = result;
        Object.keys(params).forEach((param) => {
            text = text.replace(`%{${param}}`, params[param]);
        });
        return text;
    }

    return result;
};

export const t = translate;
