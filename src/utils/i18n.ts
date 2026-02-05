import en from '../i18n/locales/en.json';
import es from '../i18n/locales/es.json';

const translations: any = { en, es };

export const translate = (key: string, locale: 'en' | 'es', params?: Record<string, any>) => {
    const keys = key.split('.');
    let result = translations[locale];

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
