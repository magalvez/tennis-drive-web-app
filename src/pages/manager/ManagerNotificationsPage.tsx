import { useEffect, useState } from 'react';
import { Megaphone, Info, Building, ChevronDown, User, Search } from 'lucide-react';
import { sendBroadcastNotification, sendTargetedNotification, sendIndividualNotification } from '../../services/managerNotificationService';
import { getAllClubs, type ClubData } from '../../services/managerService';
import { searchUsers, type UserData } from '../../services/userService';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

const ManagerNotificationsPage = () => {
    const { user } = useAuth();
    const { t } = useLanguage();
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [clubs, setClubs] = useState<(ClubData & { id: string })[]>([]);
    const [targetType, setTargetType] = useState<'all' | 'club' | 'individual'>('all');
    const [targetClubId, setTargetClubId] = useState<string>('');
    const [targetUserId, setTargetUserId] = useState<string>('');
    const [userSearch, setUserSearch] = useState('');
    const [userResults, setUserResults] = useState<UserData[]>([]);
    const [sending, setSending] = useState(false);

    useEffect(() => {
        const fetchClubs = async () => {
            try {
                const data = await getAllClubs();
                setClubs(data);
                if (data.length > 0) setTargetClubId(data[0].id);
            } catch (error) {
                console.error("Failed to load clubs:", error);
            }
        };
        fetchClubs();
    }, []);

    useEffect(() => {
        if (userSearch.length >= 3) {
            const delayDebounceFn = setTimeout(async () => {
                const results = await searchUsers(userSearch);
                setUserResults(results);
            }, 500);
            return () => clearTimeout(delayDebounceFn);
        } else {
            setUserResults([]);
        }
    }, [userSearch]);

    const handleSend = async () => {
        if (!title || !body) return alert(t('manager.notifications.requiredFields') || 'Title and body required');
        
        let confirmMsg = '';
        if (targetType === 'all') confirmMsg = t('manager.notifications.confirmBroadcast');
        else if (targetType === 'club') confirmMsg = t('manager.notifications.confirmTargeted', { club: clubs.find(c => c.id === targetClubId)?.name });
        else if (targetType === 'individual') confirmMsg = t('manager.notifications.confirmIndividual', { user: userResults.find(u => u.uid === targetUserId)?.displayName || targetUserId });

        if (window.confirm(confirmMsg)) {
            setSending(true);
            try {
                if (targetType === 'all') {
                    await sendBroadcastNotification(title, body, user?.uid || '');
                } else if (targetType === 'club') {
                    await sendTargetedNotification(targetClubId, title, body, 'targeted', user?.uid || '');
                } else if (targetType === 'individual') {
                    await sendIndividualNotification(targetUserId, title, body, user?.uid || '');
                }
                alert(t('manager.notifications.sendSuccess') || 'Notification sent successfully');
                setTitle('');
                setBody('');
            } catch (error) {
                alert(t('manager.notifications.sendError') || 'Failed to send notification');
            } finally {
                setSending(false);
            }
        }
    };

    return (
        <div className="max-w-4xl space-y-8 pb-20">
            <div>
                <h1 className="text-3xl font-black text-white tracking-tight">{t('manager.notifications.title')}</h1>
                <p className="text-gray-400 mt-1">{t('manager.notifications.subtitle')}</p>
            </div>

            <div className="bg-[#1f1f1f] border border-white/5 rounded-[2rem] p-10 space-y-8 shadow-2xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-4">{t('manager.notifications.targetType')}</label>
                        <div className="flex bg-[#1a1a1a] p-1 rounded-2xl border border-white/5">
                            {(['all', 'club', 'individual'] as const).map((type) => (
                                <button
                                    key={type}
                                    onClick={() => setTargetType(type)}
                                    className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                                        targetType === type ? 'bg-tennis-green text-tennis-dark' : 'text-gray-500 hover:text-white'
                                    }`}
                                >
                                    {t(`manager.notifications.type.${type}`)}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-4">{t('manager.notifications.notificationTitle')}</label>
                        <input 
                            type="text" 
                            placeholder={t('manager.notifications.titlePlaceholder')}
                            className="w-full bg-[#1a1a1a] border border-white/5 rounded-2xl py-4 px-6 text-white text-lg font-bold outline-none focus:border-tennis-green/50 transition-all placeholder:text-gray-700"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                        />
                    </div>
                </div>

                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    {targetType === 'club' && (
                        <>
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-4">{t('manager.notifications.selectClub')}</label>
                            <div className="relative group">
                                <select 
                                    className="w-full bg-[#1a1a1a] border border-white/5 rounded-2xl py-4 px-6 text-white text-lg font-bold outline-none focus:border-tennis-green/50 transition-all appearance-none cursor-pointer"
                                    value={targetClubId}
                                    onChange={(e) => setTargetClubId(e.target.value)}
                                >
                                    {clubs.map(club => (
                                        <option key={club.id} value={club.id}>{club.name}</option>
                                    ))}
                                </select>
                                <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500 group-hover:text-tennis-green transition-colors">
                                    <ChevronDown size={20} />
                                </div>
                            </div>
                        </>
                    )}

                    {targetType === 'individual' && (
                        <>
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-4">{t('manager.notifications.searchPlayer')}</label>
                            <div className="relative">
                                <Search size={20} className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-500" />
                                <input 
                                    type="text" 
                                    placeholder={t('manager.notifications.searchPlaceholder')}
                                    className="w-full bg-[#1a1a1a] border border-white/5 rounded-2xl py-4 pl-14 pr-6 text-white font-bold outline-none focus:border-tennis-green/50 transition-all"
                                    value={userSearch}
                                    onChange={(e) => setUserSearch(e.target.value)}
                                />
                            </div>
                            
                            {userResults.length > 0 && (
                                <div className="grid grid-cols-1 gap-2 mt-4 bg-black/20 p-4 rounded-3xl border border-white/5">
                                    {userResults.map(u => (
                                        <button
                                            key={u.uid}
                                            onClick={() => {
                                                setTargetUserId(u.uid);
                                                setUserSearch(u.displayName || u.email);
                                                setUserResults([]);
                                            }}
                                            className={`flex items-center gap-4 p-4 rounded-xl transition-all ${
                                                targetUserId === u.uid ? 'bg-tennis-green text-tennis-dark' : 'bg-white/5 text-gray-400 hover:text-white'
                                            }`}
                                        >
                                            <User size={18} />
                                            <div className="text-left">
                                                <p className="font-bold text-sm">{u.displayName}</p>
                                                <p className="text-[10px] opacity-60 uppercase tracking-widest">{u.email}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>

                <div className="space-y-4">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-4">{t('manager.notifications.messageBody')}</label>
                    <textarea 
                        rows={4}
                        placeholder={t('manager.notifications.bodyPlaceholder')}
                        className="w-full bg-[#1a1a1a] border border-white/5 rounded-2xl py-4 px-6 text-white outline-none focus:border-tennis-green/50 transition-all placeholder:text-gray-700 resize-none"
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                    />
                </div>

                <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-4 border-t border-white/5">
                    <div className="flex items-center gap-3 text-gray-500">
                        <Info size={18} />
                        <span className="text-xs font-medium max-w-sm">
                            {targetType === 'all' && t('manager.notifications.broadcastDesc')}
                            {targetType === 'club' && t('manager.notifications.targetedDesc', { club: clubs.find(c => c.id === targetClubId)?.name })}
                            {targetType === 'individual' && t('manager.notifications.individualDesc')}
                        </span>
                    </div>
                    
                    <button 
                        onClick={handleSend}
                        disabled={sending}
                        className={`group flex items-center gap-3 px-10 py-5 rounded-2xl font-black text-lg transition-all ${
                            sending ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-tennis-green text-tennis-dark hover:scale-105 active:scale-95 shadow-xl shadow-tennis-green/20'
                        }`}
                    >
                        {sending ? t('manager.notifications.sending') : (
                            <>
                                <Megaphone size={24} className="group-hover:rotate-12 transition-transform" />
                                {targetType === 'all' ? t('manager.notifications.sendBroadcast') : 
                                 targetType === 'club' ? t('manager.notifications.sendToClub') : 
                                 t('manager.notifications.sendToPlayer')}
                            </>
                        )}
                    </button>
                </div>
            </div>
            
            <div className="bg-tennis-green/5 border border-tennis-green/10 rounded-3xl p-8 flex items-start gap-4">
                <Building className="text-tennis-green shrink-0" size={24} />
                <div>
                    <h4 className="text-white font-bold mb-1">{t('manager.notifications.targetedComm') || "Targeted Communication"}</h4>
                    <p className="text-gray-400 text-sm">{t('manager.notifications.targetedCommDesc')}</p>
                </div>
            </div>
        </div>
    );
};

export default ManagerNotificationsPage;
