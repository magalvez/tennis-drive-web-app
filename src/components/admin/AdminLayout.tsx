import {
    Bell,
    CreditCard,
    LayoutDashboard,
    LogOut,
    Menu,
    Settings,
    Shield,
    Trophy,
    Users,
    X
} from 'lucide-react';
import { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { auth } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

const AdminLayout = () => {
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
        { icon: <LayoutDashboard size={20} />, label: t('adminTabs.dashboard'), path: '/admin' },
        { icon: <Trophy size={20} />, label: t('adminTabs.tournaments'), path: '/admin/tournaments' },
        { icon: <Users size={20} />, label: t('adminTabs.players'), path: '/admin/players' },
        { icon: <CreditCard size={20} />, label: t('adminTabs.payments'), path: '/admin/payments' },
        { icon: <Bell size={20} />, label: t('adminTabs.notifications'), path: '/admin/notifications' },
        { icon: <Shield size={20} />, label: t('adminTabs.admins'), path: '/admin/users/admins' },
        { icon: <Settings size={20} />, label: t('adminTabs.config'), path: '/admin/config' },
    ];

    return (
        <div className="min-h-screen bg-tennis-dark flex">
            {/* Sidebar */}
            <aside
                className={`${isSidebarOpen ? 'w-72' : 'w-20'
                    } bg-[#1f1f1f] border-r border-white/5 transition-all duration-300 flex flex-col z-30 fixed lg:static inset-y-0`}
            >
                <div className="p-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-tennis-green rounded-xl flex items-center justify-center">
                            <span className="text-tennis-dark font-black text-xl">T</span>
                        </div>
                        {isSidebarOpen && <span className="text-white font-bold text-lg tracking-tight">TennisDrive <span className="text-tennis-green">Admin</span></span>}
                    </div>
                </div>

                <nav className="flex-1 px-4 mt-8 space-y-2">
                    {menuItems.map((item) => (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`flex items-center gap-4 p-4 rounded-2xl transition-all ${(item.path === '/admin' ? location.pathname === '/admin' : location.pathname.startsWith(item.path))
                                ? 'bg-tennis-green text-tennis-dark font-bold'
                                : 'text-gray-400 hover:bg-white/5 hover:text-white'
                                }`}
                        >
                            {item.icon}
                            {isSidebarOpen && <span>{item.label}</span>}
                        </Link>
                    ))}
                </nav>

                <div className="p-4 border-t border-white/5">
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-4 w-full p-4 text-gray-400 hover:text-red-400 transition-colors rounded-2xl hover:bg-red-400/5 group"
                    >
                        <LogOut size={20} className="group-hover:rotate-12 transition-transform" />
                        {isSidebarOpen && <span>{t('auth.logout')}</span>}
                    </button>
                </div>
            </aside>

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

                        <button className="p-2 text-gray-400 hover:text-white relative">
                            <Bell size={20} />
                            <span className="absolute top-2 right-2 w-2 h-2 bg-tennis-green rounded-full border border-tennis-dark"></span>
                        </button>
                        <div className="h-8 w-[1px] bg-white/10 mx-2"></div>
                        <div className="flex items-center gap-3">
                            <div className="text-right hidden sm:block">
                                <p className="text-white text-sm font-bold">{user?.email}</p>
                                <p className="text-gray-500 text-[10px] uppercase font-bold tracking-widest">{t('common.admin')}</p>
                            </div>
                            <div className="w-10 h-10 bg-white/5 rounded-full border border-white/10 flex items-center justify-center uppercase font-bold text-tennis-green">
                                {user?.email?.charAt(0)}
                            </div>
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <div className="flex-1 p-8">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default AdminLayout;
