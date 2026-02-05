import {
    Building,
    Check,
    Globe,
    LogOut,
    RefreshCw,
    Save,
    Shield,
    Trophy
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { getClubById, updateClub } from '../../services/clubService';
import { recalculateGlobalRankings } from '../../services/userService';

const ConfigPage = () => {
    const { managedClubId, logout } = useAuth();
    const { language, setLanguage, t } = useLanguage();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [recalculating, setRecalculating] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Form State
    const [clubName, setClubName] = useState('');
    const [clubLocation, setClubLocation] = useState('');
    const [clubDescription, setClubDescription] = useState('');
    const [winPoints, setWinPoints] = useState('3');
    const [lossPoints, setLossPoints] = useState('0');
    const [withdrawPoints, setWithdrawPoints] = useState('0');

    useEffect(() => {
        const fetchClub = async () => {
            if (!managedClubId) return;
            try {
                const data = await getClubById(managedClubId);
                if (data) {
                    setClubName(data.name);
                    setClubLocation(data.location);
                    setClubDescription(data.description || '');
                    setWinPoints(data.scoringConfig?.win?.toString() || '3');
                    setLossPoints(data.scoringConfig?.loss?.toString() || '0');
                    setWithdrawPoints(data.scoringConfig?.withdraw?.toString() || '0');
                }
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };
        fetchClub();
    }, [managedClubId]);

    const handleUpdateClub = async () => {
        if (!managedClubId) return;
        setSaving(true);
        try {
            await updateClub(managedClubId, {
                name: clubName,
                location: clubLocation,
                description: clubDescription,
                scoringConfig: {
                    win: parseInt(winPoints),
                    loss: parseInt(lossPoints),
                    withdraw: parseInt(withdrawPoints)
                }
            });
            showSuccess(t('config.success') || "Club configuration saved successfully!");
        } catch (error) {
            alert(t('config.error') || "Failed to update club.");
        } finally {
            setSaving(false);
        }
    };

    const handleRecalculateRanking = async () => {
        if (!window.confirm(t('config.system.recalculateConfirm') || "This will process all match history and update every player's XP. Continue?")) return;
        setRecalculating(true);
        try {
            await recalculateGlobalRankings();
            showSuccess(t('config.system.recalculateSuccess') || "Global rankings recalculated successfully!");
        } catch (error) {
            alert(t('config.system.recalculateError') || "Failed to recalculate rankings.");
        } finally {
            setRecalculating(false);
        }
    };

    const showSuccess = (msg: string) => {
        setSuccessMessage(msg);
        setTimeout(() => setSuccessMessage(null), 3000);
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-tennis-green"></div>
        </div>
    );

    return (
        <div className="space-y-10 animate-fade-in relative max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-white text-4xl font-extrabold uppercase tracking-tight">{t('config.title')}</h1>
                    <p className="text-gray-400 font-medium">{t('config.subtitle')}</p>
                </div>
                {successMessage && (
                    <div className="bg-tennis-green/10 border border-tennis-green/20 text-tennis-green px-6 py-3 rounded-2xl flex items-center gap-2 animate-bounce">
                        <Check size={18} />
                        <span className="font-bold text-sm">{successMessage}</span>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Config Form */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Club Identity */}
                    <div className="glass p-10 rounded-[40px] border-white/5 space-y-8">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-white">
                                <Building size={24} />
                            </div>
                            <h2 className="text-white text-xl font-bold uppercase tracking-tight">{t('config.identity.title')}</h2>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <label className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-3 block">{t('config.identity.name')}</label>
                                <input
                                    type="text"
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold focus:outline-none focus:border-tennis-green/50 transition-colors"
                                    value={clubName}
                                    onChange={(e) => setClubName(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-3 block">{t('config.identity.location')}</label>
                                <input
                                    type="text"
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold focus:outline-none focus:border-tennis-green/50 transition-colors"
                                    value={clubLocation}
                                    onChange={(e) => setClubLocation(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Default Scoring */}
                    <div className="glass p-10 rounded-[40px] border-white/5 space-y-8">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-white">
                                <Trophy size={24} />
                            </div>
                            <div>
                                <h2 className="text-white text-xl font-bold uppercase tracking-tight">{t('config.scoring.title')}</h2>
                                <p className="text-gray-500 text-xs font-medium mt-1">{t('config.scoring.subtitle')}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-white/5 p-8 rounded-[32px] border border-white/5 text-center space-y-3">
                                <label className="text-tennis-green text-[10px] font-black uppercase tracking-widest">{t('config.scoring.win')}</label>
                                <input
                                    type="number"
                                    className="w-full bg-transparent text-white text-5xl font-black text-center focus:outline-none"
                                    value={winPoints}
                                    onChange={(e) => setWinPoints(e.target.value)}
                                />
                                <p className="text-gray-600 text-[9px] font-bold uppercase">{t('config.scoring.pointsLabel')}</p>
                            </div>
                            <div className="bg-white/5 p-8 rounded-[32px] border border-white/5 text-center space-y-3">
                                <label className="text-red-400 text-[10px] font-black uppercase tracking-widest">{t('config.scoring.loss')}</label>
                                <input
                                    type="number"
                                    className="w-full bg-transparent text-white text-5xl font-black text-center focus:outline-none"
                                    value={lossPoints}
                                    onChange={(e) => setLossPoints(e.target.value)}
                                />
                                <p className="text-gray-600 text-[9px] font-bold uppercase">{t('config.scoring.pointsLabel')}</p>
                            </div>
                            <div className="bg-white/5 p-8 rounded-[32px] border border-white/5 text-center space-y-3">
                                <label className="text-yellow-400 text-[10px] font-black uppercase tracking-widest">{t('config.scoring.withdraw')}</label>
                                <input
                                    type="number"
                                    className="w-full bg-transparent text-white text-5xl font-black text-center focus:outline-none"
                                    value={withdrawPoints}
                                    onChange={(e) => setWithdrawPoints(e.target.value)}
                                />
                                <p className="text-gray-600 text-[9px] font-bold uppercase">{t('config.scoring.pointsLabel')}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sidebar Settings */}
                <div className="space-y-8">
                    {/* System Utilities */}
                    <div className="glass p-8 rounded-[40px] border-white/5 space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-400">
                                <Shield size={20} />
                            </div>
                            <h4 className="text-white font-bold uppercase tracking-widest text-xs">{t('config.system.title')}</h4>
                        </div>

                        <button
                            onClick={handleRecalculateRanking}
                            disabled={recalculating}
                            className="w-full p-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl flex items-center gap-4 transition-all group"
                        >
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-purple-400 bg-purple-400/10 group-hover:rotate-180 transition-transform duration-700 ${recalculating ? 'animate-spin' : ''}`}>
                                <RefreshCw size={20} />
                            </div>
                            <div className="text-left">
                                <p className="text-white text-sm font-bold">{t('config.system.recalculate')}</p>
                                <p className="text-gray-500 text-[10px] font-medium">{t('config.system.recalculateDesc')}</p>
                            </div>
                        </button>
                    </div>

                    <div className="glass p-8 rounded-[40px] border-white/5 space-y-8">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center text-white">
                                <Globe size={20} />
                            </div>
                            <h2 className="text-white text-sm font-bold uppercase tracking-widest">{t('config.session.title')}</h2>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <label className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-3 block">{t('config.language')}</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => setLanguage('en')}
                                        className={`py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${language === 'en' ? 'bg-tennis-green text-tennis-dark' : 'bg-white/5 text-gray-500 hover:text-white'}`}
                                    >
                                        English
                                    </button>
                                    <button
                                        onClick={() => setLanguage('es')}
                                        className={`py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${language === 'es' ? 'bg-tennis-green text-tennis-dark' : 'bg-white/5 text-gray-500 hover:text-white'}`}
                                    >
                                        Español
                                    </button>
                                </div>
                            </div>

                            <button
                                onClick={() => logout()}
                                className="w-full flex items-center justify-center gap-3 py-4 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all"
                            >
                                <LogOut size={16} />
                                {t('profile.logout')}
                            </button>
                        </div>
                    </div>

                    <button
                        onClick={handleUpdateClub}
                        disabled={saving}
                        className="w-full flex items-center justify-center gap-4 bg-tennis-green hover:bg-tennis-green/90 text-tennis-dark py-6 rounded-[32px] font-black uppercase tracking-widest shadow-xl shadow-tennis-green/20 transition-all active:scale-[0.98] disabled:opacity-50"
                    >
                        {saving ? <RefreshCw className="animate-spin" /> : <Save size={20} />}
                        {t('common.saveChanges')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfigPage;
