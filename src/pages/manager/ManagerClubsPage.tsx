import { useEffect, useState } from 'react';
import { Pause, Play, Search } from 'lucide-react';
import { getAllClubs, toggleClubStatus } from '../../services/managerService';
import { type ClubData } from '../../services/clubService';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

const ManagerClubsPage = () => {
    const { user } = useAuth();
    const { t } = useLanguage();
    const [clubs, setClubs] = useState<(ClubData & { id: string })[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

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

    const handleToggleStatus = async (id: string, current: string) => {
        const next = current === 'active' ? 'inactive' : 'active';
        if (window.confirm(t('manager.clubs.confirmToggle', { status: next }))) {
            try {
                await toggleClubStatus(id, next as any, user?.uid || '');
                setClubs(prev => prev.map(c => c.id === id ? { ...c, status: next as any } : c));
            } catch (error) {
                alert(t('manager.clubs.updateError') || 'Failed to update status');
            }
        }
    };

    const filtered = clubs.filter(c => 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        c.location.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) return <div className="animate-pulse flex space-y-4 flex-col">
        <div className="h-10 bg-white/5 rounded-2xl w-1/4"></div>
        <div className="h-64 bg-white/5 rounded-[2rem] w-full"></div>
    </div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight">{t('manager.clubs.title')}</h1>
                    <p className="text-gray-400 mt-1">{t('manager.clubs.subtitle')}</p>
                </div>
            </div>

            <div className="relative max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                <input
                    type="text"
                    placeholder={t('manager.clubs.searchPlaceholder') || "Search clubs..."}
                    className="w-full bg-[#1f1f1f] border border-white/5 rounded-2xl py-4 pl-12 pr-6 text-white focus:border-tennis-green/50 outline-none transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            <div className="bg-[#1f1f1f] border border-white/5 rounded-[2rem] overflow-hidden">
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b border-white/5 bg-white/5">
                            <th className="px-8 py-6 text-gray-400 font-bold text-xs uppercase tracking-widest">{t('manager.clubs.name')}</th>
                            <th className="px-8 py-6 text-gray-400 font-bold text-xs uppercase tracking-widest">{t('manager.clubs.location')}</th>
                            <th className="px-8 py-6 text-gray-400 font-bold text-xs uppercase tracking-widest">{t('manager.clubs.plan')}</th>
                            <th className="px-8 py-6 text-gray-400 font-bold text-xs uppercase tracking-widest">{t('manager.clubs.status')}</th>
                            <th className="px-8 py-6 text-gray-400 font-bold text-xs uppercase tracking-widest text-right">{t('manager.clubs.actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {filtered.map(club => (
                            <tr key={club.id} className="hover:bg-white/5 transition-colors group">
                                <td className="px-8 py-6">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center font-black text-tennis-green border border-white/5 uppercase">
                                            {club.name.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="text-white font-bold">{club.name}</p>
                                            <p className="text-gray-500 text-xs">{club.adminUid}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-8 py-6 text-gray-300 font-medium">{club.location}</td>
                                <td className="px-8 py-6">
                                    <span className="px-3 py-1 bg-white/5 rounded-full text-[10px] font-black text-tennis-green uppercase">
                                        {club.subscriptionPlan || 'Monthly'}
                                    </span>
                                </td>
                                <td className="px-8 py-6">
                                    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                                        club.status === 'active' ? 'bg-tennis-green/10 text-tennis-green' : 'bg-red-500/10 text-red-500'
                                    }`}>
                                        <div className={`w-1.5 h-1.5 rounded-full ${club.status === 'active' ? 'bg-tennis-green' : 'bg-red-500'}`}></div>
                                        {club.status === 'active' ? t('manager.clubs.active') : t('manager.clubs.inactive')}
                                    </div>
                                </td>
                                <td className="px-8 py-6 text-right">
                                    <button 
                                        onClick={() => handleToggleStatus(club.id, club.status)}
                                        className={`p-3 rounded-xl transition-all ${
                                            club.status === 'active' 
                                            ? 'bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white' 
                                            : 'bg-tennis-green/10 text-tennis-green hover:bg-tennis-green hover:text-tennis-dark'
                                        }`}
                                    >
                                        {club.status === 'active' ? <Pause size={18} /> : <Play size={18} />}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ManagerClubsPage;
