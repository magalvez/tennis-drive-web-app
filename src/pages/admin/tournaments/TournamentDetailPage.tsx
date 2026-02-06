import {
    ArrowLeft,
    Bell,
    Calendar,
    CheckCircle,
    ChevronRight,
    DollarSign,
    Edit,
    Flag,
    MapPin,
    Save,
    Settings,
    Trash2,
    Trophy,
    Users,
    X,
    AlertTriangle,
    RefreshCw,
    MessageCircle,
    Scan
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLanguage } from '../../../context/LanguageContext';
import { sendTournamentAnnouncement } from '../../../services/notificationService';
import {
    deleteTournament,
    getTournamentById,
    getTournamentMatches,
    getTournamentPlayers,
    updateTournament,
} from '../../../services/tournamentService';
import type { ScoringConfig, TournamentData } from '../../../services/types';

const TournamentDetailPage = () => {
    const { id } = useParams<{ id: string }>();
    const { t } = useLanguage();
    const navigate = useNavigate();
    const [tournament, setTournament] = useState<TournamentData | null>(null);
    const [players, setPlayers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [matchCount, setMatchCount] = useState(0);
    const [updating, setUpdating] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // Modals
    const [showCommModal, setShowCommModal] = useState(false);
    const [showScoringModal, setShowScoringModal] = useState(false);
    const [showQRModal, setShowQRModal] = useState(false); // Check-in QR
    const [commTitle, setCommTitle] = useState('');
    const [commBody, setCommBody] = useState('');
    const [sending, setSending] = useState(false);

    // Chat Settings State
    const [showChatModal, setShowChatModal] = useState(false);
    const [chatEnabled, setChatEnabled] = useState(true);
    const [chatReadOnly, setChatReadOnly] = useState(false);

    const [localScoring, setLocalScoring] = useState<ScoringConfig>({
        win: 50,
        loss: 10,
        withdraw: 5
    });

    const [infoModal, setInfoModal] = useState<{
        open: boolean;
        title: string;
        message: string;
        type: 'error' | 'success';
    }>({ open: false, title: '', message: '', type: 'error' });

    const showInfo = (title: string, message: string, type: 'error' | 'success' = 'error') => {
        setInfoModal({ open: true, title, message, type });
    };

    useEffect(() => {
        if (id) fetchTournament();
    }, [id]);

    const fetchTournament = async () => {
        if (!id) return;
        try {
            const [data, pData, matches] = await Promise.all([
                getTournamentById(id),
                getTournamentPlayers(id),
                getTournamentMatches(id)
            ]);
            setTournament(data);
            setPlayers(pData);
            setMatchCount(matches.length);
            if (data?.scoringConfig) {
                setLocalScoring(data.scoringConfig);
            }
            // Initialize Chat Settings (default to true/false if undefined)
            setChatEnabled(data?.isChatEnabled !== false); // Default enabled if undefined
            setChatReadOnly(data?.isChatReadOnly === true); // Default writable if undefined
        } catch (error) {
            console.error(error);
            showInfo(t('common.error'), t('admin.tournaments.fetchError'));
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteClick = () => {
        setShowDeleteModal(true);
    };

    const handleConfirmDelete = async () => {
        if (!id) return;
        setDeleting(true);
        try {
            await deleteTournament(id);
            navigate('/admin/tournaments');
        } catch (error) {
            showInfo(t('common.error'), t('common.error'));
            setDeleting(false);
            setShowDeleteModal(false);
        }
    };

    const handleUpdateStatus = async (newStatus: 'upcoming' | 'active' | 'completed') => {
        if (!id || !tournament) return;
        setUpdating(true);
        try {
            await updateTournament(id, { status: newStatus });
            setTournament({ ...tournament, status: newStatus });
        } catch (error) {
            showInfo(t('common.error'), t('common.error'));
        } finally {
            setUpdating(false);
        }
    };

    const handleSendComm = async () => {
        if (!commTitle.trim() || !commBody.trim() || !id) return;
        setSending(true);
        try {
            const playerUids = players.map(p => p.uid);
            const count = await sendTournamentAnnouncement(id, playerUids, commTitle, commBody);
            showInfo(t('common.success'), `Sent to ${count} players with active push tokens!`, 'success');
            setShowCommModal(false);
            setCommTitle('');
            setCommBody('');
        } catch (error) {
            showInfo(t('common.error'), "Failed to send notifications");
        } finally {
            setSending(false);
        }
    };

    const handleSaveScoring = async () => {
        if (!id || !tournament) return;
        setUpdating(true);
        try {
            await updateTournament(id, { scoringConfig: localScoring });
            setTournament({ ...tournament, scoringConfig: localScoring });
            setShowScoringModal(false);
            showInfo(t('common.success'), "Scoring configuration updated!", 'success');
        } catch (error) {
            showInfo(t('common.error'), t('common.error'));
            setUpdating(false);
        }
    };

    const handleSaveChatSettings = async () => {
        if (!id || !tournament) return;
        setUpdating(true);
        try {
            await updateTournament(id, {
                isChatEnabled: chatEnabled,
                isChatReadOnly: chatReadOnly
            });
            setTournament({
                ...tournament,
                isChatEnabled: chatEnabled,
                isChatReadOnly: chatReadOnly
            });
            setShowChatModal(false);
            showInfo(t('common.success'), t('config.success'), 'success');
        } catch (error) {
            showInfo(t('common.error'), t('common.error'));
        } finally {
            setUpdating(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-tennis-green"></div>
            </div>
        );
    }

    if (!tournament) return <div className="text-white">Tournament not found</div>;

    const ActionCard = ({ title, desc, icon: Icon, onClick, color = "tennis-green" }: any) => (
        <div
            onClick={onClick}
            className="glass p-8 rounded-3xl group cursor-pointer hover:border-white/20 transition-all flex items-center justify-between"
        >
            <div className="flex items-center gap-6">
                <div className={`w-16 h-16 bg-${color}/10 rounded-2xl flex items-center justify-center text-${color}`}>
                    <Icon size={32} />
                </div>
                <div>
                    <h3 className="text-white text-xl font-bold group-hover:text-white transition-colors">{title}</h3>
                    <p className="text-gray-500 mt-1">{desc}</p>
                </div>
            </div>
            <ChevronRight className="text-gray-700 group-hover:text-white transition-all transform group-hover:translate-x-1" size={24} />
        </div>
    );

    return (
        <div className="space-y-10 animate-fade-in max-w-7xl mx-auto pb-20">
            {/* Nav & Utility Actions */}
            <div className="flex justify-between items-center">
                <button
                    onClick={() => navigate('/admin/tournaments')}
                    className="flex items-center gap-2 text-gray-400 hover:text-white font-bold transition-colors uppercase tracking-widest text-xs"
                >
                    <ArrowLeft size={16} />
                    {t('admin.tournaments.goBack')}
                </button>
                <div className="flex gap-4">
                    <button
                        onClick={() => navigate(`/admin/tournaments/${id}/edit`)}
                        className="p-3 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-all"
                    >
                        <Edit size={20} />
                    </button>
                    <button
                        onClick={handleDeleteClick}
                        className="p-3 bg-red-500/10 hover:bg-red-500/20 rounded-xl text-red-500 transition-all"
                    >
                        <Trash2 size={20} />
                    </button>
                </div>
            </div>

            {/* Hero Header */}
            <div className="flex flex-col xl:flex-row gap-10 items-start">
                <div className="flex-1 space-y-6">
                    <div>
                        <div className="flex items-center gap-4 mb-4">
                            <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${tournament.status === 'upcoming'
                                ? 'bg-tennis-green/10 text-tennis-green'
                                : tournament.status === 'active'
                                    ? 'bg-red-500/10 text-red-500 animate-pulse'
                                    : 'bg-white/10 text-gray-400'
                                }`}>
                                {t(`tournaments.status.${tournament.status}`)}
                            </span>
                        </div>
                        <h1 className="text-white text-6xl font-black tracking-tighter uppercase leading-tight">{tournament.name}</h1>
                        <p className="text-gray-400 text-xl font-medium mt-4 max-w-2xl">{t('admin.tournaments.manageHeroDesc')}</p>
                    </div>

                    <div className="flex flex-wrap gap-8 py-4 border-y border-white/5">
                        <div className="flex items-center gap-3">
                            <Calendar className="text-tennis-green" size={20} />
                            <span className="text-white font-bold">{tournament.date}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <MapPin className="text-tennis-green" size={20} />
                            <span className="text-white font-bold">{tournament.location}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <DollarSign className="text-tennis-green" size={20} />
                            <span className="text-white font-bold">${tournament.entryFee} {t('tournaments.entryFee')}</span>
                        </div>
                    </div>

                    {/* Status Changer */}
                    <div className="bg-white/5 p-2 rounded-2xl inline-flex gap-2">
                        <button
                            disabled={updating}
                            onClick={() => handleUpdateStatus('upcoming')}
                            className={`px-6 py-3 rounded-xl text-xs font-black uppercase transition-all ${tournament.status === 'upcoming' ? 'bg-tennis-green text-tennis-dark' : 'text-gray-500 hover:text-white'}`}
                        >
                            {t('admin.tournaments.statusActions.upcomingTitle').replace('?', '')}
                        </button>
                        <button
                            disabled={updating}
                            onClick={() => handleUpdateStatus('active')}
                            className={`px-6 py-3 rounded-xl text-xs font-black uppercase transition-all ${tournament.status === 'active' ? 'bg-red-500 text-white' : 'text-gray-500 hover:text-white'}`}
                        >
                            {t('admin.tournaments.statusActions.activeTitle').replace('?', '')}
                        </button>
                        <button
                            disabled={updating}
                            onClick={() => handleUpdateStatus('completed')}
                            className={`px-6 py-3 rounded-xl text-xs font-black uppercase transition-all ${tournament.status === 'completed' ? 'bg-blue-500 text-white' : 'text-gray-500 hover:text-white'}`}
                        >
                            {t('admin.tournaments.statusActions.completedTitle').replace('?', '')}
                        </button>
                    </div>
                </div>

                {/* Quick Stats Grid */}
                <div className="grid grid-cols-2 gap-4 w-full xl:w-96">
                    <div className="glass p-6 rounded-3xl flex flex-col items-center justify-center text-center">
                        <Users className="text-tennis-green mb-3" size={24} />
                        <span className="text-white text-3xl font-black">{players.length}</span>
                        <span className="text-gray-500 text-[10px] font-bold uppercase mt-1">{t('admin.tournaments.playersRegistered')}</span>
                    </div>
                    <div className="glass p-6 rounded-3xl flex flex-col items-center justify-center text-center">
                        <Trophy className="text-blue-400 mb-3" size={24} />
                        <span className="text-white text-3xl font-black">{matchCount}</span>
                        <span className="text-gray-500 text-[10px] font-bold uppercase mt-1">{t('admin.tournaments.matchesScheduled')}</span>
                    </div>
                    <div className="glass p-6 rounded-3xl flex flex-col col-span-2 items-center justify-center text-center border-tennis-green/20">
                        <div className="flex items-center gap-2 text-tennis-green mb-1">
                            <CheckCircle size={16} />
                            <span className="text-[10px] font-black uppercase tracking-widest">{t('admin.tournaments.readyDraw')}</span>
                        </div>
                        <p className="text-gray-400 text-xs font-medium">{t('admin.tournaments.allOperational')}</p>
                    </div>
                </div>
            </div>

            {/* Action Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ActionCard
                    title={t('admin.tournaments.managePlayers')}
                    desc={t('admin.tournaments.managePlayersDesc')}
                    icon={Users}
                    color="tennis-green"
                    onClick={() => navigate(`/admin/tournaments/${id}/players`)}
                />
                <ActionCard
                    title={tournament.status === 'upcoming' ? t('admin.tournaments.generateDraw') : t('admin.tournaments.matchCenterLive')}
                    desc={tournament.status === 'upcoming' ? t('admin.tournaments.generateDrawDesc') : t('admin.tournaments.matchCenterDesc')}
                    icon={Trophy}
                    color="blue-400"
                    onClick={() => navigate(`/admin/tournaments/${id}/matches`)}
                />
                <ActionCard
                    title={t('admin.tournaments.communicationCenter')}
                    desc={t('admin.tournaments.communicationCenterDesc')}
                    icon={Bell}
                    color="orange-400"
                    onClick={() => setShowCommModal(true)}
                />
                <ActionCard
                    title={t('admin.tournaments.scoring.title')}
                    desc={t('admin.tournaments.scoring.subtitle')}
                    icon={Settings}
                    color="gray-400"
                    onClick={() => setShowScoringModal(true)}
                />
                <ActionCard
                    title={t('admin.tournaments.chat.title')}
                    desc={t('admin.tournaments.chat.subtitle')}
                    icon={MessageCircle}
                    color="purple-400"
                    onClick={() => setShowChatModal(true)}
                />
                <ActionCard
                    title={t('admin.tournaments.checkIn.title') || "Check-In QR"}
                    desc={t('admin.tournaments.checkIn.desc') || "Player Check-In Code"}
                    icon={Scan}
                    color="pink-400"
                    onClick={() => setShowQRModal(true)}
                />
            </div>

            {/* Modal: Communication Center */}
            {showCommModal && (
                <>
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-40 transition-opacity" onClick={() => setShowCommModal(false)}></div>
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
                        <div className="bg-gray-950 border border-white/10 w-full max-w-lg rounded-[40px] p-12 space-y-8 animate-scale-in">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h2 className="text-white text-3xl font-black uppercase tracking-tight">{t('admin.notifications.blastMsg')}</h2>
                                    <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mt-1">{t('admin.notifications.notifyCount', { count: players.length })}</p>
                                </div>
                                <button onClick={() => setShowCommModal(false)} className="w-12 h-12 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center text-gray-500 transition-all">
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="space-y-6">
                                <div className="space-y-4">
                                    <label className="text-gray-500 text-[10px] font-black uppercase tracking-widest ml-1">{t('admin.notifications.inputTitle')}</label>
                                    <input
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-white font-bold focus:outline-none focus:border-orange-500/50"
                                        placeholder={t('admin.notifications.phTitle')}
                                        value={commTitle}
                                        onChange={e => setCommTitle(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-4">
                                    <label className="text-gray-500 text-[10px] font-black uppercase tracking-widest ml-1">{t('admin.notifications.inputBody')}</label>
                                    <textarea
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-white font-medium focus:outline-none focus:border-orange-500/50 min-h-[120px] resize-none"
                                        placeholder={t('admin.notifications.phBody')}
                                        value={commBody}
                                        onChange={e => setCommBody(e.target.value)}
                                    />
                                </div>
                                <button
                                    onClick={handleSendComm}
                                    disabled={sending || !commTitle.trim() || !commBody.trim()}
                                    className="w-full bg-orange-500 text-white py-6 rounded-3xl font-black uppercase tracking-widest shadow-2xl shadow-orange-500/20 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                                >
                                    {sending ? <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-white"></div> : <Flag size={24} />}
                                    {t('admin.notifications.sendBlast')}
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Modal: Scoring Config */}
            {showScoringModal && (
                <>
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-40 transition-opacity" onClick={() => setShowScoringModal(false)}></div>
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
                        <div className="bg-gray-950 border border-white/10 w-full max-w-lg rounded-[40px] p-12 space-y-8 animate-scale-in">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h2 className="text-white text-3xl font-black uppercase tracking-tight">{t('admin.tournaments.scoring.rewardStrategy')}</h2>
                                    <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mt-1">{t('admin.tournaments.scoring.overrides')}</p>
                                </div>
                                <button onClick={() => setShowScoringModal(false)} className="w-12 h-12 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center text-gray-500 transition-all">
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="space-y-6">
                                <div className="grid grid-cols-1 gap-6">
                                    <div className="space-y-4">
                                        <label className="text-gray-500 text-[10px] font-black uppercase tracking-widest ml-1">{t('admin.tournaments.scoring.pointsWin')}</label>
                                        <input
                                            type="number"
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-white font-black text-2xl focus:outline-none focus:border-tennis-green/50"
                                            value={localScoring.win}
                                            onChange={e => setLocalScoring({ ...localScoring, win: Number(e.target.value) })}
                                        />
                                    </div>
                                    <div className="space-y-4">
                                        <label className="text-gray-500 text-[10px] font-black uppercase tracking-widest ml-1">{t('admin.tournaments.scoring.pointsLoss')}</label>
                                        <input
                                            type="number"
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-white font-black text-2xl focus:outline-none focus:border-tennis-green/50"
                                            value={localScoring.loss}
                                            onChange={e => setLocalScoring({ ...localScoring, loss: Number(e.target.value) })}
                                        />
                                    </div>
                                    <div className="space-y-4">
                                        <label className="text-gray-500 text-[10px] font-black uppercase tracking-widest ml-1">{t('admin.tournaments.scoring.pointsWithdraw')}</label>
                                        <input
                                            type="number"
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-white font-black text-2xl focus:outline-none focus:border-tennis-green/50"
                                            value={localScoring.withdraw}
                                            onChange={e => setLocalScoring({ ...localScoring, withdraw: Number(e.target.value) })}
                                        />
                                    </div>
                                </div>
                                <button
                                    onClick={handleSaveScoring}
                                    disabled={updating}
                                    className="w-full bg-tennis-green text-tennis-dark py-6 rounded-3xl font-black uppercase tracking-widest shadow-2xl transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                                >
                                    {updating ? <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-tennis-dark"></div> : <Save size={24} />}
                                    {t('admin.tournaments.scoring.apply')}
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Modal: Chat Settings */}
            {showChatModal && (
                <>
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-40 transition-opacity" onClick={() => setShowChatModal(false)}></div>
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
                        <div className="bg-gray-950 border border-white/10 w-full max-w-lg rounded-[40px] p-12 space-y-8 animate-scale-in">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h2 className="text-white text-3xl font-black uppercase tracking-tight">{t('admin.tournaments.chat.title')}</h2>
                                    <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mt-1">{t('admin.tournaments.chat.subtitle')}</p>
                                </div>
                                <button onClick={() => setShowChatModal(false)} className="w-12 h-12 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center text-gray-500 transition-all">
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="space-y-6">
                                {/* Toggle: Enable Chat */}
                                <div
                                    onClick={() => setChatEnabled(!chatEnabled)}
                                    className={`p-6 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${chatEnabled ? 'bg-tennis-green/10 border-tennis-green' : 'bg-white/5 border-white/10'}`}
                                >
                                    <div>
                                        <h3 className={`font-bold ${chatEnabled ? 'text-tennis-green' : 'text-gray-400'}`}>{t('admin.tournaments.chat.enableLobby')}</h3>
                                        <p className="text-gray-500 text-xs mt-1">{t('admin.tournaments.chat.enableLobbyDesc')}</p>
                                    </div>
                                    <div className={`w-12 h-6 rounded-full p-1 transition-colors ${chatEnabled ? 'bg-tennis-green' : 'bg-gray-600'}`}>
                                        <div className={`w-4 h-4 rounded-full bg-black shadow-md transform transition-transform ${chatEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
                                    </div>
                                </div>

                                {/* Toggle: Read Only */}
                                <div
                                    onClick={() => setChatReadOnly(!chatReadOnly)}
                                    className={`p-6 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${chatReadOnly ? 'bg-orange-500/10 border-orange-500' : 'bg-white/5 border-white/10'}`}
                                >
                                    <div>
                                        <h3 className={`font-bold ${chatReadOnly ? 'text-orange-500' : 'text-gray-400'}`}>{t('admin.tournaments.chat.readOnly')}</h3>
                                        <p className="text-gray-500 text-xs mt-1">{t('admin.tournaments.chat.readOnlyDesc')}</p>
                                    </div>
                                    <div className={`w-12 h-6 rounded-full p-1 transition-colors ${chatReadOnly ? 'bg-orange-500' : 'bg-gray-600'}`}>
                                        <div className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform ${chatReadOnly ? 'translate-x-6' : 'translate-x-0'}`}></div>
                                    </div>
                                </div>

                                <button
                                    onClick={handleSaveChatSettings}
                                    disabled={updating}
                                    className="w-full bg-white text-tennis-dark py-6 rounded-3xl font-black uppercase tracking-widest shadow-2xl transition-all flex items-center justify-center gap-3 disabled:opacity-50 hover:bg-gray-200"
                                >
                                    {updating ? <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-tennis-dark"></div> : <Save size={24} />}
                                    {t('admin.tournaments.chat.save')}
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Modal: Check-In QR */}
            {showQRModal && (
                <>
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-40 transition-opacity" onClick={() => setShowQRModal(false)}></div>
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
                        <div className="bg-gray-950 border border-white/10 w-full max-w-lg rounded-[40px] p-12 space-y-8 animate-scale-in">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h2 className="text-white text-3xl font-black uppercase tracking-tight">{t('admin.tournaments.checkIn.modalTitle') || "Tournament Check-In"}</h2>
                                    <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mt-1">{t('admin.tournaments.checkIn.modalDesc') || "Scan to check in"}</p>
                                </div>
                                <button onClick={() => setShowQRModal(false)} className="w-12 h-12 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center text-gray-500 transition-all">
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="flex justify-center items-center flex-col gap-6">
                                <div className="p-4 bg-white rounded-3xl">
                                    <QRCodeCanvas
                                        value={JSON.stringify({
                                            type: 'CHECK_IN',
                                            tournamentId: tournament?.id || '',
                                            tournamentName: tournament?.name || 'Tournament'
                                        })}
                                        size={250}
                                        level={'H'}
                                    />
                                </div>
                                <p className="text-gray-400 text-sm text-center max-w-xs">{t('admin.tournaments.checkIn.instruction') || "Players can scan this code from their app to confirm attendance."}</p>
                            </div>
                        </div>
                    </div>
                </>
            )}
            {showDeleteModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-fade-in">
                    <div className="glass max-w-md w-full p-8 rounded-[32px] border-white/10 text-center space-y-6 shadow-2xl transform scale-100 transition-all">
                        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto text-red-500 mb-2">
                            <AlertTriangle size={32} />
                        </div>

                        <div className="space-y-2">
                            <h3 className="text-white text-2xl font-bold">{t('admin.tournaments.delete')}</h3>
                            <p className="text-gray-400 leading-relaxed">
                                {t('admin.tournaments.deleteConfirm')}
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-2">
                            <button
                                onClick={() => setShowDeleteModal(false)}
                                className="py-4 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-bold transition-colors"
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                onClick={handleConfirmDelete}
                                disabled={deleting}
                                className="py-4 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-bold transition-colors flex items-center justify-center gap-2"
                            >
                                {deleting ? (
                                    <RefreshCw size={20} className="animate-spin" />
                                ) : (
                                    t('admin.tournaments.delete')
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Generic Info/Error Modal */}
            {infoModal.open && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-6 animate-fade-in">
                    <div className="glass max-w-sm w-full p-8 rounded-[32px] border-white/10 text-center space-y-6 shadow-2xl">
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-2 ${infoModal.type === 'error' ? 'bg-red-500/10 text-red-500' : 'bg-tennis-green/10 text-tennis-green'}`}>
                            {infoModal.type === 'error' ? <AlertTriangle size={32} /> : <CheckCircle size={32} />}
                        </div>
                        <h3 className="text-white text-xl font-bold">{infoModal.title}</h3>
                        <p className="text-gray-400">{infoModal.message}</p>
                        <button
                            onClick={() => setInfoModal(prev => ({ ...prev, open: false }))}
                            className="w-full py-4 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold transition-colors"
                        >
                            {t('common.close')}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TournamentDetailPage;
