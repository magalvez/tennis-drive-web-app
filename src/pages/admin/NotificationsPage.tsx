import {
    Bell,
    Check,
    RefreshCw,
    Search,
    Send,
    Users,
    X
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { UserWithToken } from '../../services/notificationService';
import { getUsersWithTokens, sendPushNotification, sendPushNotificationsBatch } from '../../services/notificationService';

const NotificationsPage = () => {
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [loading, setLoading] = useState(false);

    // Target Selection
    const [showUserSelector, setShowUserSelector] = useState(false);
    const [allUsers, setAllUsers] = useState<UserWithToken[]>([]);
    const [filteredUsers, setFilteredUsers] = useState<UserWithToken[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedUser, setSelectedUser] = useState<UserWithToken | null>(null);
    const [fetchingUsers, setFetchingUsers] = useState(false);

    useEffect(() => {
        if (showUserSelector) {
            fetchUsers();
        }
    }, [showUserSelector]);

    const fetchUsers = async () => {
        setFetchingUsers(true);
        try {
            const data = await getUsersWithTokens();
            setAllUsers(data);
            setFilteredUsers(data);
        } catch (error) {
            console.error(error);
        } finally {
            setFetchingUsers(false);
        }
    };

    const handleSearch = (q: string) => {
        setSearchQuery(q);
        const filtered = allUsers.filter(u =>
            u.displayName.toLowerCase().includes(q.toLowerCase()) ||
            u.email.toLowerCase().includes(q.toLowerCase())
        );
        setFilteredUsers(filtered);
    };

    const handleSend = async () => {
        if (!title.trim() || !body.trim()) {
            alert("Title and Message are required");
            return;
        }

        setLoading(true);
        try {
            if (selectedUser) {
                await sendPushNotification(selectedUser.pushToken, title, body);
                alert(`Direct notification sent to ${selectedUser.displayName}`);
            } else {
                const tokens = allUsers.length > 0 ? allUsers.map(u => u.pushToken) : (await getUsersWithTokens()).map(u => u.pushToken);
                if (tokens.length === 0) {
                    alert("No active audience found (no users with push tokens).");
                    return;
                }
                await sendPushNotificationsBatch(tokens, title, body);
                alert(`Broadcast sent to ${tokens.length} users successfully!`);
            }
            setTitle('');
            setBody('');
            setSelectedUser(null);
        } catch (error) {
            alert("Failed to send notification");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-10 animate-fade-in pb-20">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-white text-4xl font-extrabold uppercase tracking-tight">Notification Center</h1>
                    <p className="text-gray-500 font-bold uppercase text-[10px] tracking-widest mt-1">Broadcast Alerts & Direct Messages</p>
                </div>
            </div>

            {/* Target Selection Pills */}
            <div className="flex gap-3 bg-white/5 p-2 rounded-2xl w-fit">
                <button
                    onClick={() => setSelectedUser(null)}
                    className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${!selectedUser ? 'bg-tennis-green text-tennis-dark' : 'text-gray-500 hover:text-white'}`}
                >
                    Broadcast
                </button>
                <button
                    onClick={() => setShowUserSelector(true)}
                    className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedUser ? 'bg-blue-500 text-white' : 'text-gray-500 hover:text-white'}`}
                >
                    {selectedUser ? `To: ${selectedUser.displayName}` : 'Specific Player'}
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
                {/* Composition Card */}
                <div className="lg:col-span-3 glass p-10 rounded-[40px] border-white/5 space-y-8 h-fit">
                    <div className="flex items-center gap-6">
                        <div className={`w-16 h-16 rounded-3xl flex items-center justify-center ${selectedUser ? 'bg-blue-500/10 text-blue-500' : 'bg-tennis-green/10 text-tennis-green'}`}>
                            {selectedUser ? <Users size={32} /> : <Bell size={32} />}
                        </div>
                        <div>
                            <h2 className="text-white text-2xl font-black uppercase tracking-tight">
                                {selectedUser ? "Direct Message" : "Broadcast Alert"}
                            </h2>
                            <p className="text-gray-500 text-xs font-bold uppercase tracking-widest leading-none mt-1">
                                Sending to: <span className={selectedUser ? "text-blue-400" : "text-tennis-green"}>
                                    {selectedUser ? selectedUser.displayName : "Global Audience"}
                                </span>
                            </p>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="space-y-3">
                            <label className="text-gray-500 text-[10px] font-black uppercase tracking-widest ml-1">Push Title</label>
                            <input
                                className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-white font-bold focus:outline-none focus:border-white/20 transition-all"
                                placeholder="Finals starting soon! 🎾"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                            />
                        </div>
                        <div className="space-y-3">
                            <label className="text-gray-500 text-[10px] font-black uppercase tracking-widest ml-1">Message Content</label>
                            <textarea
                                className="w-full bg-white/5 border border-white/10 rounded-3xl p-6 text-white font-medium focus:outline-none focus:border-white/20 transition-all min-h-[160px] resize-none"
                                placeholder="Don't miss the upcoming matches at Center Court..."
                                value={body}
                                onChange={e => setBody(e.target.value)}
                            />
                        </div>
                    </div>

                    <button
                        onClick={handleSend}
                        disabled={loading}
                        className={`w-full py-6 rounded-3xl font-black uppercase tracking-widest shadow-2xl transition-all flex items-center justify-center gap-3 disabled:opacity-50 ${selectedUser ? 'bg-blue-500 text-white shadow-blue-500/20' : 'bg-tennis-green text-tennis-dark shadow-tennis-green/20'}`}
                    >
                        {loading ? <RefreshCw className="animate-spin" size={24} /> : (
                            <>
                                <Send size={24} />
                                {selectedUser ? "Direct Send" : "Send Broadcast"}
                            </>
                        )}
                    </button>
                </div>

                {/* Preview / Tips */}
                <div className="lg:col-span-2 space-y-8">
                    <div className="glass p-8 rounded-[32px] border-dashed border-2 border-white/5 space-y-6">
                        <h3 className="text-white font-bold uppercase tracking-tight flex items-center gap-2">
                            <Check size={18} className="text-tennis-green" />
                            Push Best Practices
                        </h3>
                        <ul className="space-y-4 text-xs font-medium text-gray-500">
                            <li className="flex gap-3">
                                <span className="text-tennis-green font-black">01</span>
                                Keep it short and actionable. The goal is to get players back into the app.
                            </li>
                            <li className="flex gap-3">
                                <span className="text-tennis-green font-black">02</span>
                                Use emojis sparingly but effectively to increase click-through rates.
                            </li>
                            <li className="flex gap-3">
                                <span className="text-tennis-green font-black">03</span>
                                Global broadcasts reach EVERY player who has enabled notifications. Use wisely.
                            </li>
                        </ul>
                    </div>

                    {/* Quick Mockup Preview */}
                    <div className="bg-black p-10 rounded-[48px] border-4 border-white/10 shadow-2xl relative overflow-hidden flex flex-col items-center">
                        <div className="w-20 h-1.5 bg-white/10 rounded-full mb-10" />

                        <div className="w-full bg-white/10 backdrop-blur-xl p-4 rounded-2xl border border-white/10 space-y-2">
                            <div className="flex justify-between items-center opacity-40">
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 bg-tennis-green rounded flex items-center justify-center text-[10px] text-tennis-dark font-black">T</div>
                                    <span className="text-[10px] font-bold">Tennis Drive</span>
                                </div>
                                <span className="text-[10px]">now</span>
                            </div>
                            <p className="text-white font-bold text-xs leading-none">{title || "Your notification title..."}</p>
                            <p className="text-gray-300 text-[10px] leading-tight line-clamp-2">{body || "The message content will appear here globally on your users' lock screens."}</p>
                        </div>

                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-32 h-1 bg-white/10 rounded-full" />
                    </div>
                </div>
            </div>

            {/* Target Selector Drawer (Modal) */}
            {showUserSelector && (
                <>
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-40 transition-opacity" onClick={() => setShowUserSelector(false)}></div>
                    <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-gray-950 border-l border-white/10 z-50 p-12 overflow-y-auto transform transition-transform duration-300 animate-slide-in-right">
                        <div className="flex justify-between items-center mb-10">
                            <div>
                                <h2 className="text-white text-3xl font-black uppercase tracking-tight">Select Player</h2>
                                <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mt-1">Direct Message Targeted</p>
                            </div>
                            <button onClick={() => setShowUserSelector(false)} className="w-12 h-12 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center text-gray-500 transition-all">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl px-6 py-4 mb-8">
                            <Search size={20} className="text-gray-500" />
                            <input
                                className="bg-transparent border-none outline-none text-white font-bold w-full"
                                placeholder="Search by name or email..."
                                value={searchQuery}
                                onChange={e => handleSearch(e.target.value)}
                            />
                        </div>

                        <div className="space-y-3">
                            {fetchingUsers ? <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-tennis-green mx-auto mt-20" /> : (
                                filteredUsers.map(user => (
                                    <div
                                        key={user.uid}
                                        onClick={() => { setSelectedUser(user); setShowUserSelector(false); }}
                                        className="p-5 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/5 transition-all cursor-pointer flex items-center gap-4 group"
                                    >
                                        <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center text-white font-black group-hover:bg-tennis-green group-hover:text-tennis-dark transition-all">
                                            {user.displayName.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="text-white font-bold">{user.displayName}</p>
                                            <p className="text-gray-500 text-xs">{user.email}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default NotificationsPage;
