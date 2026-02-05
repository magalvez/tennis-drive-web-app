import { signInWithEmailAndPassword } from 'firebase/auth';
import { LogIn } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

const LoginPage = () => {
    const { t } = useLanguage();
    const { user, role, isLoading } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        if (!isLoading && user && role === 'admin') {
            navigate('/admin');
        }
    }, [user, role, isLoading, navigate]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            await signInWithEmailAndPassword(auth, email, password);
            // AuthContext listener will redirect to dashboard via App.tsx if role is admin
            navigate('/admin');
        } catch (err: any) {
            console.error(err);
            setError(t('auth.loginError'));
        } finally {
            setLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-tennis-dark flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-tennis-green"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-tennis-dark flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background Glow */}
            <div className="absolute top-0 left-0 right-0 h-64 bg-tennis-green/10 blur-[100px] pointer-events-none" />

            <div className="w-full max-w-md glass p-10 rounded-3xl z-10">
                <div className="flex flex-col items-center mb-10">
                    <div className="w-16 h-16 bg-tennis-green rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-tennis-green/20">
                        <LogIn className="text-tennis-dark" size={32} />
                    </div>
                    <h1 className="text-white text-3xl font-extrabold text-center uppercase tracking-tight">{t('auth.signIn')}</h1>
                    <p className="text-gray-400 mt-2 font-medium">{t('auth.welcomeBack')}</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                    <div>
                        <label className="text-gray-300 text-sm font-bold mb-2 ml-1 block">{t('auth.email')}</label>
                        <input
                            type="email"
                            placeholder={t('auth.emailPlaceholder')}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white text-lg focus:outline-none focus:border-tennis-green/50 transition-colors"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div>
                        <label className="text-gray-300 text-sm font-bold mb-2 ml-1 block">{t('auth.password')}</label>
                        <input
                            type="password"
                            placeholder={t('auth.passwordPlaceholder')}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white text-lg focus:outline-none focus:border-tennis-green/50 transition-colors"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    {error && <p className="text-red-500 text-sm text-center font-medium bg-red-500/10 py-3 rounded-xl border border-red-500/20">{error}</p>}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-tennis-green hover:bg-tennis-green/90 text-tennis-dark font-extrabold py-5 rounded-2xl text-xl uppercase tracking-wider shadow-lg shadow-tennis-green/20 active:scale-[0.98] transition-all disabled:opacity-50"
                    >
                        {loading ? <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-tennis-dark mx-auto"></div> : t('auth.signIn')}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default LoginPage;
