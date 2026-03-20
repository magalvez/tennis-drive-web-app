import { useEffect, useState } from 'react';
import { Lock, Trash2, Unlock } from 'lucide-react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { toggleTournamentBlock, removeTournament } from '../../services/managerService';
import { useAuth } from '../../context/AuthContext';
import { type TournamentData } from '../../services/types';
import { useLanguage } from '../../context/LanguageContext';

const ManagerTournamentsPage = () => {
    const { user } = useAuth();
    const { t } = useLanguage();
    const [tournaments, setTournaments] = useState<(TournamentData & { id: string })[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        try {
            const q = query(collection(db, "tournaments"), orderBy("createdAt", "desc"));
            const snap = await getDocs(q);
            setTournaments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)).filter(t => t.status !== 'removed'));
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleBlock = async (id: string, current: boolean) => {
        if (window.confirm(current ? t('manager.tournaments.confirmUnblock') : t('manager.tournaments.confirmBlock'))) {
            try {
                await toggleTournamentBlock(id, !current, user?.uid || '');
                setTournaments(prev => prev.map(t => t.id === id ? { ...t, isBlocked: !current } : t));
            } catch (error) {
                alert(t('manager.tournaments.actionError'));
            }
        }
    };

    const handleRemove = async (id: string) => {
        if (window.confirm(t('manager.tournaments.confirmRemove'))) {
            try {
                await removeTournament(id, user?.uid || '');
                setTournaments(prev => prev.filter(t => t.id !== id));
            } catch (error) {
                alert(t('manager.tournaments.removeError'));
            }
        }
    };

    if (loading) return <div className="animate-pulse flex flex-col space-y-4">
        <div className="h-10 bg-white/5 rounded-2xl w-1/4"></div>
        <div className="h-64 bg-white/5 rounded-[2rem] w-full"></div>
    </div>;

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-black text-white tracking-tight">{t('manager.tournaments.title')}</h1>
                <p className="text-gray-400 mt-1">{t('manager.tournaments.subtitle')}</p>
            </div>

            <div className="bg-[#1f1f1f] border border-white/5 rounded-[2rem] overflow-hidden">
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b border-white/5 bg-white/5">
                            <th className="px-8 py-6 text-gray-400 font-bold text-xs uppercase tracking-widest">{t('manager.tournaments.tournament')}</th>
                            <th className="px-8 py-6 text-gray-400 font-bold text-xs uppercase tracking-widest">{t('manager.tournaments.club')}</th>
                            <th className="px-8 py-6 text-gray-400 font-bold text-xs uppercase tracking-widest text-center">{t('manager.tournaments.status')}</th>
                            <th className="px-8 py-6 text-gray-400 font-bold text-xs uppercase tracking-widest text-right">{t('manager.tournaments.actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {tournaments.map(tData => (
                            <tr key={tData.id} className="hover:bg-white/5 transition-colors group">
                                <td className="px-8 py-6">
                                    <div>
                                        <p className="text-white font-bold">{tData.name}</p>
                                        <p className="text-gray-500 text-xs">{tData.location} • {tData.date}</p>
                                    </div>
                                </td>
                                <td className="px-8 py-6 text-gray-400 font-medium">{tData.clubId?.substring(0, 8)}...</td>
                                <td className="px-8 py-6 text-center">
                                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                                        tData.isBlocked ? 'bg-red-500/10 text-red-500' : 'bg-tennis-green/10 text-tennis-green'
                                    }`}>
                                        {tData.isBlocked ? t('manager.tournaments.blocked') : (tData.status || t('manager.tournaments.active'))}
                                    </span>
                                </td>
                                <td className="px-8 py-6 text-right">
                                    <div className="flex justify-end gap-2">
                                        <button 
                                            onClick={() => handleBlock(tData.id, tData.isBlocked || false)}
                                            className={`p-3 rounded-xl transition-all ${
                                                tData.isBlocked 
                                                ? 'bg-tennis-green/10 text-tennis-green hover:bg-tennis-green hover:text-tennis-dark' 
                                                : 'bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white'
                                            }`}
                                        >
                                            {tData.isBlocked ? <Unlock size={18} /> : <Lock size={18} />}
                                        </button>
                                        <button 
                                            onClick={() => handleRemove(tData.id)}
                                            className="p-3 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl transition-all"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ManagerTournamentsPage;
