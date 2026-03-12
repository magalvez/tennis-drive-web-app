import {
    Activity,
    Building,
    CheckCircle2,
    Clock,
    DollarSign,
    LogOut,
    Ticket,
    Trophy,
    UserPlus,
    Users,
    Layers,
    ArrowLeft,
    Plus
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { subscribeToRecentActivities } from '../../services/activityService';
import { notifyPlayerApproved, notifyPlayerRejected } from '../../services/notificationService';
import { approveRegistration, rejectRegistration, subscribeToClubPendingRegistrations } from '../../services/registrationService';
import {
    approveCategoryRequest,
    type CategoryRequest,
    rejectCategoryRequest,
    subscribeToPendingRequests
} from '../../services/profileRequestService';
import { getTournamentMatches, getTournamentsByClub } from '../../services/tournamentService';
import type { TournamentData, TournamentPlayer } from '../../services/types';
import { getClubPlayers } from '../../services/userService';
import { getClubDoublesTeamsCount } from '../../services/doublesTeamService';
import { getClubById } from '../../services/clubService';

interface PendingRegistration {
    tournamentId: string;
    tournamentName: string;
    player: TournamentPlayer;
}

const StatCard = ({ icon, label, value, color }: { icon: React.ReactNode, label: string, value: string | number, color: string }) => (
    <div className="glass p-8 rounded-[32px] border-white/5 space-y-4">
        <div className={`w-12 h-12 rounded-2xl bg-${color}-500/10 flex items-center justify-center text-${color}-400`}>
            {icon}
        </div>
        <div>
            <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">{label}</p>
            <p className="text-white text-3xl font-black">{value}</p>
        </div>
    </div>
);

const DashboardPage = () => {
    const { managedClubId, user } = useAuth();
    const { t } = useLanguage();
    const [tournaments, setTournaments] = useState<TournamentData[]>([]);
    const [playersCount, setPlayersCount] = useState(0);
    const [matchesCount, setMatchesCount] = useState(0);
    const [teamsCount, setTeamsCount] = useState(0);
    const [clubName, setClubName] = useState('');
    const [pendingRegs, setPendingRegs] = useState<PendingRegistration[]>([]);
    const [pendingCategoryRequests, setPendingCategoryRequests] = useState<CategoryRequest[]>([]);
    const [recentActivities, setRecentActivities] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [rejectModal, setRejectModal] = useState<{ show: boolean, reg: PendingRegistration | null }>({ show: false, reg: null });
    const [rejectCatModal, setRejectCatModal] = useState<{ show: boolean, req: CategoryRequest | null }>({ show: false, req: null });
    const [rejectReason, setRejectReason] = useState('');



    useEffect(() => {
        if (!managedClubId) return;

        // One-time load for stats and tournaments list
        const loadInitial = async () => {
            try {
                const [tData, pData, tCount, cData] = await Promise.all([
                    getTournamentsByClub(managedClubId),
                    getClubPlayers(managedClubId),
                    getClubDoublesTeamsCount(managedClubId),
                    getClubById(managedClubId)
                ]);
                setTournaments(tData);
                setPlayersCount(pData.length);
                setTeamsCount(tCount);
                if (cData) setClubName(cData.name);

                let mCount = 0;
                for (const t of tData) {
                    if (t.id) {
                        const mData = await getTournamentMatches(t.id);
                        mCount += mData.length;
                    }
                }
                setMatchesCount(mCount);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        loadInitial();

        // Subscriptions for real-time parts
        const unsubRegs = subscribeToClubPendingRegistrations(managedClubId, (regs) => {
            setPendingRegs(regs);
        });

        const unsubActivity = subscribeToRecentActivities(10, managedClubId, (activities) => {
            setRecentActivities(activities);
        });

        const unsubCatRequests = subscribeToPendingRequests(managedClubId, (reqs) => {
            setPendingCategoryRequests(reqs);
        });

        return () => {
            unsubRegs();
            unsubActivity();
            unsubCatRequests();
        };
    }, [managedClubId]);

    const handleApprove = async (reg: PendingRegistration) => {
        if (!user?.uid) return;
        setProcessing(true);
        try {
            await approveRegistration(reg.tournamentId, reg.player.id, user.uid);
            const title = t('admin.notifications.automated.approved.title');
            const body = t('admin.notifications.automated.approved.body', {
                tournament: reg.tournamentName,
                category: reg.player.category ? t(`admin.tournaments.categories.${reg.player.category}`) : t('common.none')
            });
            await notifyPlayerApproved(reg.player.uid, title, body);
        } catch (error) {
            alert("Error approving registration");
        } finally {
            setProcessing(false);
        }
    };

    const handleReject = async () => {
        if (!user?.uid || !rejectModal.reg || !rejectReason) return;

        setProcessing(true);
        try {
            await rejectRegistration(rejectModal.reg.tournamentId, rejectModal.reg.player.id, user.uid, rejectReason);
            const title = t('admin.notifications.automated.rejected.title');
            const body = t('admin.notifications.automated.rejected.body', {
                tournament: rejectModal.reg.tournamentName,
                reason: rejectReason
            });
            await notifyPlayerRejected(rejectModal.reg.player.uid, title, body);
            setRejectModal({ show: false, reg: null });
            setRejectReason('');
        } catch (error) {
            console.error(error);
            alert("Error rejecting registration");
        } finally {
            setProcessing(false);
        }
    };

    const handleApproveCategory = async (req: CategoryRequest) => {
        if (!user?.uid) return;
        setProcessing(true);
        try {
            await approveCategoryRequest(req, user.uid);
            const title = t('admin.notifications.automated.approved.title');
            const body = t('admin.notifications.automated.approved.bodyCategory', {
                category: t(`admin.tournaments.categories.${req.requestedCategory.toLowerCase()}`)
            });
            await notifyPlayerApproved(req.userId, title, body);
        } catch (error) {
            console.error(error);
            alert("Error approving category request");
        } finally {
            setProcessing(false);
        }
    };

    const handleRejectCategory = async () => {
        if (!user?.uid || !rejectCatModal.req || !rejectReason) return;
        setProcessing(true);
        try {
            await rejectCategoryRequest(rejectCatModal.req.id, user.uid, rejectReason);
            const title = t('admin.notifications.automated.rejected.title');
            const body = t('admin.notifications.automated.rejected.bodyCategory', {
                category: t(`admin.tournaments.categories.${rejectCatModal.req.requestedCategory.toLowerCase()}`),
                reason: rejectReason
            });
            await notifyPlayerRejected(rejectCatModal.req.userId, title, body);
            setRejectCatModal({ show: false, req: null });
            setRejectReason('');
        } catch (error) {
            console.error(error);
            alert("Error rejecting category request");
        } finally {
            setProcessing(false);
        }
    };

    const getActivityColor = (type: string) => {
        switch (type) {
            case 'user_register': return 'blue';
            case 'tournament_join': return 'tennis-green';
            case 'tournament_withdraw': return 'red';
            case 'transaction': return 'yellow';
            case 'match_complete': return 'purple';
            case 'tournament_create': return 'orange';
            default: return 'gray';
        }
    };

    const getActivityIcon = (type: string) => {
        const size = 14;
        switch (type) {
            case 'user_register': return <UserPlus size={size} />;
            case 'tournament_join': return <Ticket size={size} />;
            case 'tournament_withdraw': return <LogOut size={size} />;
            case 'transaction': return <DollarSign size={size} />;
            case 'tournament_create': return <Trophy size={size} />;
            default: return <Activity size={size} />;
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-tennis-green"></div>
        </div>
    );

    return (
        <div className="space-y-10 animate-fade-in">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-white text-4xl font-extrabold uppercase tracking-tight">{t('adminTabs.dashboard')}</h1>
                    <p className="text-gray-500 font-bold uppercase text-[10px] tracking-widest mt-1">{t('dashboard.performanceOverview')}</p>
                </div>

                {clubName && (
                    <div className="flex items-center gap-3 bg-white/5 border border-white/5 px-6 py-3 rounded-2xl animate-fade-in mb-1">
                        <div className="w-8 h-8 rounded-xl bg-tennis-green/10 flex items-center justify-center text-tennis-green">
                            <Building size={16} />
                        </div>
                        <span className="text-white font-black uppercase tracking-widest text-[11px]">{clubName}</span>
                    </div>
                )}
            </div>

            {/* Quick Actions Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <a href="/admin/tournaments/create" className="glass p-6 rounded-[32px] border-white/5 hover:bg-white/[0.05] transition-all group">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-2xl bg-tennis-green/10 flex items-center justify-center text-tennis-green">
                            <Plus size={20} />
                        </div>
                        <div>
                            <p className="text-white font-bold text-sm group-hover:text-tennis-green transition-colors">{t('admin.actions.create')}</p>
                            <p className="text-gray-500 text-[10px] font-medium mt-0.5">{t('admin.actions.createDesc')}</p>
                        </div>
                    </div>
                </a>
                <a href="/admin/tournaments" className="glass p-6 rounded-[32px] border-white/5 hover:bg-white/[0.05] transition-all group">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                            <Clock size={20} />
                        </div>
                        <div>
                            <p className="text-white font-bold text-sm group-hover:text-blue-400 transition-colors">{t('admin.actions.schedule')}</p>
                            <p className="text-gray-500 text-[10px] font-medium mt-0.5">{t('admin.actions.scheduleDesc')}</p>
                        </div>
                    </div>
                </a>
                <a href="/admin/notifications" className="glass p-6 rounded-[32px] border-white/5 hover:bg-white/[0.05] transition-all group">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-2xl bg-yellow-500/10 flex items-center justify-center text-yellow-500">
                            <Activity size={20} />
                        </div>
                        <div>
                            <p className="text-white font-bold text-sm group-hover:text-yellow-500 transition-colors">{t('admin.actions.alerts')}</p>
                            <p className="text-gray-500 text-[10px] font-medium mt-0.5">{t('admin.actions.alertsDesc')}</p>
                        </div>
                    </div>
                </a>
                <a href="/admin/payments" className="glass p-6 rounded-[32px] border-white/5 hover:bg-white/[0.05] transition-all group">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-2xl bg-orange-500/10 flex items-center justify-center text-orange-400">
                            <DollarSign size={20} />
                        </div>
                        <div>
                            <p className="text-white font-bold text-sm group-hover:text-orange-400 transition-colors">{t('admin.actions.payments')}</p>
                            <p className="text-gray-500 text-[10px] font-medium mt-0.5">{t('admin.actions.paymentsDesc', { count: pendingRegs.length })}</p>
                        </div>
                    </div>
                </a>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    icon={<Trophy size={24} />}
                    label={t('dashboard.stats.tournaments')}
                    value={tournaments.filter(t => t.status === 'upcoming' || t.status === 'active').length}
                    color="tennis-green"
                />
                <StatCard
                    icon={<Users size={24} />}
                    label={t('dashboard.stats.players')}
                    value={playersCount}
                    color="blue"
                />
                <StatCard
                    icon={<CheckCircle2 size={24} />}
                    label={t('dashboard.stats.matches')}
                    value={matchesCount}
                    color="purple"
                />
                <StatCard
                    icon={<Layers size={24} />}
                    label={t('dashboard.stats.teams')}
                    value={teamsCount}
                    color="yellow"
                />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
                {/* Pending registrations */}
                <div className="xl:col-span-2 space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-white text-xl font-bold uppercase tracking-tight">
                            {t('dashboard.pendingRegistrations')} ({pendingRegs.length})
                        </h2>
                        <span className="bg-orange-500/10 text-orange-400 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-orange-500/10">
                            {pendingRegs.length} {t('dashboard.attentionNeeded')}
                        </span>
                    </div>

                    {pendingRegs.length === 0 ? (
                        <div className="glass p-12 rounded-[32px] border-white/5 flex flex-col items-center justify-center text-center opacity-40">
                            <CheckCircle2 size={40} className="text-gray-500 mb-4" />
                            <p className="text-gray-500 font-bold uppercase text-xs tracking-widest">{t('dashboard.inboxZero')}</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {pendingRegs.map(reg => (
                                <div key={reg.player.id} className="bg-orange-500/[0.03] p-8 rounded-[32px] border border-orange-500/10 space-y-8 flex flex-col justify-between transition-all hover:bg-orange-500/[0.05]">
                                    <div className="space-y-4">
                                        <div>
                                            <h3 className="text-white text-2xl font-black tracking-tight leading-tight">{reg.player.name}</h3>
                                            <p className="text-orange-400 font-bold uppercase text-xs tracking-widest mt-1.5">{reg.tournamentName}</p>
                                        </div>

                                        {(reg.player.category || reg.player.playerProfileCategory) && (
                                            <div className="flex items-center gap-2">
                                                <span className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">
                                                    {t('dashboard.yourCategory')}:
                                                </span>
                                                <div className="flex items-center gap-2 text-gray-300 text-xs font-bold">
                                                    {reg.player.playerProfileCategory ? t(`admin.tournaments.categories.${reg.player.playerProfileCategory}`) : '-'}
                                                    {reg.player.category && reg.player.category !== reg.player.playerProfileCategory && (
                                                        <>
                                                            <span className="text-orange-400">→</span>
                                                            <span className="text-tennis-green">{t(`admin.tournaments.categories.${reg.player.category}`)}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <button
                                            onClick={() => handleApprove(reg)}
                                            disabled={processing}
                                            className="bg-tennis-green hover:bg-tennis-green/90 text-tennis-dark py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-[0.98] disabled:opacity-50"
                                        >
                                            {t('common.approve')}
                                        </button>
                                        <button
                                            onClick={() => setRejectModal({ show: true, reg })}
                                            disabled={processing}
                                            className="bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-[0.98] disabled:opacity-50"
                                        >
                                            {t('common.reject')}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Pending Category Requests */}
                {pendingCategoryRequests.length > 0 && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-white text-xl font-bold uppercase tracking-tight">
                                {t('dashboard.categoryRequests')} ({pendingCategoryRequests.length})
                            </h2>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {pendingCategoryRequests.map(req => (
                                <div key={req.id} className="glass p-8 rounded-[32px] border-white/5 space-y-6 transition-all hover:bg-white/[0.02]">
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-1">
                                            <h3 className="text-white text-2xl font-black tracking-tight leading-tight">{req.userName}</h3>
                                            <div className="flex items-center gap-2">
                                                <span className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">{t(`admin.tournaments.categories.${req.currentCategory.toLowerCase()}`)}</span>
                                                <ArrowLeft size={12} className="text-gray-700 rotate-180" />
                                                <span className="text-tennis-green text-[10px] font-black uppercase tracking-widest">{t(`admin.tournaments.categories.${req.requestedCategory.toLowerCase()}`)}</span>
                                            </div>
                                        </div>
                                        <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-gray-500">
                                            <Users size={24} />
                                        </div>
                                    </div>

                                    <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                                        <p className="text-gray-500 text-[8px] font-black uppercase tracking-widest mb-1">{t('admin.tournaments.reason')}</p>
                                        <p className="text-gray-300 text-xs italic font-medium leading-relaxed">"{req.reason}"</p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 pt-2">
                                        <button
                                            onClick={() => handleApproveCategory(req)}
                                            disabled={processing}
                                            className="bg-tennis-green hover:bg-tennis-green/90 text-tennis-dark h-12 rounded-xl font-black text-xs uppercase tracking-widest transition-all active:scale-[0.98] disabled:opacity-50"
                                        >
                                            {t('common.approve')}
                                        </button>
                                        <button
                                            onClick={() => setRejectCatModal({ show: true, req })}
                                            disabled={processing}
                                            className="bg-white/5 hover:bg-red-500/10 hover:text-red-500 border border-white/10 h-12 rounded-xl font-black text-xs uppercase tracking-widest transition-all active:scale-[0.98] disabled:opacity-50"
                                        >
                                            {t('common.reject')}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Recent Activity */}
                <div className="space-y-6">
                    <h2 className="text-white text-xl font-bold uppercase tracking-tight">{t('dashboard.recentActivity')}</h2>
                    <div className="glass rounded-[32px] border-white/5 p-8 h-fit min-h-[400px]">
                        <div className="relative space-y-0">
                            {/* Vertical Line */}
                            <div className="absolute left-[15px] top-2 bottom-2 w-px bg-white/10" />

                            {recentActivities.map((activity, i) => {
                                const typeColor = getActivityColor(activity.type);
                                return (
                                    <div key={i} className="relative flex gap-6 pb-10 last:pb-0 group">
                                        {/* Icon Container */}
                                        <div className={`
                                            relative z-10 w-8 h-8 rounded-xl shrink-0 flex items-center justify-center transition-all duration-300 group-hover:scale-110 shadow-2xl
                                            ${typeColor === 'tennis-green' ? 'bg-tennis-green text-tennis-dark' :
                                                typeColor === 'blue' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/20' :
                                                    typeColor === 'red' ? 'bg-red-500/20 text-red-500 border border-red-500/20' :
                                                        typeColor === 'yellow' ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/20' :
                                                            typeColor === 'purple' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/20' :
                                                                typeColor === 'orange' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/20' :
                                                                    'bg-white/10 text-white'
                                            }
`}>
                                            {getActivityIcon(activity.type)}
                                        </div>

                                        <div className="space-y-1 pt-0.5">
                                            <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
                                                <h4 className="text-white text-sm font-bold group-hover:text-tennis-green transition-colors leading-tight">
                                                    {activity.title}
                                                </h4>
                                                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 border border-white/5">
                                                    <Clock size={8} className="text-gray-600" />
                                                    <span className="text-[9px] text-gray-500 font-black uppercase tracking-widest leading-none">
                                                        {activity.createdAt?.seconds
                                                            ? new Date(activity.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                                            : t('dashboard.justNow')
                                                        }
                                                    </span>
                                                </div>
                                            </div>
                                            <p className="text-gray-500 text-[11px] font-medium leading-relaxed max-w-xs">
                                                {activity.description}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* Rejection Modal */}
            {rejectModal.show && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm animate-fade-in">
                    <div className="glass w-full max-w-lg rounded-[40px] p-10 border-white/10 space-y-8 animate-scale-in">
                        <div className="space-y-2">
                            <h2 className="text-white text-3xl font-black uppercase tracking-tight">{t('common.reject')}</h2>
                            <p className="text-gray-400 font-medium">
                                {rejectModal.reg?.player.name} — <span className="text-orange-400">{rejectModal.reg?.tournamentName}</span>
                            </p>
                        </div>

                        <div className="space-y-4">
                            <textarea
                                className="w-full bg-white/5 border border-white/10 rounded-3xl p-6 text-white placeholder:text-gray-600 focus:outline-none focus:border-red-500/30 transition-all min-h-[120px] resize-none"
                                placeholder={t('admin.tournaments.rejectReasonPh')}
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                autoFocus
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => {
                                    setRejectModal({ show: false, reg: null });
                                    setRejectReason('');
                                }}
                                className="bg-white/5 hover:bg-white/10 text-gray-400 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-[0.98]"
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                onClick={handleReject}
                                disabled={processing || !rejectReason.trim()}
                                className="bg-red-500 hover:bg-red-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-[0.98] disabled:opacity-50"
                            >
                                {t('common.reject')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Rejection Modal for Category Requests */}
            {rejectCatModal.show && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm animate-fade-in">
                    <div className="glass w-full max-w-lg rounded-[40px] p-10 border-white/10 space-y-8 animate-scale-in">
                        <div className="space-y-2">
                            <h2 className="text-white text-3xl font-black uppercase tracking-tight">{t('common.reject')}</h2>
                            <p className="text-gray-400 font-medium">
                                {rejectCatModal.req?.userName} — <span className="text-tennis-green">{t(`admin.tournaments.categories.${rejectCatModal.req?.requestedCategory.toLowerCase()}`)}</span>
                            </p>
                        </div>

                        <div className="space-y-4">
                            <textarea
                                className="w-full bg-white/5 border border-white/10 rounded-3xl p-6 text-white placeholder:text-gray-600 focus:outline-none focus:border-red-500/30 transition-all min-h-[120px] resize-none"
                                placeholder={t('admin.tournaments.rejectReasonPh')}
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                autoFocus
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => {
                                    setRejectCatModal({ show: false, req: null });
                                    setRejectReason('');
                                }}
                                className="bg-white/5 hover:bg-white/10 text-gray-400 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-[0.98]"
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                onClick={handleRejectCategory}
                                disabled={processing || !rejectReason.trim()}
                                className="bg-red-500 hover:bg-red-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-[0.98] disabled:opacity-50"
                            >
                                {t('common.reject')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DashboardPage;
