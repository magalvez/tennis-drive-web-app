/**
 * Environment Configuration for WebApp
 */
const APP_ENV = import.meta.env.VITE_APP_ENV || 'production';

export const isDev = APP_ENV === 'development';
export const isProd = APP_ENV === 'production';
export const envName = APP_ENV;

/**
 * Returns the correct Firestore collection name based on environment.
 */
export const col = (name: string): string => {
    return isDev ? `dev_${name}` : name;
};

/**
 * Returns the correct Storage path based on environment.
 */
export const storagePath = (path: string): string => {
    return isDev ? `dev/${path}` : path;
};
