import {
    Check,
    Globe,
    Home,
    Info,
    LogOut,
    MapPin,
    RefreshCw,
    Save,
    Shield,
    Trophy,
    Type
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
            showSuccess("Club configuration saved successfully!");
        } catch (error) {
            alert("Failed to update club.");
        } finally {
            setSaving(false);
        }
    };

    const handleRecalculateRanking = async () => {
        if (!window.confirm("This will process all match history and update every player's XP. This may take a few moments. Continue?")) return;
        setRecalculating(true);
        try {
            await recalculateGlobalRankings();
            showSuccess("Global rankings recalculated successfully!");
        } catch (error) {
            alert("Failed to recalculate rankings.");
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
        <div className="space-y-10 animate-fade-in relative max-w-6xl">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-white text-4xl font-extrabold uppercase tracking-tight">{t('config.title')}</h1>
                    <p className="text-gray-500 font-bold uppercase text-[10px] tracking-widest mt-1">Platform Settings & Club Parameters</p>
                </div>
                {successMessage && (
                    <div className="bg-tennis-green/10 border border-tennis-green/20 text-tennis-green px-6 py-3 rounded-2xl flex items-center gap-2 animate-bounce">
                        <Check size={18} />
                        <span className="font-bold text-sm">{successMessage}</span>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
                {/* Left Column: Essential Settings */}
                <div className="xl:col-span-2 space-y-8">
                    {/* Club Identity Section */}
                    <div className="glass p-10 rounded-[40px] border-white/5 space-y-8">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-tennis-green/10 rounded-2xl flex items-center justify-center text-tennis-green">
                                <Home size={24} />
                            </div>
                            <h3 className="text-white text-2xl font-bold">Club Identity</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-3">
                                <label className="text-gray-500 text-[10px] font-black uppercase tracking-widest ml-1">Club Name</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={clubName}
                                        onChange={(e) => setClubName(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-white font-bold focus:outline-none focus:border-tennis-green/50 pl-14 transition-all"
                                        placeholder="Epic Tennis Academy"
                                    />
                                    <Type className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                                </div>
                            </div>
                            <div className="space-y-3">
                                <label className="text-gray-500 text-[10px] font-black uppercase tracking-widest ml-1">Location</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={clubLocation}
                                        onChange={(e) => setClubLocation(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-white font-bold focus:outline-none focus:border-tennis-green/50 pl-14 transition-all"
                                        placeholder="Miami, FL"
                                    />
                                    <MapPin className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-gray-500 text-[10px] font-black uppercase tracking-widest ml-1">Description (Optional)</label>
                            <textarea
                                value={clubDescription}
                                onChange={(e) => setClubDescription(e.target.value)}
                                rows={4}
                                className="w-full bg-white/5 border border-white/10 rounded-3xl p-6 text-white font-medium focus:outline-none focus:border-tennis-green/50 transition-all resize-none"
                                placeholder="Tell us about your club's mission and facilities..."
                            />
                        </div>
                    </div>

                    {/* Scoring Configuration */}
                    <div className="glass p-10 rounded-[40px] border-white/5 space-y-8">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-400">
                                <Trophy size={24} />
                            </div>
                            <h3 className="text-white text-2xl font-bold">Scoring System</h3>
                        </div>

                        <p className="text-gray-500 text-sm leading-relaxed max-w-2xl font-medium">
                            Set the base points awarded for various match outcomes. These points affect the internal club rankings and player progression.
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                            <div className="bg-white/5 p-8 rounded-[32px] border border-white/5 text-center space-y-3 transition-all hover:bg-white/[0.07]">
                                <label className="text-tennis-green text-[10px] font-black uppercase tracking-widest">Victory</label>
                                <input
                                    type="number"
                                    value={winPoints}
                                    onChange={(e) => setWinPoints(e.target.value)}
                                    className="w-full bg-transparent text-white text-5xl font-black text-center focus:outline-none"
                                />
                                <p className="text-gray-600 text-[9px] font-bold uppercase">Points Per Match</p>
                            </div>
                            <div className="bg-white/5 p-8 rounded-[32px] border border-white/5 text-center space-y-3 transition-all hover:bg-white/[0.07]">
                                <label className="text-red-400 text-[10px] font-black uppercase tracking-widest">Defeat</label>
                                <input
                                    type="number"
                                    value={lossPoints}
                                    onChange={(e) => setLossPoints(e.target.value)}
                                    className="w-full bg-transparent text-white text-5xl font-black text-center focus:outline-none"
                                />
                                <p className="text-gray-600 text-[9px] font-bold uppercase">Points Per Match</p>
                            </div>
                            <div className="bg-white/5 p-8 rounded-[32px] border border-white/5 text-center space-y-3 transition-all hover:bg-white/[0.07]">
                                <label className="text-yellow-400 text-[10px] font-black uppercase tracking-widest">Withdrawal</label>
                                <input
                                    type="number"
                                    value={withdrawPoints}
                                    onChange={(e) => setWithdrawPoints(e.target.value)}
                                    className="w-full bg-transparent text-white text-5xl font-black text-center focus:outline-none"
                                />
                                <p className="text-gray-600 text-[9px] font-bold uppercase">Points Per Match</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Global Actions & Account */}
                <div className="space-y-8">
                    {/* Global Actions */}
                    <div className="glass p-8 rounded-[40px] border-white/5 space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-400">
                                <Shield size={20} />
                            </div>
                            <h4 className="text-white font-bold">System Utilities</h4>
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
                                <p className="text-white text-sm font-bold">Recalculate Ranking</p>
                                <p className="text-gray-500 text-[10px] font-medium">Sync XP for all users</p>
                            </div>
                        </button>

                        <div className="bg-white/5 p-6 rounded-[32px] border border-white/5 space-y-4">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-blue-400 bg-blue-400/10">
                                    <Globe size={20} />
                                </div>
                                <div className="text-left">
                                    <p className="text-white text-sm font-bold">{t('settings.language')}</p>
                                    <p className="text-gray-500 text-[10px] font-medium">{language === 'en' ? 'English' : 'Español'}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => setLanguage('en')}
                                    className={`py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${language === 'en' ? 'bg-tennis-green text-tennis-dark' : 'bg-white/5 text-gray-500 hover:text-white'}`}
                                >
                                    {t('settings.english')}
                                </button>
                                <button
                                    onClick={() => setLanguage('es')}
                                    className={`py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${language === 'es' ? 'bg-tennis-green text-tennis-dark' : 'bg-white/5 text-gray-500 hover:text-white'}`}
                                >
                                    {t('settings.spanish')}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Account Section */}
                    <div className="glass p-8 rounded-[40px] border-white/5 space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center text-red-400">
                                <Info size={20} />
                            </div>
                            <h4 className="text-white font-bold">Session Settings</h4>
                        </div>

                        <button
                            onClick={() => logout()}
                            className="w-full p-6 bg-red-500/5 hover:bg-red-500/10 border border-red-500/10 rounded-[28px] flex items-center justify-center gap-3 text-red-500 transition-all font-black uppercase tracking-widest text-xs"
                        >
                            <LogOut size={18} />
                            Logout Session
                        </button>
                    </div>

                    {/* Final Save Button (Sticky/Floating effect?) */}
                    <button
                        onClick={handleUpdateClub}
                        disabled={saving}
                        className="w-full bg-tennis-green hover:bg-tennis-green/90 text-tennis-dark py-6 rounded-[32px] font-black uppercase tracking-widest shadow-2xl shadow-tennis-green/20 transition-all flex items-center justify-center gap-3"
                    >
                        {saving ? <RefreshCw className="animate-spin" /> : <Save size={24} />}
                        Save Club Changes
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfigPage;
