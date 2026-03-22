import { useEffect, useState, useRef } from 'react';
import { MessageSquare, Send, User, Plus, Search, X, Building } from 'lucide-react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { 
    subscribeToManagerMessages, 
    sendManagerMessage, 
    getOrCreateManagerChat, 
    resetUnreadCount,
    closeManagerChat,
    subscribeToChatHead
} from '../../services/managerChatService';
import { getAllClubs, type ClubData } from '../../services/managerService';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

const ManagerChatPage = () => {
    const { user } = useAuth();
    const { t } = useLanguage();
    const [chats, setChats] = useState<any[]>([]);
    const [activeChat, setActiveChat] = useState<any>(null);
    const [messages, setMessages] = useState<any[]>([]);
    const [text, setText] = useState('');
    const [showNewChatModal, setShowNewChatModal] = useState(false);
    const [clubs, setClubs] = useState<(ClubData & { id: string })[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [activeTab, setActiveTab] = useState<'active' | 'closed'>('active');

    useEffect(() => {
        if (!user) return;
        const q = query(
            collection(db, "manager_chats"),
            where("managerId", "==", user.uid),
            where("status", "==", activeTab),
            orderBy("lastMessageAt", "desc")
        );
        return onSnapshot(q, (snapshot) => {
            setChats(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
    }, [user, activeTab]);

    useEffect(() => {
        if (!activeChat) return;
        resetUnreadCount(activeChat.id, 'manager');
        
        const unsubMessages = subscribeToManagerMessages(activeChat.id, (msgs) => {
            setMessages(msgs);
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        });

        const unsubHead = subscribeToChatHead(activeChat.id, (data) => {
            setActiveChat((prev: any) => prev?.id === data.id ? { ...prev, ...data } : prev);
        });

        return () => {
            unsubMessages();
            unsubHead();
        };
    }, [activeChat?.id]);

    useEffect(() => {
        if (showNewChatModal) {
            getAllClubs().then(setClubs).catch(console.error);
        }
    }, [showNewChatModal]);

    const handleSend = async () => {
        if (!text.trim() || !activeChat || activeChat.status === 'closed') return;
        const msg = text;
        setText('');
        await sendManagerMessage(activeChat.id, user?.uid || '', 'manager', msg);
    };

    const handleCloseChat = async () => {
        if (!activeChat) return;
        if (window.confirm(t('manager.chat.confirmClose') || 'Are you sure you want to close this session?')) {
            await closeManagerChat(activeChat.id);
            setActiveChat(null);
        }
    };

    const startChat = async (club: ClubData & { id: string }) => {
        try {
            const chatId = await getOrCreateManagerChat(user?.uid || '', club.adminUid, club.id, club.name);
            setActiveTab('active');
            setActiveChat({ id: chatId, clubId: club.id, adminId: club.adminUid, clubName: club.name, status: 'active' });
            setShowNewChatModal(false);
        } catch (error) {
            alert(t('manager.chat.startChatError') || 'Failed to start chat');
        }
    };

    const filteredClubs = clubs.filter(c => 
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        c.location.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const isClosed = activeChat?.status === 'closed';

    return (
        <div className="h-[calc(100vh-12rem)] flex gap-6 relative">
            {/* Chat List */}
            <div className="w-80 bg-[#1f1f1f] border border-white/5 rounded-[2rem] flex flex-col overflow-hidden shadow-2xl">
                <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                    <h2 className="text-white font-black text-xl tracking-tight">{t('manager.chat.support')}</h2>
                    <button 
                        onClick={() => setShowNewChatModal(true)}
                        className="w-10 h-10 rounded-xl bg-tennis-green text-tennis-dark flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg shadow-tennis-green/10"
                    >
                        <Plus size={20} />
                    </button>
                </div>

                <div className="flex p-2 gap-2 bg-black/20 mx-4 mt-4 rounded-2xl">
                    <button 
                        onClick={() => setActiveTab('active')}
                        className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                            activeTab === 'active' ? 'bg-tennis-green text-tennis-dark shadow-lg shadow-tennis-green/10' : 'text-gray-500 hover:text-white'
                        }`}
                    >
                        {t('manager.chat.tabs.active')}
                    </button>
                    <button 
                        onClick={() => setActiveTab('closed')}
                        className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                            activeTab === 'closed' ? 'bg-tennis-green text-tennis-dark shadow-lg shadow-tennis-green/10' : 'text-gray-500 hover:text-white'
                        }`}
                    >
                        {t('manager.chat.tabs.closed')}
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                    {chats.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4 opacity-30">
                            <MessageSquare size={40} className="text-gray-500" />
                            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">
                                {activeTab === 'active' ? t('manager.chat.noActiveSessions') : (t('manager.chat.noClosedSessions') || 'No closed sessions')}
                            </p>
                            {activeTab === 'active' && (
                                <button 
                                    onClick={() => setShowNewChatModal(true)}
                                    className="text-[10px] font-black text-tennis-green border border-tennis-green/20 px-4 py-2 rounded-lg hover:bg-tennis-green/5 transition-colors"
                                >
                                    {t('manager.chat.startFirstChat')}
                                </button>
                            )}
                        </div>
                    ) : (
                        chats.map(chat => (
                            <button 
                                key={chat.id}
                                onClick={() => setActiveChat(chat)}
                                className={`w-full p-4 rounded-2xl flex items-center gap-4 transition-all group ${
                                    activeChat?.id === chat.id ? 'bg-tennis-green text-tennis-dark shadow-lg shadow-tennis-green/10' : 'text-gray-400 hover:bg-white/5 hover:text-white'
                                } ${chat.status === 'closed' ? 'opacity-50' : ''}`}
                            >
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                                    activeChat?.id === chat.id ? 'bg-black/20' : 'bg-[#1a1a1a] group-hover:bg-tennis-green/10 group-hover:text-tennis-green'
                                } shadow-inner`}>
                                    {chat.status === 'closed' ? <X size={20} /> : <User size={20} />}
                                </div>
                                <div className="text-left overflow-hidden flex-1">
                                    <div className="flex items-center justify-between">
                                        <p className="font-bold text-sm truncate">{chat.clubName || `Admin ${chat.clubId.substring(0, 8)}`}</p>
                                        {chat.status === 'closed' && (
                                            <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-black/20 text-black/40">
                                                {t('manager.chat.statusClosed') || 'Closed'}
                                            </span>
                                        )}
                                    </div>
                                    <p className={`text-[10px] truncate leading-relaxed ${activeChat?.id === chat.id ? 'text-tennis-dark/60' : 'text-gray-500'}`}>
                                        {chat.lastMessage || t('manager.chat.openSession')}
                                    </p>
                                </div>
                                {chat.unreadCountManager > 0 && activeChat?.id !== chat.id && chat.status !== 'closed' && (
                                    <div className="w-2 h-2 rounded-full bg-tennis-green shadow-sm shadow-tennis-green/50 animate-pulse" />
                                )}
                            </button>
                        ))
                    )}
                </div>
            </div>

            {/* Chat Content */}
            <div className="flex-1 bg-[#1f1f1f] border border-white/5 rounded-[2rem] flex flex-col overflow-hidden shadow-2xl">
                {activeChat ? (
                    <>
                        <div className="p-6 border-b border-white/5 bg-white/[0.03] flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-tennis-green/10 flex items-center justify-center text-tennis-green shadow-inner">
                                    <Building size={24} />
                                </div>
                                <div>
                                    <h3 className="text-white font-black tracking-tight">{activeChat.clubName || t('manager.chat.adminSupport')}</h3>
                                    <div className="flex items-center gap-2">
                                        <p className={`text-[10px] font-black uppercase tracking-widest ${isClosed ? 'text-red-500/60' : 'text-tennis-green/60'}`}>
                                            {isClosed ? (t('manager.chat.statusClosed') || 'Closed') : (t('manager.chat.activeSession'))}
                                        </p>
                                        {isClosed && <span className="w-1 h-1 rounded-full bg-red-500/30" />}
                                    </div>
                                </div>
                            </div>

                            {!isClosed && (
                                <button 
                                    onClick={handleCloseChat}
                                    className="px-4 py-2 rounded-xl bg-red-500/10 text-red-500 text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all flex items-center gap-2"
                                >
                                    <X size={14} />
                                    {t('manager.chat.closeSession') || 'Close Session'}
                                </button>
                            )}
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar bg-[#1a1a1a]/50">
                            {messages.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center opacity-20 italic text-white text-sm">
                                    {t('manager.chat.noMessages')}
                                </div>
                            ) : (
                                messages.map((m, i) => (
                                    <div key={i} className={`flex ${m.senderRole === 'manager' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-md p-5 rounded-[1.5rem] text-sm font-bold leading-relaxed shadow-lg ${
                                            m.senderRole === 'manager' 
                                                ? 'bg-tennis-green text-tennis-dark rounded-br-none shadow-tennis-green/5' 
                                                : 'bg-[#262626] text-white border border-white/5 rounded-bl-none'
                                        }`}>
                                            {m.content}
                                        </div>
                                    </div>
                                ))
                            )}
                            {isClosed && (
                                <div className="flex justify-center py-4">
                                    <div className="bg-white/5 border border-white/5 rounded-2xl px-6 py-3 flex items-center gap-3 text-gray-500 text-xs font-bold uppercase tracking-widest italic">
                                        <X size={16} />
                                        {t('manager.chat.sessionClosed') || 'This session has been closed.'}
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        <div className={`p-8 border-t border-white/5 bg-white/[0.02] flex gap-4 ${isClosed ? 'opacity-30 grayscale pointer-events-none' : ''}`}>
                            <input 
                                type="text" 
                                className="flex-1 bg-[#1a1a1a] border border-white/5 rounded-2xl py-4 px-6 text-white text-lg font-bold outline-none focus:border-tennis-green/50 transition-all placeholder:text-gray-700 disabled:cursor-not-allowed"
                                placeholder={isClosed ? (t('manager.chat.closedPlaceholder') || 'Chat closed') : (t('manager.chat.typePlaceholder') || "Type your message...")}
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                disabled={isClosed}
                            />
                            <button 
                                onClick={handleSend}
                                disabled={isClosed || !text.trim()}
                                className="bg-tennis-green text-tennis-dark min-w-[64px] rounded-2xl flex items-center justify-center hover:scale-105 transition-all active:scale-95 shadow-xl shadow-tennis-green/10 disabled:opacity-50 disabled:hover:scale-100"
                            >
                                <Send size={24} />
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-10">
                        <div className="w-32 h-32 rounded-[3rem] bg-white/[0.02] border border-white/5 flex items-center justify-center text-gray-800 mb-8">
                            <MessageSquare size={64} />
                        </div>
                        <h3 className="font-black text-3xl text-white tracking-tight mb-2 uppercase italic">{t('manager.chat.selectSession')}</h3>
                        <p className="text-gray-500 max-w-xs text-sm font-medium">{t('manager.chat.selectSessionDesc')}</p>
                        <button 
                            onClick={() => setShowNewChatModal(true)}
                            className="mt-8 bg-white/5 text-tennis-green border border-tennis-green/20 px-8 py-4 rounded-2xl font-black hover:bg-tennis-green hover:text-tennis-dark transition-all"
                        >
                            {t('manager.chat.startNewSupport')}
                        </button>
                    </div>
                )}
            </div>

            {/* New Chat Modal */}
            {showNewChatModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowNewChatModal(false)} />
                    <div className="relative w-full max-w-lg bg-[#1f1f1f] border border-white/10 rounded-[3rem] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-8 border-b border-white/5 flex items-center justify-between">
                            <div>
                                <h3 className="text-white font-black text-2xl tracking-tight">{t('manager.chat.newChat')}</h3>
                                <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mt-1">{t('manager.chat.selectAdmin')}</p>
                            </div>
                            <button onClick={() => setShowNewChatModal(false)} className="text-gray-500 hover:text-white transition-colors">
                                <X size={24} />
                            </button>
                        </div>
                        
                        <div className="p-4 bg-black/20">
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                                <input 
                                    type="text"
                                    placeholder={t('manager.chat.searchPlaceholder') || "Search clubs or locations..."}
                                    className="w-full bg-[#1a1a1a] border border-white/5 rounded-xl py-3 pl-12 pr-4 text-white text-sm outline-none focus:border-tennis-green/50 transition-all font-bold"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar max-h-96">
                            {filteredClubs.length === 0 ? (
                                <p className="text-center text-gray-500 py-10 font-bold uppercase tracking-widest text-[10px]">{t('manager.chat.noClubs')}</p>
                            ) : (
                                filteredClubs.map(club => (
                                    <button 
                                        key={club.id}
                                        onClick={() => startChat(club)}
                                        className="w-full p-5 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center gap-4 hover:border-tennis-green/30 hover:bg-tennis-green/5 transition-all group"
                                    >
                                        <div className="w-10 h-10 rounded-xl bg-black/40 flex items-center justify-center text-gray-500 group-hover:text-tennis-green">
                                            <Building size={20} />
                                        </div>
                                        <div className="text-left">
                                            <p className="text-white font-black tracking-tight">{club.name}</p>
                                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{club.location}</p>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManagerChatPage;
