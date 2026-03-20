import { useEffect, useState } from 'react';
import { CreditCard, Edit3, Zap } from 'lucide-react';
import { getAllClubs, updateClubSubscription, triggerManualMonthlyBilling } from '../../services/managerService';
import { type ClubData } from '../../services/clubService';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

const ManagerPlansPage = () => {
    const { user } = useAuth();
    const { t } = useLanguage();
    const [clubs, setClubs] = useState<(ClubData & { id: string })[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        monthlyFee: 0,
        playerFeeSingles: 0,
        playerFeeDoubles: 0
    });

    const fetchClubs = async () => {
        try {
            const data = await getAllClubs();
            setClubs(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchClubs();
    }, []);

    const handleEdit = (club: ClubData & { id: string }) => {
        setEditingId(club.id);
        setFormData({
            monthlyFee: club.planFees?.monthlyFee || 0,
            playerFeeSingles: club.planFees?.playerFeeSingles || 0,
            playerFeeDoubles: club.planFees?.playerFeeDoubles || 0
        });
    };

    const handleSave = async (clubId: string, plan: string) => {
        try {
            await updateClubSubscription(clubId, {
                subscriptionPlan: plan as any,
                monthlyFee: formData.monthlyFee,
                playerFeeSingles: formData.playerFeeSingles,
                playerFeeDoubles: formData.playerFeeDoubles
            }, user?.uid || '');
            alert(t('manager.plans.saveSuccess'));
            setEditingId(null);
            fetchClubs();
        } catch (error) {
            alert(t('manager.plans.saveError'));
        }
    };

    const handleManualTrigger = async (clubId: string) => {
        try {
            await triggerManualMonthlyBilling(clubId, user?.uid || '');
            alert(t('manager.plans.triggerSuccess'));
        } catch (error) {
            alert(t('manager.plans.triggerError'));
        }
    };

    if (loading) return <div className="animate-pulse">{t('manager.plans.loading')}</div>;

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-black text-white tracking-tight">{t('manager.plans.title')}</h1>
                <p className="text-gray-400 mt-1">{t('manager.plans.subtitle')}</p>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {clubs.map(club => (
                    <div key={club.id} className="bg-[#1f1f1f] border border-white/5 rounded-[2rem] p-8 flex flex-col md:flex-row md:items-center justify-between gap-8 group hover:border-tennis-green/20 transition-all">
                        <div className="space-y-4">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-tennis-green">
                                    <CreditCard size={24} />
                                </div>
                                <div>
                                    <h3 className="text-white font-black text-xl">{club.name}</h3>
                                    <p className="text-tennis-green text-[10px] font-black uppercase tracking-widest bg-tennis-green/10 px-2 py-1 rounded inline-block">
                                        {club.subscriptionPlan?.replace('_', ' ') || 'Monthly'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {editingId === club.id ? (
                            <div className="flex-1 flex flex-wrap gap-4 items-end">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-500 uppercase px-2">{t('manager.plans.monthlyFee')}</label>
                                    <input 
                                        type="number" 
                                        className="bg-black/20 border border-white/10 rounded-xl px-4 py-2 text-white outline-none focus:border-tennis-green w-32"
                                        value={formData.monthlyFee}
                                        onChange={(e) => setFormData({...formData, monthlyFee: Number(e.target.value)})}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-500 uppercase px-2">{t('manager.plans.singlesFee')}</label>
                                    <input 
                                        type="number" 
                                        className="bg-black/20 border border-white/10 rounded-xl px-4 py-2 text-white outline-none focus:border-tennis-green w-32"
                                        value={formData.playerFeeSingles}
                                        onChange={(e) => setFormData({...formData, playerFeeSingles: Number(e.target.value)})}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-500 uppercase px-2">{t('manager.plans.doublesFee')}</label>
                                    <input 
                                        type="number" 
                                        className="bg-black/20 border border-white/10 rounded-xl px-4 py-2 text-white outline-none focus:border-tennis-green w-32"
                                        value={formData.playerFeeDoubles}
                                        onChange={(e) => setFormData({...formData, playerFeeDoubles: Number(e.target.value)})}
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setEditingId(null)} className="px-4 py-2 text-gray-400 font-bold hover:text-white transition-all underline decoration-tennis-green/30">{t('common.cancel')}</button>
                                    <button onClick={() => handleSave(club.id, club.subscriptionPlan || 'monthly')} className="bg-tennis-green text-tennis-dark px-6 py-2 rounded-xl font-black shadow-lg shadow-tennis-green/10">{t('common.save')}</button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-wrap gap-8 items-center">
                                <div className="text-center md:text-left">
                                    <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-1">{t('manager.plans.monthly')}</p>
                                    <p className="text-white font-bold text-lg">${club.planFees?.monthlyFee?.toLocaleString() || 0} <span className="text-[10px] text-gray-500 ml-1">COP</span></p>
                                </div>
                                <div className="text-center md:text-left">
                                    <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-1">{t('manager.plans.singles')}</p>
                                    <p className="text-white font-bold text-lg">${club.planFees?.playerFeeSingles?.toLocaleString() || 0} <span className="text-[10px] text-gray-500 ml-1">COP</span></p>
                                </div>
                                <div className="text-center md:text-left">
                                    <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-1">{t('manager.plans.doubles')}</p>
                                    <p className="text-white font-bold text-lg">${club.planFees?.playerFeeDoubles?.toLocaleString() || 0} <span className="text-[10px] text-gray-500 ml-1">COP</span></p>
                                </div>
                                <div className="flex gap-3">
                                    <button onClick={() => handleEdit(club)} className="p-3 bg-white/5 rounded-xl text-gray-400 hover:text-tennis-green hover:bg-tennis-green/10 transition-all">
                                        <Edit3 size={18} />
                                    </button>
                                    <button onClick={() => handleManualTrigger(club.id)} className="flex items-center gap-2 px-4 py-2 border border-tennis-green/20 rounded-xl text-tennis-green hover:bg-tennis-green/10 transition-all text-sm font-bold">
                                        <Zap size={14} />
                                        {t('manager.plans.manualBilling')}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ManagerPlansPage;
