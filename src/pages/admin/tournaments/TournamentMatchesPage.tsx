import {
    ArrowLeft,
    CheckCircle2,
    FileText,
    Layout,
    List,
    Plus,
    RefreshCw,
    Save,
    Table,
    Trophy,
    Users,
    X,
    AlertTriangle
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLanguage } from '../../../context/LanguageContext';
import BracketView from '../../../components/admin/BracketView';
import { deleteBracketMatches, generateMainDraw } from '../../../services/bracketService';
import { finalizeGroup, getGroups, getQualifiedPlayers, getTournamentStandings, unfinalizeGroup } from '../../../services/groupService';
import {
    assignGroupsToPlayers,
    generateGroupStageMatches,
    getTournamentById,
    getTournamentMatches,
    getTournamentPlayers,
    resetGroupStage,
    saveMatchScoreByAdmin
} from '../../../services/tournamentService';
import type { GroupStanding, Match, TournamentCategory, TournamentData, TournamentGroup } from '../../../services/types';
import { calculateWinner, formatMatchScore, type SetScore } from '../../../utils/scoring';

const TournamentMatchesPage = () => {
    const { id } = useParams<{ id: string }>();
    const { t } = useLanguage();
    const navigate = useNavigate();

    const [tournament, setTournament] = useState<TournamentData | null>(null);
    const [matches, setMatches] = useState<Match[]>([]);
    const [groups, setGroups] = useState<TournamentGroup[]>([]);
    const [standings, setStandings] = useState<GroupStanding[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);

    const [activeTab, setActiveTab] = useState<'groups' | 'knockout' | 'standings'>('groups');
    const [selectedCategory, setSelectedCategory] = useState<TournamentCategory | 'all'>('all');

    // Score Entry State
    const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
    const [scoreSets, setScoreSets] = useState<SetScore[]>([
        { player1: 0, player2: 0 },
        { player1: 0, player2: 0 },
        { player1: 0, player2: 0 }
    ]);
    const [winnerId, setWinnerId] = useState<string | null>(null);
    const [isWithdrawal, setIsWithdrawal] = useState(false);

    // Generic Modal States
    const [confirmModal, setConfirmModal] = useState<{
        open: boolean;
        title: string;
        message: string;
        onConfirm: () => Promise<void>;
        type: 'danger' | 'warning' | 'info';
    }>({ open: false, title: '', message: '', onConfirm: async () => { }, type: 'danger' });

    const [errorModal, setErrorModal] = useState<{
        open: boolean;
        message: string;
    }>({ open: false, message: '' });

    const [inputModal, setInputModal] = useState<{
        open: boolean;
        title: string;
        description: string;
        defaultValue: string;
        onConfirm: (value: string) => Promise<void>;
    }>({ open: false, title: '', description: '', defaultValue: '', onConfirm: async () => { } });
    const [inputValue, setInputValue] = useState('');

    const showError = (msg: string) => {
        setErrorModal({ open: true, message: msg });
    };

    const showConfirmation = (title: string, message: string, onConfirm: () => Promise<void>, type: 'danger' | 'warning' | 'info' = 'danger') => {
        setConfirmModal({
            open: true,
            title,
            message,
            onConfirm,
            type
        });
    };

    const showInput = (title: string, description: string, defaultValue: string, onConfirm: (value: string) => Promise<void>) => {
        setInputValue(defaultValue);
        setInputModal({
            open: true,
            title,
            description,
            defaultValue,
            onConfirm
        });
    };

    const loadData = useCallback(async () => {
        if (!id) return;
        setLoading(true);
        try {
            const cat = selectedCategory === 'all' ? undefined : selectedCategory;
            const [tData, mData, gData, sData] = await Promise.all([
                getTournamentById(id),
                getTournamentMatches(id),
                getGroups(id),
                getTournamentStandings(id, cat)
            ]);
            setTournament(tData);
            setMatches(mData);
            setGroups(gData);
            setStandings(sData);

            if (tData?.categories?.length && selectedCategory === 'all') {
                setSelectedCategory(tData.categories[0]);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [id, selectedCategory]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleGenerateGroups = () => {
        if (!id || processing) return;

        showInput(
            t('admin.tournaments.generateGroups'),
            t('admin.tournaments.matches.enterGroups'),
            "4",
            async (val) => {
                if (!val) return;
                setProcessing(true);
                try {
                    const cat = selectedCategory === 'all' ? undefined : selectedCategory;
                    await assignGroupsToPlayers(id, parseInt(val), cat);
                    await generateGroupStageMatches(id, cat);
                    await loadData();
                    setInputModal(prev => ({ ...prev, open: false }));
                } catch (error) {
                    showError(t('admin.tournaments.matches.errorGroups'));
                } finally {
                    setProcessing(false);
                }
            }
        );
    };

    const handleGenerateKnockout = async () => {
        if (!id || processing) return;
        setProcessing(true);
        try {
            const cat = selectedCategory === 'all' ? undefined : selectedCategory;
            const qualifiers = await getQualifiedPlayers(id, cat);
            if (qualifiers.length < 2) {
                showError(t('bracket.groupsNotFinalized'));
                return;
            }

            // Fetch full player objects to get seeds
            const allPlayers = await getTournamentPlayers(id);
            const qualifiedPlayers = allPlayers.filter(p => qualifiers.some(q => q.uid === p.uid));

            await generateMainDraw(id, qualifiedPlayers, cat);
            await loadData();
            setActiveTab('knockout');
        } catch (error) {
            showError(t('bracket.generateError'));
        } finally {
            setProcessing(false);
        }
    };

    const handleFinalizeGroup = (groupName: string) => {
        if (!id) return;

        showInput(
            t('admin.tournaments.finalizeGroup'),
            t('admin.tournaments.matches.finalizeDesc'),
            "2",
            async (val) => {
                if (!val) return;
                try {
                    await finalizeGroup(id, groupName, parseInt(val), selectedCategory === 'all' ? undefined : selectedCategory);
                    await loadData();
                    setInputModal(prev => ({ ...prev, open: false }));
                } catch (error) {
                    showError(t('admin.tournaments.matches.errorFinalizing'));
                }
            }
        );
    };

    const handleOpenScore = (match: Match) => {
        setSelectedMatch(match);
        if (match.sets) {
            setScoreSets(match.sets);
            setWinnerId(match.winnerId || null);
        } else {
            setScoreSets([{ player1: 0, player2: 0 }, { player1: 0, player2: 0 }, { player1: 0, player2: 0 }]);
            setWinnerId(null);
        }
        setIsWithdrawal(match.isWithdrawal || false);
    };

    const handleSaveScore = async () => {
        if (!id || !selectedMatch || !winnerId) return;
        setProcessing(true);
        try {
            await saveMatchScoreByAdmin(id, selectedMatch.id, {
                sets: scoreSets,
                winnerId: winnerId,
                isWithdrawal
            });
            setSelectedMatch(null);
            await loadData();
        } catch (error) {
            showError(t('admin.tournaments.matches.errorSavingScore'));
        } finally {
            setProcessing(false);
        }
    };

    const updateSet = (index: number, p1: number, p2: number) => {
        const newSets = [...scoreSets];
        newSets[index] = { player1: p1, player2: p2 };
        setScoreSets(newSets);

        // Auto-calculate winner
        const win = calculateWinner(newSets, selectedMatch?.player1Uid || '', selectedMatch?.player2Uid || '');
        if (win) setWinnerId(win);
    };

    const groupMatches = matches.filter(m =>
        !!m.group && (selectedCategory === 'all' || m.category === selectedCategory)
    );

    const bracketMatches = matches.filter(m =>
        !!m.bracketRound && (selectedCategory === 'all' || m.category === selectedCategory)
    );

    const matchesByGroupName: { [key: string]: Match[] } = {};
    groupMatches.forEach(m => {
        if (m.group) {
            if (!matchesByGroupName[m.group]) matchesByGroupName[m.group] = [];
            matchesByGroupName[m.group].push(m);
        }
    });

    if (loading) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-tennis-green"></div>
        </div>
    );

    return (
        <div className="space-y-8 animate-fade-in relative pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate(`/admin/tournaments/${id}`)}
                        className="w-12 h-12 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center text-white transition-all no-print"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-white text-3xl font-black uppercase tracking-tight">{tournament?.name}</h1>
                        <p className="text-gray-500 font-bold uppercase text-xs tracking-widest mt-1">{t('admin.tournaments.matchCenterHeroDesc')}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 no-print">
                    <button
                        onClick={() => window.print()}
                        className="bg-white/5 hover:bg-white/10 text-white px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2 border border-white/5"
                    >
                        <FileText size={18} />
                        {t('common.exportPDF')}
                    </button>
                    <div className="flex items-center gap-3 bg-white/5 p-1 rounded-2xl border border-white/5">
                        <button
                            onClick={() => setActiveTab('groups')}
                            className={`px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'groups' ? 'bg-tennis-green text-tennis-dark' : 'text-gray-400 hover:text-white'}`}
                        >
                            <Table size={18} />
                            {t('tournaments.tabs.groups')}
                        </button>
                        <button
                            onClick={() => setActiveTab('standings')}
                            className={`px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'standings' ? 'bg-tennis-green text-tennis-dark' : 'text-gray-400 hover:text-white'}`}
                        >
                            <List size={18} />
                            {t('tournaments.tabs.standings')}
                        </button>
                        <button
                            onClick={() => setActiveTab('knockout')}
                            className={`px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'knockout' ? 'bg-tennis-green text-tennis-dark' : 'text-gray-400 hover:text-white'}`}
                        >
                            <Trophy size={18} />
                            {t('tournaments.tabs.knockout')}
                        </button>
                    </div>
                </div>
            </div>

            {/* Category Filter */}
            {tournament?.categories && tournament.categories.length > 0 && (
                <div className="flex items-center gap-4 overflow-x-auto pb-2 no-scrollbar no-print">
                    {tournament.categories.map((cat) => (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className={`px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-widest border transition-all whitespace-nowrap ${selectedCategory === cat
                                ? 'bg-white text-tennis-dark border-white'
                                : 'bg-transparent text-gray-400 border-white/10 hover:border-white/30'
                                }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            )}

            {/* Content Area */}
            <div className="min-h-[500px]">
                {activeTab === 'groups' && (
                    <div className="space-y-12">
                        {Object.keys(matchesByGroupName).length === 0 ? (
                            <div className="glass p-20 rounded-[40px] border-dashed border-2 border-white/10 flex flex-col items-center justify-center text-center no-print">
                                <div className="w-20 h-20 bg-tennis-green/10 rounded-3xl flex items-center justify-center text-tennis-green mb-6">
                                    <Layout size={40} />
                                </div>
                                <h3 className="text-white text-2xl font-bold mb-2">{t('admin.tournaments.noGroups')}</h3>
                                <p className="text-gray-500 max-w-md mb-10">{t('admin.tournaments.noGroupsDesc')}</p>
                                <button
                                    onClick={handleGenerateGroups}
                                    disabled={processing}
                                    className="bg-tennis-green hover:bg-tennis-green/90 text-tennis-dark px-10 py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-tennis-green/20 transition-all flex items-center gap-2"
                                >
                                    {processing ? <RefreshCw className="animate-spin" /> : <Plus />}
                                    {t('admin.tournaments.generateGroups')}
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-10">
                                {Object.keys(matchesByGroupName).sort().map(groupName => {
                                    const group = groups.find(g => g.name === groupName && (selectedCategory === 'all' || g.category === selectedCategory));
                                    const isFinalized = group?.status === 'completed';

                                    return (
                                        <div key={groupName} className="space-y-6">
                                            <div className="flex items-center justify-between px-4">
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl ${isFinalized ? 'bg-tennis-green text-tennis-dark' : 'bg-white/5 text-white border border-white/10'}`}>
                                                        {groupName}
                                                    </div>
                                                    <div>
                                                        <h3 className="text-white text-xl font-bold">{t('tournaments.group')} {groupName}</h3>
                                                        <p className={`text-xs font-bold uppercase tracking-widest ${isFinalized ? 'text-tennis-green' : 'text-gray-500'}`}>
                                                            {isFinalized ? t('common.finalized') : t('common.inProgress')}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3 no-print">
                                                    {!isFinalized ? (
                                                        <button
                                                            onClick={() => handleFinalizeGroup(groupName)}
                                                            className="text-xs font-black uppercase tracking-widest px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 transition-all"
                                                        >
                                                            {t('admin.tournaments.finalizeGroup')}
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => showConfirmation(
                                                                t('common.undo'),
                                                                t('common.undoConfirm'),
                                                                async () => {
                                                                    await unfinalizeGroup(id!, groupName, selectedCategory === 'all' ? undefined : selectedCategory);
                                                                    await loadData();
                                                                    setConfirmModal(prev => ({ ...prev, open: false }));
                                                                },
                                                                'danger'
                                                            )}
                                                            className="text-xs font-black uppercase tracking-widest px-6 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl border border-red-500/10 transition-all"
                                                        >
                                                            {t('common.undo')}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                {matchesByGroupName[groupName].map(match => (
                                                    <div
                                                        key={match.id}
                                                        onClick={() => handleOpenScore(match)}
                                                        className="glass p-5 rounded-3xl cursor-pointer hover:border-white/20 transition-all space-y-4 group"
                                                    >
                                                        <div className="flex items-center justify-between mb-2">
                                                            <span className="text-[10px] font-black uppercase text-gray-600 tracking-tighter">{t('tournaments.matchNum', { num: match.id.substring(0, 4) })}</span>
                                                            <div className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${match.status === 'completed' ? 'bg-tennis-green/10 text-tennis-green' : 'bg-white/5 text-gray-500'}`}>
                                                                {t(`tournaments.status.${match.status}`)}
                                                            </div>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <div className="flex items-center justify-between">
                                                                <span className={`font-bold text-sm ${match.winnerId === match.player1Uid ? 'text-tennis-green' : 'text-white'}`}>{match.player1Name}</span>
                                                                {match.winnerId === match.player1Uid && <CheckCircle2 size={14} className="text-tennis-green" />}
                                                            </div>
                                                            <div className="flex items-center justify-between">
                                                                <span className={`font-bold text-sm ${match.winnerId === match.player2Uid ? 'text-tennis-green' : 'text-white'}`}>{match.player2Name}</span>
                                                                {match.winnerId === match.player2Uid && <CheckCircle2 size={14} className="text-tennis-green" />}
                                                            </div>
                                                        </div>
                                                        <div className="pt-3 border-t border-white/5 flex justify-center bg-white/5 -mx-5 -mb-5 rounded-b-3xl py-2">
                                                            <span className="text-tennis-green font-black text-xs">
                                                                {match.status === 'completed' ? (match.sets ? formatMatchScore(match.sets) : match.score) : t('tournaments.status.pending').toUpperCase()}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}

                        <div className="flex justify-center pt-10 border-t border-white/5 gap-4 no-print">
                            <button
                                onClick={() => showConfirmation(
                                    t('admin.tournaments.resetGroupStage'),
                                    t('admin.tournaments.resetGroupConfirm'),
                                    async () => {
                                        await resetGroupStage(id!, selectedCategory === 'all' ? undefined : selectedCategory);
                                        await loadData();
                                        setConfirmModal(prev => ({ ...prev, open: false }));
                                    },
                                    'danger'
                                )}
                                className="text-xs font-black uppercase tracking-widest px-8 py-4 bg-red-500/5 hover:bg-red-500/10 text-red-500 rounded-2xl border border-red-500/10 transition-all"
                            >
                                {t('admin.tournaments.resetGroupStage')}
                            </button>
                            <button
                                onClick={handleGenerateKnockout}
                                disabled={processing}
                                className="bg-white text-tennis-dark px-10 py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl transition-all hover:scale-[1.02] flex items-center gap-2"
                            >
                                <Trophy size={18} />
                                {t('admin.tournaments.generateDraw')}
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'standings' && (
                    <div className="animate-fade-in transition-all">
                        <div className="glass rounded-[40px] border-white/5 overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-white/5 border-b border-white/5">
                                    <tr>
                                        <th className="px-8 py-6 text-[10px] font-black uppercase text-gray-500 tracking-widest">{t('tournaments.standings.player')}</th>
                                        <th className="px-4 py-6 text-[10px] font-black uppercase text-gray-500 tracking-widest text-center">{t('tournaments.group')}</th>
                                        <th className="px-4 py-6 text-[10px] font-black uppercase text-gray-500 tracking-widest text-center">{t('tournaments.standings.played')}</th>
                                        <th className="px-4 py-6 text-[10px] font-black uppercase text-gray-500 tracking-widest text-center">{t('tournaments.standings.wins')}</th>
                                        <th className="px-4 py-6 text-[10px] font-black uppercase text-gray-500 tracking-widest text-center">{t('tournaments.standings.losses')}</th>
                                        <th className="px-8 py-6 text-[10px] font-black uppercase text-tennis-green tracking-widest text-right">{t('tournaments.standings.points')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {standings.map((s, idx) => (
                                        <tr key={s.uid} className="hover:bg-white/[0.02] transition-colors">
                                            <td className="px-8 py-5">
                                                <div className="flex items-center gap-4">
                                                    <span className="text-gray-700 font-bold text-xs">{idx + 1}</span>
                                                    <span className="text-white font-bold">{s.playerName}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-5 text-center text-gray-400 font-black">{s.group || '-'}</td>
                                            <td className="px-4 py-5 text-center text-gray-400 font-bold">{s.played || 0}</td>
                                            <td className="px-4 py-5 text-center text-tennis-green font-bold">{s.wins || 0}</td>
                                            <td className="px-4 py-5 text-center text-red-500/60 font-medium">{s.losses || 0}</td>
                                            <td className="px-8 py-5 text-right font-black text-tennis-green text-xl">{s.points || 0}</td>
                                        </tr>
                                    ))}
                                    {standings.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="px-8 py-20 text-center text-gray-500 font-bold uppercase text-xs tracking-widest">{t('tournaments.standings.noData')}</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'knockout' && (
                    <div className="space-y-10">
                        {bracketMatches.length === 0 ? (
                            <div className="glass p-20 rounded-[40px] border-dashed border-2 border-white/10 flex flex-col items-center justify-center text-center no-print">
                                <div className="w-20 h-20 bg-blue-500/10 rounded-3xl flex items-center justify-center text-blue-400 mb-6">
                                    <Trophy size={40} />
                                </div>
                                <h3 className="text-white text-2xl font-bold mb-2">{t('admin.tournaments.noBrackets')}</h3>
                                <p className="text-gray-500 max-w-md mb-10">{t('admin.tournaments.noBracketsDesc')}</p>
                                <button
                                    onClick={handleGenerateKnockout}
                                    disabled={processing}
                                    className="bg-blue-500 hover:bg-blue-600 text-white px-10 py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-blue-500/20 transition-all flex items-center gap-2"
                                >
                                    {processing ? <RefreshCw className="animate-spin" /> : <Trophy />}
                                    {t('admin.tournaments.generateDraw')}
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-12">
                                <BracketView
                                    matches={bracketMatches as any}
                                    bracketSize={bracketMatches.filter(m => m.roundNumber === 1).length * 2}
                                    onMatchPress={handleOpenScore as any}
                                />

                                <div className="flex justify-center border-t border-white/5 pt-10 no-print">
                                    <button
                                        onClick={() => showConfirmation(
                                            t('admin.tournaments.resetDraw'),
                                            t('admin.tournaments.resetDrawConfirm'),
                                            async () => {
                                                await deleteBracketMatches(id!);
                                                await loadData();
                                                setConfirmModal(prev => ({ ...prev, open: false }));
                                            },
                                            'danger'
                                        )}
                                        className="text-xs font-black uppercase tracking-widest px-8 py-4 bg-red-500/5 hover:bg-red-500/10 text-red-500 rounded-2xl border border-red-500/10 transition-all"
                                    >
                                        {t('admin.tournaments.resetDraw')}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Score Entry Slide-over */}
            {selectedMatch && (
                <>
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-40 transition-opacity no-print" onClick={() => setSelectedMatch(null)}></div>
                    <div className="fixed right-0 top-0 h-full w-full max-w-xl bg-gray-950 border-l border-white/10 z-50 p-12 overflow-y-auto transform transition-transform duration-300 animate-slide-in-right no-print">
                        <div className="flex justify-between items-center mb-10">
                            <div>
                                <h2 className="text-white text-3xl font-black uppercase tracking-tight">{t('admin.tournaments.matches.enterResult')}</h2>
                                <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mt-1">{t('admin.tournaments.matches.officialResult')}</p>
                            </div>
                            <button onClick={() => setSelectedMatch(null)} className="w-12 h-12 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center text-gray-500 hover:text-white transition-all">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="space-y-12">
                            {/* Match Summary */}
                            <div className="bg-white/5 border border-white/10 rounded-[32px] p-8">
                                <div className="grid grid-cols-2 gap-8 items-center relative">
                                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-gray-950 border border-white/10 rounded-full flex items-center justify-center z-10 text-[10px] font-black text-gray-600">VS</div>
                                    <div className={`text-center space-y-3 p-4 rounded-2xl transition-all ${winnerId === selectedMatch.player1Uid ? 'bg-tennis-green/10 ring-1 ring-tennis-green/20' : ''}`}>
                                        <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto text-white">
                                            <Users size={24} />
                                        </div>
                                        <p className={`font-black uppercase tracking-tight break-words ${winnerId === selectedMatch.player1Uid ? 'text-tennis-green' : 'text-white'}`}>{selectedMatch.player1Name}</p>
                                    </div>
                                    <div className={`text-center space-y-3 p-4 rounded-2xl transition-all ${winnerId === selectedMatch.player2Uid ? 'bg-tennis-green/10 ring-1 ring-tennis-green/20' : ''}`}>
                                        <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto text-white">
                                            <Users size={24} />
                                        </div>
                                        <p className={`font-black uppercase tracking-tight break-words ${winnerId === selectedMatch.player2Uid ? 'text-tennis-green' : 'text-white'}`}>{selectedMatch.player2Name}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Sets Entry */}
                            <div className="space-y-6">
                                <h3 className="text-white text-lg font-bold">{t('admin.tournaments.matches.setResults')}</h3>
                                {[0, 1, 2].map((i) => (
                                    <div key={i} className="flex items-center gap-6">
                                        <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center text-gray-500 font-black text-xs">{t('tournaments.setNum', { num: i + 1 })}</div>
                                        <div className="flex-1 grid grid-cols-2 gap-4">
                                            <input
                                                type="number"
                                                className="bg-white/5 border border-white/10 rounded-2xl p-5 text-center text-white text-xl font-bold focus:outline-none focus:border-tennis-green/50"
                                                value={scoreSets[i].player1}
                                                onChange={(e) => updateSet(i, parseInt(e.target.value) || 0, scoreSets[i].player2)}
                                            />
                                            <input
                                                type="number"
                                                className="bg-white/5 border border-white/10 rounded-2xl p-5 text-center text-white text-xl font-bold focus:outline-none focus:border-tennis-green/50"
                                                value={scoreSets[i].player2}
                                                onChange={(e) => updateSet(i, scoreSets[i].player1, parseInt(e.target.value) || 0)}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Options */}
                            <div className="space-y-4">
                                <button
                                    onClick={() => setIsWithdrawal(!isWithdrawal)}
                                    className={`w-full p-6 rounded-[24px] border border-dashed transition-all flex items-center justify-between ${isWithdrawal ? 'bg-red-500/10 border-red-500/50 text-red-500' : 'bg-transparent border-white/10 text-gray-500 hover:border-white/30'}`}
                                >
                                    <div className="flex items-center gap-4">
                                        <X size={24} />
                                        <div className="text-left">
                                            <p className="font-bold text-sm uppercase tracking-tight leading-none">{t('admin.tournaments.matches.declareWithdrawal')}</p>
                                            <p className="text-[10px] font-bold mt-1 opacity-60">{t('admin.tournaments.matches.victoryDefault')}</p>
                                        </div>
                                    </div>
                                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${isWithdrawal ? 'border-red-500 bg-red-500' : 'border-gray-800'}`}>
                                        {isWithdrawal && <CheckCircle2 size={14} className="text-white" />}
                                    </div>
                                </button>
                            </div>

                            {/* Winner Selection */}
                            <div className="space-y-4">
                                <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest text-center">{t('admin.tournaments.matches.declaredWinner')}</p>
                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        onClick={() => setWinnerId(selectedMatch.player1Uid)}
                                        className={`p-5 rounded-2xl font-black uppercase tracking-tight break-words text-xs transition-all ${winnerId === selectedMatch.player1Uid ? 'bg-tennis-green text-tennis-dark' : 'bg-white/5 text-white border border-white/10'}`}
                                    >
                                        {selectedMatch.player1Name}
                                    </button>
                                    <button
                                        onClick={() => setWinnerId(selectedMatch.player2Uid)}
                                        className={`p-5 rounded-2xl font-black uppercase tracking-tight break-words text-xs transition-all ${winnerId === selectedMatch.player2Uid ? 'bg-tennis-green text-tennis-dark' : 'bg-white/5 text-white border border-white/10'}`}
                                    >
                                        {selectedMatch.player2Name}
                                    </button>
                                </div>
                            </div>

                            <button
                                disabled={!winnerId || processing}
                                onClick={handleSaveScore}
                                className="w-full bg-tennis-green hover:bg-tennis-green/90 text-tennis-dark py-6 rounded-[32px] font-black uppercase tracking-widest shadow-2xl shadow-tennis-green/20 transition-all flex items-center justify-center gap-3 disabled:opacity-50 mt-10"
                            >
                                {processing ? <RefreshCw className="animate-spin" /> : <Save size={24} />}
                                {t('common.confirmResult')}
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* Print Styles */}
            <style>{`
                @media print {
                    body { background: white !important; color: black !important; }
                    .no-print { display: none !important; }
                    .glass { border: 1px solid #ddd !important; background: white !important; box-shadow: none !important; }
                    .text-white { color: black !important; }
                    .text-gray-500, .text-gray-700 { color: #666 !important; }
                    .bg-tennis-dark { background: white !important; }
                    .bg-white\\/5 { background: #f9f9f9 !important; }
                    header, aside { display: none !important; }
                    main { padding: 0 !important; margin: 0 !important; }
                    .animate-fade-in { animation: none !important; }
                    table { border-collapse: collapse !important; }
                    th, td { border-bottom: 1px solid #eee !important; color: black !important; }
                }
            `}</style>

            {/* Generic Confirmation Modal */}
            {confirmModal.open && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-6 animate-fade-in no-print">
                    <div className="glass max-w-md w-full p-8 rounded-[32px] border-white/10 text-center space-y-6 shadow-2xl">
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-2 ${confirmModal.type === 'danger' ? 'bg-red-500/10 text-red-500' : 'bg-yellow-500/10 text-yellow-500'}`}>
                            <AlertTriangle size={32} />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-white text-2xl font-bold">{confirmModal.title}</h3>
                            <p className="text-gray-400 leading-relaxed">{confirmModal.message}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4 pt-2">
                            <button
                                onClick={() => setConfirmModal(prev => ({ ...prev, open: false }))}
                                className="py-4 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-bold transition-colors"
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                onClick={confirmModal.onConfirm}
                                disabled={processing}
                                className={`py-4 rounded-2xl font-bold transition-colors flex items-center justify-center gap-2 ${confirmModal.type === 'danger' ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-tennis-green hover:bg-tennis-green/90 text-tennis-dark'}`}
                            >
                                {processing ? <RefreshCw className="animate-spin" size={20} /> : t('common.confirm')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Error Modal */}
            {errorModal.open && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-6 animate-fade-in no-print">
                    <div className="glass max-w-sm w-full p-8 rounded-[32px] border-white/10 text-center space-y-6 shadow-2xl">
                        <div className="w-16 h-16 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto mb-2">
                            <AlertTriangle size={32} />
                        </div>
                        <h3 className="text-white text-xl font-bold">{t('common.error')}</h3>
                        <p className="text-gray-400">{errorModal.message}</p>
                        <button
                            onClick={() => setErrorModal(prev => ({ ...prev, open: false }))}
                            className="w-full py-4 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold transition-colors"
                        >
                            {t('common.close')}
                        </button>
                    </div>
                </div>
            )}

            {/* Input Modal */}
            {inputModal.open && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-6 animate-fade-in no-print">
                    <div className="glass max-w-md w-full p-8 rounded-[32px] border-white/10 text-center space-y-6 shadow-2xl">
                        <div className="space-y-2">
                            <h3 className="text-white text-2xl font-bold">{inputModal.title}</h3>
                            <p className="text-gray-400 leading-relaxed">{inputModal.description}</p>
                        </div>

                        <input
                            type="number"
                            autoFocus
                            className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-center text-white text-2xl font-bold focus:outline-none focus:border-tennis-green/50"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                        />

                        <div className="grid grid-cols-2 gap-4 pt-2">
                            <button
                                onClick={() => setInputModal(prev => ({ ...prev, open: false }))}
                                className="py-4 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-bold transition-colors"
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                onClick={() => inputModal.onConfirm(inputValue)}
                                disabled={processing || !inputValue}
                                className="py-4 rounded-2xl bg-tennis-green hover:bg-tennis-green/90 text-tennis-dark font-bold transition-colors flex items-center justify-center gap-2"
                            >
                                {processing ? <RefreshCw className="animate-spin" size={20} /> : t('common.confirm')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TournamentMatchesPage;
