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

    const getActivityIcon = (type: string) => {
        switch (type) {
            case 'user_register': return <UserPlus size={16} className="text-blue-400" />;
            case 'tournament_join': return <Ticket size={16} className="text-tennis-green" />;
            case 'tournament_withdraw': return <LogOut size={16} className="text-red-500" />;
            case 'transaction': return <DollarSign size={16} className="text-yellow-500" />;
            default: return <Activity size={16} className="text-white" />;
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
                <p className="text-gray-500 font-bold uppercase text-[10px] tracking-widest mt-1">Club Performance Overview</p>
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
                    label="Active Events"
                    value={tournaments.filter(t => t.status === 'active').length}
                    color="yellow"
                />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
                {/* Pending registrations */}
                <div className="xl:col-span-2 space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-white text-xl font-bold uppercase tracking-tight">Pending Registrations</h2>
                        <span className="bg-orange-500/10 text-orange-400 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-orange-500/10">
                            {pendingRegs.length} Attention Needed
                        </span>
                    </div>

                    {pendingRegs.length === 0 ? (
                        <div className="glass p-12 rounded-[32px] border-white/5 flex flex-col items-center justify-center text-center opacity-40">
                            <CheckCircle2 size={40} className="text-gray-500 mb-4" />
                            <p className="text-gray-500 font-bold uppercase text-xs tracking-widest">Inbox Zero</p>
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
                                            Approve
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
                    <h2 className="text-white text-xl font-bold uppercase tracking-tight">Recent Activity</h2>
                    <div className="glass rounded-[32px] border-white/5 overflow-hidden">
                        <div className="p-2 space-y-1">
                            {recentActivities.map((activity, i) => (
                                <div key={i} className="flex items-start gap-4 p-4 rounded-2xl hover:bg-white/5 transition-all group">
                                    <div className="mt-1 w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                        {getActivityIcon(activity.type)}
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-white text-sm font-bold leading-tight">{activity.title}</p>
                                        <p className="text-gray-500 text-[10px] font-medium leading-relaxed">{activity.description}</p>
                                        <div className="flex items-center gap-1.5 text-gray-700 text-[8px] font-black uppercase tracking-widest pt-1">
                                            <Clock size={8} />
                                            {activity.createdAt?.seconds
                                                ? new Date(activity.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                                : 'Just now'
                                            }
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardPage;
