import {
    Activity,
    AlertCircle,
    CheckCircle2,
    Clock,
    DollarSign,
    LogOut,
    Ticket,
    Trophy,
    UserPlus,
    Users,
    X
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { getRecentActivities } from '../../services/activityService';
import { notifyPlayerApproved, notifyPlayerRejected } from '../../services/notificationService';
import { approveRegistration, getClubPendingRegistrations, rejectRegistration } from '../../services/registrationService';
import { getTournamentMatches, getTournamentsByClub } from '../../services/tournamentService';
import type { TournamentData, TournamentPlayer } from '../../services/types';
import { getClubPlayers } from '../../services/userService';

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
    const [pendingRegs, setPendingRegs] = useState<PendingRegistration[]>([]);
    const [recentActivities, setRecentActivities] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);

    const loadData = async () => {
        if (!managedClubId) return;
        try {
            const [tData, pData, rData, activity] = await Promise.all([
                getTournamentsByClub(managedClubId),
                getClubPlayers(managedClubId),
                getClubPendingRegistrations(managedClubId),
                getRecentActivities(10, managedClubId)
            ]);

            setTournaments(tData);
            setPlayersCount(pData.length);
            setPendingRegs(rData);
            setRecentActivities(activity);

            let mCount = 0;
            for (const tournament of tData) {
                if (tournament.id) {
                    const mData = await getTournamentMatches(tournament.id);
                    mCount += mData.length;
                }
            }
            setMatchesCount(mCount);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [managedClubId]);

    const handleApprove = async (reg: PendingRegistration) => {
        if (!user?.uid) return;
        setProcessing(true);
        try {
            await approveRegistration(reg.tournamentId, reg.player.id, user.uid);
            await notifyPlayerApproved(reg.player.uid, reg.tournamentName, reg.player.category || 'unknown');
            await loadData();
        } catch (error) {
            alert("Error approving registration");
        } finally {
            setProcessing(false);
        }
    };

    const handleReject = async (reg: PendingRegistration) => {
        if (!user?.uid) return;
        const reason = window.prompt("Reason for rejection?");
        if (!reason) return;

        setProcessing(true);
        try {
            await rejectRegistration(reg.tournamentId, reg.player.id, user.uid, reason);
            await notifyPlayerRejected(reg.player.uid, reg.tournamentName, reason);
            await loadData();
        } catch (error) {
            alert("Error rejecting registration");
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
            <div>
                <h1 className="text-white text-4xl font-extrabold uppercase tracking-tight">{t('adminTabs.dashboard')}</h1>
                <p className="text-gray-500 font-bold uppercase text-[10px] tracking-widest mt-1">{t('dashboard.performanceOverview')}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    icon={<Trophy size={24} />}
                    label={t('dashboard.stats.tournaments')}
                    value={tournaments.length}
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
                    icon={<AlertCircle size={24} />}
                    label={t('dashboard.activeEvents')}
                    value={tournaments.filter(t => t.status === 'active').length}
                    color="yellow"
                />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
                {/* Pending registrations */}
                <div className="xl:col-span-2 space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-white text-xl font-bold uppercase tracking-tight">{t('dashboard.pendingRegistrations')}</h2>
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
                        <div className="space-y-4">
                            {pendingRegs.map(reg => (
                                <div key={reg.player.id} className="glass p-6 rounded-[24px] border-orange-500/10 flex flex-col md:flex-row items-center justify-between gap-6 transition-all hover:border-orange-500/30">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center text-white font-black">
                                            {reg.player.name.charAt(0)}
                                        </div>
                                        <div>
                                            <h3 className="text-white font-bold">{reg.player.name}</h3>
                                            <p className="text-orange-400 text-[10px] font-black uppercase tracking-widest">{reg.tournamentName}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleApprove(reg)}
                                            disabled={processing}
                                            className="px-6 py-2.5 bg-tennis-green text-tennis-dark rounded-xl font-black text-[10px] uppercase tracking-widest transition-all hover:scale-105"
                                        >
                                            {t('admin.tournaments.approveRegistration')}
                                        </button>
                                        <button
                                            onClick={() => handleReject(reg)}
                                            disabled={processing}
                                            className="p-2.5 bg-white/5 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                                        >
                                            <X size={18} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

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
        </div>
    );
};

export default DashboardPage;
