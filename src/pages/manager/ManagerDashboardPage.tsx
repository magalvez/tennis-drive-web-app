import { useEffect, useState } from 'react';
import { Bell, Building2, CreditCard, DollarSign, TrendingUp, Trophy, Users } from 'lucide-react';
import { getAllClubs, getRevenueAnalytics } from '../../services/managerService';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';

const ManagerDashboardPage = () => {
    const navigate = useNavigate();
    const { t } = useLanguage();
    const [stats, setStats] = useState({
        activeClubs: 0,
        totalRevenue: 0,
        pendingRevenue: 0,
        billingCount: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [analytics, clubs] = await Promise.all([
                    getRevenueAnalytics(),
                    getAllClubs()
                ]);
                
                setStats({
                    activeClubs: clubs.filter(c => c.status === 'active').length,
                    totalRevenue: analytics.totalRevenue,
                    pendingRevenue: analytics.pendingRevenue,
                    billingCount: analytics.billingCount
                });
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const cards = [
        { title: t('manager.dashboard.activeClubs'), value: stats.activeClubs, icon: <Building2 className="text-tennis-green" />, sub: t('manager.dashboard.registeredClubs'), path: '/manager/clubs' },
        { title: t('manager.dashboard.totalRevenue'), value: `$${stats.totalRevenue.toLocaleString()}`, icon: <DollarSign className="text-tennis-green" />, sub: t('manager.dashboard.copTotal'), path: '/manager/billing' },
        { title: t('manager.dashboard.pendingBilling'), value: `$${stats.pendingRevenue.toLocaleString()}`, icon: <TrendingUp className="text-red-500" />, sub: t('manager.dashboard.toBeCollected'), path: '/manager/billing' },
        { title: t('manager.dashboard.totalInvoices'), value: stats.billingCount, icon: <CreditCard className="text-tennis-green" />, sub: t('manager.dashboard.lifetimeCount'), path: '/manager/billing' },
    ];

    if (loading) {
        return <div className="flex justify-center items-center h-full">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-tennis-green"></div>
        </div>;
    }

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-black text-white tracking-tight">{t('manager.dashboard.title')}</h1>
                <p className="text-gray-400 mt-1">{t('manager.dashboard.subtitle')}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {cards.map((card, i) => (
                    <div 
                        key={i} 
                        onClick={() => card.path && navigate(card.path)}
                        className={`bg-[#1f1f1f] border border-white/5 p-6 rounded-3xl hover:border-tennis-green/30 transition-all group ${card.path ? 'cursor-pointer active:scale-95' : ''}`}
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-white/5 rounded-2xl group-hover:scale-110 transition-transform">
                                {card.icon}
                            </div>
                        </div>
                        <h3 className="text-gray-400 text-sm font-bold uppercase tracking-wider">{card.title}</h3>
                        <p className="text-3xl font-black text-white mt-1">{card.value}</p>
                        <p className="text-xs text-gray-500 mt-2 font-medium">{card.sub}</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-[#1f1f1f] border border-white/5 p-8 rounded-[2rem]">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-black text-white">{t('manager.dashboard.quickActions')}</h2>
                        <span className="text-[10px] font-black text-tennis-green bg-tennis-green/10 px-3 py-1 rounded-full uppercase tracking-widest">{t('manager.dashboard.tools')}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-4">
                        <button 
                            onClick={() => navigate('/manager/notifications')}
                            className="flex flex-col items-center justify-center p-6 bg-white/5 rounded-2xl hover:bg-tennis-green hover:text-tennis-dark transition-all group border border-white/5 hover:border-transparent active:scale-95 shadow-xl hover:shadow-tennis-green/10"
                        >
                            <Bell className="mb-2 group-hover:rotate-12 transition-transform" />
                            <span className="font-bold text-[10px] uppercase tracking-wider text-center">{t('manager.dashboard.broadcast')}</span>
                        </button>
                        <button 
                            onClick={() => navigate('/manager/clubs')}
                            className="flex flex-col items-center justify-center p-6 bg-white/5 rounded-2xl hover:bg-tennis-green hover:text-tennis-dark transition-all group border border-white/5 hover:border-transparent active:scale-95 shadow-xl hover:shadow-tennis-green/10"
                        >
                            <Users className="mb-2 group-hover:-translate-y-1 transition-transform" />
                            <span className="font-bold text-[10px] uppercase tracking-wider text-center">{t('manager.dashboard.clubs')}</span>
                        </button>
                        <button 
                            onClick={() => navigate('/manager/billing')}
                            className="flex flex-col items-center justify-center p-6 bg-white/5 rounded-2xl hover:bg-tennis-green hover:text-tennis-dark transition-all group border border-white/5 hover:border-transparent active:scale-95 shadow-xl hover:shadow-tennis-green/10"
                        >
                            <DollarSign className="mb-2 group-hover:scale-110 transition-transform" />
                            <span className="font-bold text-[10px] uppercase tracking-wider text-center">{t('manager.billing.title')}</span>
                        </button>
                        <button 
                            onClick={() => navigate('/manager/settings')}
                            className="flex flex-col items-center justify-center p-6 bg-white/5 rounded-2xl hover:bg-tennis-green hover:text-tennis-dark transition-all group border border-white/5 hover:border-transparent active:scale-95 shadow-xl hover:shadow-tennis-green/10"
                        >
                            <CreditCard className="mb-2 group-hover:scale-110 transition-transform" />
                            <span className="font-bold text-[10px] uppercase tracking-wider text-center">{t('manager.dashboard.epayco')}</span>
                        </button>
                    </div>
                </div>

                <div className="bg-[#1f1f1f] border border-white/5 p-8 rounded-[2rem] flex flex-col justify-center items-center text-center">
                    <Trophy size={48} className="text-tennis-green mb-4 opacity-5" />
                    <h3 className="text-white font-bold">{t('manager.dashboard.platformOverview')}</h3>
                    <p className="text-gray-500 text-sm mt-2 max-w-xs text-balance leading-relaxed">
                        {t('manager.dashboard.sidebarNav')}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ManagerDashboardPage;
