import React, { useEffect, useState } from 'react';
import { X, Trophy, Activity, Target, User, Calendar } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { getUserProfile } from '../../services/userService';
import { getPlayerMatches } from '../../services/tournamentService';
import type { Match, TournamentPlayer } from '../../services/types';
import type { UserData } from '../../services/userService';

interface PlayerStatsModalProps {
    player: TournamentPlayer;
    onClose: () => void;
}

const PlayerStatsModal: React.FC<PlayerStatsModalProps> = ({ player, onClose }) => {
    const { t } = useLanguage();
    const [profile, setProfile] = useState<UserData | null>(null);
    const [matches, setMatches] = useState<Match[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadStats = async () => {
            if (!player.uid) {
                setLoading(false);
                return;
            }
            try {
                const [pDoc, pMatches] = await Promise.all([
                    getUserProfile(player.uid),
                    getPlayerMatches(player.uid)
                ]);
                setProfile(pDoc);
                setMatches(pMatches);
            } catch (error) {
                console.error("Error loading player stats:", error);
            } finally {
                setLoading(false);
            }
        };
        loadStats();
    }, [player.uid]);

    const tennisProfile = profile?.tennisProfile || {};

    const completedMatches = matches.filter(m => m.status === 'completed');
    const wins = completedMatches.filter(m => m.winnerId === player.uid).length;
    const losses = completedMatches.length - wins;
    const winRate = completedMatches.length > 0 ? Math.round((wins / completedMatches.length) * 100) : 0;

    const getTranslatedStyle = (style: string) => {
        if (!style) return t('profile.notSet');
        switch (style) {
            case 'Aggressive Basere':
            case 'Aggressive Baseliner': return t('profile.edit.styles.aggressive');
            case 'Counter Puncher': return t('profile.edit.styles.counter');
            case 'Serve & Volley': return t('profile.edit.styles.serve');
            case 'All-Court Player': return t('profile.edit.styles.allCourt');
            default: return style;
        }
    };

    const getTranslatedCategory = (cat: string | undefined) => {
        if (!cat) return t('common.player');
        const key = cat.toLowerCase();
        const translated = t(`profile.edit.categories.${key}`);
        return translated === `profile.edit.categories.${key}` ? cat : translated;
    };

    const getTranslatedHand = (hand: string) => {
        if (!hand) return t('profile.notSet');
        if (hand.toLowerCase().includes('right')) return t('profile.edit.hands.right');
        if (hand.toLowerCase().includes('left')) return t('profile.edit.hands.left');
        return hand;
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="glass w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-[40px] border-white/10 flex flex-col shadow-2xl animate-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="p-8 border-b border-white/5 flex items-center justify-between relative bg-gradient-to-r from-tennis-green/10 to-transparent">
                    <div className="flex items-center gap-6">
                        <div className="w-20 h-20 bg-tennis-green rounded-3xl flex items-center justify-center text-tennis-dark font-black text-3xl shadow-lg shadow-tennis-green/20">
                            {player.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h2 className="text-white text-3xl font-black uppercase tracking-tight">{player.name}</h2>
                            <p className="text-tennis-green font-bold text-sm tracking-widest uppercase opacity-70">
                                {getTranslatedCategory(player.category)}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-12 h-12 rounded-2xl bg-white/5 hover:bg-white/10 transition-all flex items-center justify-center group"
                    >
                        <X className="text-gray-400 group-hover:text-white transition-colors" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-8 no-scrollbar">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <Activity className="text-tennis-green animate-spin" size={48} />
                            <p className="text-gray-500 font-bold animate-pulse">{t('common.loading')}</p>
                        </div>
                    ) : (
                        <>
                            {/* Stats Overview */}
                            <div className="grid grid-cols-3 gap-6">
                                <div className="glass p-6 rounded-3xl border-white/5 items-center text-center space-y-1 bg-white/5">
                                    <Trophy className="mx-auto text-tennis-green mb-2" size={24} />
                                    <p className="text-white text-3xl font-black">{wins}</p>
                                    <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">{t('profile.wonShort')}</p>
                                </div>
                                <div className="glass p-6 rounded-3xl border-white/5 items-center text-center space-y-1 bg-white/5">
                                    <Activity className="mx-auto text-red-500 mb-2" size={24} />
                                    <p className="text-white text-3xl font-black">{losses}</p>
                                    <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">{t('profile.lostShort')}</p>
                                </div>
                                <div className="glass p-6 rounded-3xl items-center text-center space-y-1 bg-white/5 border-tennis-green/20">
                                    <Target className="mx-auto text-blue-400 mb-2" size={24} />
                                    <p className="text-white text-3xl font-black">{winRate}%</p>
                                    <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">{t('profile.winRate')}</p>
                                </div>
                            </div>

                            {/* Identity Section */}
                            <div className="space-y-4">
                                <h3 className="text-white font-bold uppercase tracking-tight flex items-center gap-2">
                                    <User size={18} className="text-tennis-green" />
                                    {t('profile.tennisProfile')}
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-white/5 p-4 rounded-2xl border border-white/5 flex flex-col gap-1">
                                        <span className="text-gray-500 text-[10px] font-black uppercase tracking-widest">{t('profile.ntrpLevel')}</span>
                                        <span className="text-white font-bold">{tennisProfile.ntrp || t('profile.notSet')}</span>
                                    </div>
                                    <div className="bg-white/5 p-4 rounded-2xl border border-white/5 flex flex-col gap-1">
                                        <span className="text-gray-500 text-[10px] font-black uppercase tracking-widest">{t('profile.playStyle')}</span>
                                        <span className="text-white font-bold">{getTranslatedStyle(tennisProfile.style)}</span>
                                    </div>
                                    <div className="bg-white/5 p-4 rounded-2xl border border-white/5 flex flex-col gap-1">
                                        <span className="text-gray-500 text-[10px] font-black uppercase tracking-widest">{t('profile.dominantHand')}</span>
                                        <span className="text-white font-bold">{getTranslatedHand(tennisProfile.hand)}</span>
                                    </div>
                                    <div className="bg-white/5 p-4 rounded-2xl border border-white/5 flex flex-col gap-1">
                                        <span className="text-gray-500 text-[10px] font-black uppercase tracking-widest">{t('profile.category')}</span>
                                        <span className="text-white font-bold">{getTranslatedCategory(player.category)}</span>
                                    </div>
                                </div>
                                {tennisProfile.bio && (
                                    <div className="bg-white/5 p-6 rounded-3xl border border-white/5">
                                        <span className="text-gray-500 text-[10px] font-black uppercase tracking-widest block mb-2">{t('profile.bio')}</span>
                                        <p className="text-gray-300 text-sm leading-relaxed italic">"{tennisProfile.bio}"</p>
                                    </div>
                                )}
                            </div>

                            {/* Recent Performance */}
                            <div className="space-y-4 pb-4">
                                <h3 className="text-white font-bold uppercase tracking-tight flex items-center gap-2">
                                    <Calendar size={18} className="text-tennis-green" />
                                    {t('admin.tournaments.recentPerformance')}
                                </h3>
                                <div className="space-y-3">
                                    {completedMatches.length === 0 ? (
                                        <div className="text-center py-10 bg-white/5 rounded-[32px] border-dashed border border-white/10">
                                            <p className="text-gray-500 text-sm">{t('tournaments.noMatchesFound')}</p>
                                        </div>
                                    ) : (
                                        completedMatches.slice(0, 5).map((m, i) => {
                                            const isWin = m.winnerId === player.uid;
                                            return (
                                                <div key={i} className="bg-white/5 p-4 rounded-2xl border border-white/5 flex items-center justify-between hover:bg-white/10 transition-all cursor-default">
                                                    <div className="flex-1">
                                                        <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest truncate max-w-[200px]">{m.tournamentName || t('matches.friendlyChallenge')}</p>
                                                        <div className="flex items-center gap-3 mt-1">
                                                            <span className={`text-sm font-black ${isWin ? 'text-tennis-green' : 'text-red-500'}`}>
                                                                {isWin ? t('profile.won').toUpperCase() : t('profile.lost').toUpperCase()}
                                                            </span>
                                                            <span className="text-white font-bold text-sm tracking-widest">{m.score}</span>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-gray-500 text-[10px] uppercase font-bold">{m.category}</p>
                                                        <p className="text-white/40 text-[9px] mt-1">{t('tournaments.vs')} {m.player1Uid === player.uid ? m.player2Name : m.player1Name}</p>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <div className="p-8 border-t border-white/5 bg-white/5">
                    <button
                        onClick={onClose}
                        className="w-full py-4 bg-tennis-green text-tennis-dark font-black rounded-2xl hover:bg-tennis-green/90 transition-all uppercase tracking-widest shadow-lg shadow-tennis-green/20"
                    >
                        {t('common.close')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PlayerStatsModal;
