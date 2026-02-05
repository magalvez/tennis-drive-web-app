import {
    Search,
    Shield,
    Trash2,
    UserPlus,
    Users,
    X
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import type { UserData } from '../../services/userService';
import { getAdmins, promoteUserByEmail, removeAdminRole } from '../../services/userService';

const ManageAdminsPage = () => {
    const { t } = useLanguage();
    const [admins, setAdmins] = useState<UserData[]>([]);
    const [loading, setLoading] = useState(true);
    const [email, setEmail] = useState('');
    const [promoting, setPromoting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchAdmins();
    }, []);

    const fetchAdmins = async () => {
        setLoading(true);
        try {
            const data = await getAdmins();
            setAdmins(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handlePromote = async () => {
        if (!email.trim()) return;
        setPromoting(true);
        try {
            await promoteUserByEmail(email.trim().toLowerCase());
            setEmail('');
            fetchAdmins();
            alert("User promoted to admin successfully!");
        } catch (error: any) {
            if (error.message === 'User not found') {
                alert("User not found in the database. Ask them to register first.");
            } else if (error.message === 'Manual users cannot be admins') {
                alert("Only registered users with accounts can be admins.");
            } else {
                alert("Failed to promote user.");
            }
        } finally {
            setPromoting(false);
        }
    };

    const handleDemote = async (uid: string, name: string) => {
        if (!window.confirm(`Are you sure you want to remove ${name} from the admin team?`)) return;
        try {
            await removeAdminRole(uid);
            fetchAdmins();
            alert("Admin role removed.");
        } catch (error) {
            alert("Failed to remove admin role.");
        }
    };

    const filteredAdmins = admins.filter(a =>
        a.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading && admins.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-tennis-green"></div>
            </div>
        );
    }

    return (
        <div className="space-y-10 animate-fade-in max-w-4xl mx-auto pb-20">
            {/* Header */}
            <div>
                <h1 className="text-white text-4xl font-black uppercase tracking-tight">{t('admin.admins.faculty')}</h1>
                <p className="text-gray-500 font-bold uppercase text-[10px] tracking-widest mt-1">{t('admin.admins.privileges')}</p>
            </div>

            {/* Promotion Card */}
            <div className="glass p-10 rounded-[40px] border-white/5 space-y-8">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-tennis-green/10 rounded-2xl flex items-center justify-center text-tennis-green">
                        <UserPlus size={24} />
                    </div>
                    <div>
                        <h2 className="text-white text-xl font-bold">{t('admin.admins.promoteNew')}</h2>
                        <p className="text-gray-500 text-xs font-medium mt-1">{t('admin.admins.promoteDesc')}</p>
                    </div>
                </div>

                <div className="flex gap-4">
                    <input
                        className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-6 py-4 font-bold focus:outline-none focus:border-tennis-green/50 placeholder:text-gray-700"
                        placeholder="user@example.com"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        onKeyPress={e => e.key === 'Enter' && handlePromote()}
                    />
                    <button
                        onClick={handlePromote}
                        disabled={promoting || !email.trim()}
                        className="bg-tennis-green hover:bg-tennis-green/90 text-tennis-dark px-10 py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-tennis-green/20 transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                        {promoting ? <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-tennis-dark"></div> : <Shield size={18} />}
                        {t('admin.admins.promoteBtn')}
                    </button>
                </div>
            </div>

            {/* List Section */}
            <div className="space-y-6">
                <div className="flex items-center justify-between px-4">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-white">
                            <Users size={20} />
                        </div>
                        <h3 className="text-white text-xl font-bold uppercase tracking-tight">{t('admin.admins.currentAdmins')}</h3>
                    </div>

                    {/* Search inside the list area */}
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-tennis-green transition-colors" size={16} />
                        <input
                            className="bg-white/5 border border-white/5 rounded-full pl-12 pr-6 py-2.5 text-xs placeholder:text-gray-600 focus:outline-none focus:border-tennis-green/20 w-64 transition-all"
                            placeholder={t('admin.admins.filterAdmins')}
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                    {filteredAdmins.map((admin) => (
                        <div
                            key={admin.uid}
                            className="glass p-6 rounded-[28px] border-white/5 flex items-center justify-between hover:border-white/10 transition-all group"
                        >
                            <div className="flex items-center gap-6">
                                <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center group-hover:bg-tennis-green/10 transition-colors">
                                    <div className="text-white font-black text-xl group-hover:text-tennis-green">
                                        {admin.displayName?.charAt(0) || admin.email.charAt(0)}
                                    </div>
                                </div>
                                <div>
                                    <h4 className="text-white font-black text-lg">{admin.displayName || 'Unnamed User'}</h4>
                                    <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mt-1">{admin.email}</p>
                                </div>
                            </div>

                            <button
                                onClick={() => handleDemote(admin.uid, admin.displayName)}
                                className="w-12 h-12 bg-red-500/5 hover:bg-red-500/10 text-red-500/40 hover:text-red-500 rounded-xl flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                            >
                                <Trash2 size={20} />
                            </button>
                        </div>
                    ))}

                    {filteredAdmins.length === 0 && (
                        <div className="bg-white/2 p-20 rounded-[40px] border border-dashed border-white/5 flex flex-col items-center justify-center text-center">
                            <Shield size={40} className="text-gray-700 mb-4" />
                            <p className="text-gray-600 font-bold uppercase text-[10px] tracking-widest">{t('admin.admins.noFound')}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Warning Note */}
            <div className="bg-red-500/5 border border-red-500/10 p-6 rounded-3xl flex items-start gap-4">
                <X size={20} className="text-red-500 mt-0.5" />
                <div>
                    <h5 className="text-red-500 font-black uppercase text-xs tracking-widest">{t('admin.admins.advisoryTitle')}</h5>
                    <p className="text-red-500/60 text-xs font-medium mt-1 leading-relaxed">
                        {t('admin.admins.advisoryBody')}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ManageAdminsPage;
