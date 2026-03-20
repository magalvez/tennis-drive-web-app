import {
    Bell,
    CreditCard,
    LayoutDashboard,
    LogOut,
    Menu,
    Settings,
    Trophy,
    MessageCircle,
    Building2,
    DollarSign,
    X
} from 'lucide-react';
import { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import logo from '../../assets/logo.png';
import { auth } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

const ManagerLayout = () => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { language, setLanguage, t } = useLanguage();

    const handleLogout = async () => {
        await auth.signOut();
        navigate('/login');
    };

    const menuItems = [
        { icon: <LayoutDashboard size={20} />, label: t('manager.dashboard.title'), path: '/manager' },
        { icon: <Building2 size={20} />, label: t('manager.clubs.title'), path: '/manager/clubs' },
        { icon: <CreditCard size={20} />, label: t('manager.plans.title'), path: '/manager/plans' },
        { icon: <DollarSign size={20} />, label: t('manager.billing.title'), path: '/manager/billing' },
        { icon: <Trophy size={20} />, label: t('manager.tournaments.title'), path: '/manager/tournaments' },
        { icon: <MessageCircle size={20} />, label: t('manager.chat.title'), path: '/manager/chat' },
        { icon: <Bell size={20} />, label: t('manager.notifications.title'), path: '/manager/notifications' },
        { icon: <Settings size={20} />, label: t('manager.settings.title'), path: '/manager/settings' },
    ];

    return (
        <div className="min-h-screen bg-tennis-dark flex">
            {/* Sidebar */}
            <aside
                className={`${isSidebarOpen ? 'w-72 translate-x-0' : 'w-20 lg:translate-x-0 -translate-x-full'
                    } bg-[#1f1f1f] border-r border-white/5 transition-all duration-300 flex flex-col z-30 fixed lg:sticky lg:top-0 inset-y-0 lg:h-screen`}
            >
                <div className={`p-6 flex items-center ${isSidebarOpen ? 'justify-between' : 'justify-center'}`}>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 overflow-hidden rounded-xl shrink-0">
                            <img src={logo} alt="Logo" className="w-full h-full object-cover" />
                        </div>
                        {isSidebarOpen && (
                            <span className="text-white font-bold text-lg tracking-tight whitespace-nowrap">
                                TennisDrive <span className="text-tennis-green">Manager</span>
                            </span>
                        )}
                    </div>
                </div>

                <nav className="flex-1 px-4 mt-8 space-y-2 overflow-y-auto custom-scrollbar">
                    {menuItems.map((item) => (
                        <Link
                            key={item.path}
                            to={item.path}
                            title={!isSidebarOpen ? item.label : ''}
                            className={`flex items-center ${isSidebarOpen ? 'gap-4 px-4' : 'justify-center'} py-4 rounded-2xl transition-all ${(item.path === '/manager' ? location.pathname === '/manager' : location.pathname.startsWith(item.path))
                                ? 'bg-tennis-green text-tennis-dark font-black shadow-lg shadow-tennis-green/10'
                                : 'text-gray-400 hover:bg-white/5 hover:text-white font-bold'
                                }`}
                        >
                            <div className="shrink-0">{item.icon}</div>
                            {isSidebarOpen && <span>{item.label}</span>}
                        </Link>
                    ))}
                </nav>

                <div className="p-4 border-t border-white/5 mt-auto">
                    <button
                        onClick={handleLogout}
                        className={`flex items-center ${isSidebarOpen ? 'gap-4 px-4' : 'justify-center'} w-full py-4 text-gray-400 hover:text-white transition-all rounded-2xl hover:bg-white/5 group`}
                    >
                        <div className="shrink-0">
                            <LogOut size={20} className="group-hover:translate-x-1 transition-transform" />
                        </div>
                        {isSidebarOpen && <span className="font-bold">{t('auth.logout')}</span>}
                    </button>
                </div>
            </aside>

            {/* Mobile Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-20 lg:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                ></div>
            )}

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-h-screen relative">
                {/* Header */}
                <header className="h-20 border-b border-white/5 bg-[#1a1a1a]/80 backdrop-blur-md sticky top-0 z-20 px-8 flex items-center justify-between">
                    <button
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className="p-2 text-gray-400 hover:text-white lg:hidden"
                    >
                        {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>

                    <div className="flex items-center gap-3 lg:ml-auto">
                        <div className="flex items-center bg-white/5 rounded-full p-1 border border-white/5 mr-2">
                            <button
                                onClick={() => setLanguage('en')}
                                className={`px-3 py-1 rounded-full text-[10px] font-black transition-all ${language === 'en' ? 'bg-tennis-green text-tennis-dark' : 'text-gray-500 hover:text-white'}`}
                            >
                                EN
                            </button>
                            <button
                                onClick={() => setLanguage('es')}
                                className={`px-3 py-1 rounded-full text-[10px] font-black transition-all ${language === 'es' ? 'bg-tennis-green text-tennis-dark' : 'text-gray-500 hover:text-white'}`}
                            >
                                ES
                            </button>
                        </div>

                        <div className="h-8 w-[1px] bg-white/10 mx-2"></div>
                        <div className="flex items-center gap-3">
                            <div className="text-right hidden sm:block">
                                <p className="text-white text-sm font-bold">{user?.email}</p>
                                <p className="text-gray-500 text-[10px] uppercase font-bold tracking-widest">Platform Manager</p>
                            </div>
                            <div className="w-10 h-10 bg-white/5 rounded-full border border-white/10 flex items-center justify-center uppercase font-bold text-tennis-green">
                                {user?.email?.charAt(0)}
                            </div>
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <div className="flex-1 p-8 overflow-auto">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default ManagerLayout;
