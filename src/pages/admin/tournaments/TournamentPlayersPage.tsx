import { addDoc, collection, getDocs, query, Timestamp, where } from 'firebase/firestore';
import {
    ArrowLeft,
    Check,
    CheckCircle2,
    Crown,
    DollarSign,
    Plus,
    RefreshCw,
    ShieldAlert,
    Trash2,
    UserPlus,
    Users,
    X,
    AlertTriangle
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../../../config/firebase';
import { useAuth } from '../../../context/AuthContext';
import { useLanguage } from '../../../context/LanguageContext';
import { notifyPlayerApproved, notifyPlayerRejected } from '../../../services/notificationService';
import { completeTransaction, createTransaction, revertLatestTransactionForUser } from '../../../services/paymentService';
import { approveRegistration, getPendingRegistrations, rejectRegistration } from '../../../services/registrationService';
import {
    addPlayerToTournament,
    autoSeedPlayers,
    CATEGORY_ORDER,
    checkInPlayer,
    deleteManualPlayers,
    getTournamentById,
    getTournamentPlayers,
    removePlayerFromTournament,
    updatePlayerInTournament,
    updatePlayerSeed
} from '../../../services/tournamentService';
import type { TournamentCategory, TournamentData, TournamentPlayer } from '../../../services/types';
import PlayerStatsModal from '../../../components/admin/PlayerStatsModal';

const TournamentPlayersPage = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { t } = useLanguage();

    const [tournament, setTournament] = useState<TournamentData | null>(null);
    const [players, setPlayers] = useState<TournamentPlayer[]>([]);
    const [playerPoints, setPlayerPoints] = useState<{ [uid: string]: number }>({});
    const [pendingRegs, setPendingRegs] = useState<TournamentPlayer[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<TournamentCategory | 'all'>('all');

    // Modals
    const [showAddModal, setShowAddModal] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showRandomModal, setShowRandomModal] = useState(false);
    const [showRejectModal, setShowRejectModal] = useState(false);

    // Form States
    const [newPlayer, setNewPlayer] = useState({ name: '', email: '', isWildcard: false });
    const [paymentInfo, setPaymentInfo] = useState({ amount: '50', note: '' });
    const [selectedPlayer, setSelectedPlayer] = useState<TournamentPlayer | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [randomCount, setRandomCount] = useState('5');
    const [randomCategory, setRandomCategory] = useState<TournamentCategory | null>(null);
    const [showSeedModal, setShowSeedModal] = useState(false);
    const [seedValue, setSeedValue] = useState('');
    const [showStatsModal, setShowStatsModal] = useState(false);

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

    const loadData = useCallback(async () => {
        if (!id) return;
        setLoading(true);
        try {
            const [tData, pData, rData] = await Promise.all([
                getTournamentById(id),
                getTournamentPlayers(id),
                getPendingRegistrations(id)
            ]);
            setTournament(tData);
            setPlayers(pData);
            setPendingRegs(rData);

            // Fetch points from club
            if (tData?.clubId) {
                const { doc, getDoc } = await import('firebase/firestore');
                const pointsMap: { [uid: string]: number } = {};

                await Promise.all(pData.map(async (p) => {
                    if (p.uid && !p.isManual) {
                        try {
                            const userDoc = await getDoc(doc(db, 'users', p.uid));
                            if (userDoc.exists()) {
                                const userData = userDoc.data();
                                pointsMap[p.uid] = userData.clubs?.[tData.clubId!]?.points ?? 0;
                            }
                        } catch (e) {
                            console.warn(`Points fetch error for ${p.uid}`, e);
                        }
                    }
                }));
                setPlayerPoints(pointsMap);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleAddPlayer = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id || !newPlayer.name.trim() || processing) return;
        setProcessing(true);
        try {
            let userUid = `manual_${Date.now()}`;
            // Optional: Lookup user by email
            if (newPlayer.email.trim()) {
                const q = query(collection(db, 'users'), where('email', '==', newPlayer.email.trim()));
                const snap = await getDocs(q);
                if (!snap.empty) {
                    userUid = snap.docs[0].id;
                } else {
                    const userRef = await addDoc(collection(db, 'users'), {
                        displayName: newPlayer.name,
                        email: newPlayer.email.trim(),
                        createdAt: Timestamp.now(),
                        isManual: true,
                        role: 'player'
                    });
                    userUid = userRef.id;
                }
            }

            await addPlayerToTournament(id, {
                name: newPlayer.name,
                email: newPlayer.email,
                uid: userUid,
                isWildcard: newPlayer.isWildcard,
                isManual: true,
                registrationStatus: 'approved'
            });

            setShowAddModal(false);
            setNewPlayer({ name: '', email: '', isWildcard: false });
            await loadData();
        } catch (error) {
            showError(t('admin.tournaments.errorAddingPlayer'));
        } finally {
            setProcessing(false);
        }
    };

    const handleRemovePlayer = (playerId: string) => {
        showConfirmation(
            t('admin.tournaments.removePlayer'),
            t('admin.tournaments.confirmRemovePlayer'),
            async () => {
                try {
                    setProcessing(true);
                    await removePlayerFromTournament(id!, playerId);
                    await loadData();
                } catch (error) {
                    showError(t('admin.tournaments.errorRemovingPlayer'));
                } finally {
                    setProcessing(false);
                    setConfirmModal(prev => ({ ...prev, open: false }));
                }
            },
            'danger'
        );
    };

    const handleApprove = async (player: TournamentPlayer) => {
        if (!id || !user?.uid) return;
        try {
            await approveRegistration(id, player.id, user.uid);
            const title = t('admin.notifications.automated.approved.title');
            const body = t('admin.notifications.automated.approved.body', {
                tournament: tournament?.name || '',
                category: player.category ? t(`admin.tournaments.categories.${player.category}`) : t('common.none')
            });
            await notifyPlayerApproved(player.uid, title, body);
            await loadData();
        } catch (error) {
            showError(t('admin.tournaments.errorApprovingRegistration'));
        }
    };

    const handleReject = async () => {
        if (!id || !selectedPlayer || !user?.uid || !rejectReason.trim()) return;
        setProcessing(true);
        try {
            await rejectRegistration(id, selectedPlayer.id, user.uid, rejectReason);
            const title = t('admin.notifications.automated.rejected.title');
            const body = t('admin.notifications.automated.rejected.body', {
                tournament: tournament?.name || '',
                reason: rejectReason
            });
            await notifyPlayerRejected(selectedPlayer.uid, title, body);
            setShowRejectModal(false);
            setRejectReason('');
            setSelectedPlayer(null);
            await loadData();
        } catch (error) {
            showError(t('admin.tournaments.errorRejectingRegistration'));
        } finally {
            setProcessing(false);
        }
    };

    const handlePayment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id || !selectedPlayer || processing) return;
        setProcessing(true);
        try {
            const amount = parseFloat(paymentInfo.amount);
            const txId = await createTransaction({
                userId: selectedPlayer.uid || 'guest',
                userName: selectedPlayer.name,
                amount,
                type: 'entry_fee',
                referenceId: id,
                referenceName: (tournament?.name || 'Tournament') + ' Entry',
                tournamentPlayerId: selectedPlayer.id,
                clubId: tournament?.clubId
            });
            await completeTransaction(txId, 'manual_admin', paymentInfo.note || 'manual');
            setShowPaymentModal(false);
            setPaymentInfo({ amount: '50', note: '' });
            setSelectedPlayer(null);
            await loadData();
        } catch (error) {
            showError(t('admin.tournaments.errorRecordingPayment'));
        } finally {
            setProcessing(false);
        }
    };

    const handleRevertPayment = (player: TournamentPlayer) => {
        showConfirmation(
            t('admin.tournaments.revertPayment'),
            t('admin.tournaments.confirmRevertPayment', { name: player.name }),
            async () => {
                if (!id) return;
                try {
                    setProcessing(true);
                    await revertLatestTransactionForUser(id, player.uid, player.id);
                    await loadData();
                } catch (error) {
                    showError(t('admin.tournaments.errorRevertingPayment'));
                } finally {
                    setProcessing(false);
                    setConfirmModal(prev => ({ ...prev, open: false }));
                }
            },
            'warning'
        );
    };

    const handleToggleWildcard = async (player: TournamentPlayer) => {
        if (!id) return;
        try {
            await updatePlayerInTournament(id, player.id, { isWildcard: !player.isWildcard });
            await loadData();
        } catch (error) {
            showError(t('admin.tournaments.errorUpdatingWildcard'));
        }
    };

    const handleUpdateSeed = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id || !selectedPlayer || processing) return;
        setProcessing(true);
        try {
            const seed = seedValue === '' ? null : parseInt(seedValue);
            await updatePlayerSeed(id, selectedPlayer.id, seed);
            setShowSeedModal(false);
            setSeedValue('');
            setSelectedPlayer(null);
            await loadData();
        } catch (error) {
            showError(t('admin.tournaments.errorUpdatingSeed'));
        } finally {
            setProcessing(false);
        }
    };

    const handleToggleCheckIn = async (player: TournamentPlayer) => {
        if (!id || processing) return;
        setProcessing(true);
        try {
            const newValue = !player.isCheckedIn;
            await checkInPlayer(id, player.id, player.uid, newValue);
            await loadData();
        } catch (error) {
            showError(t('admin.tournaments.errorCheckIn') || "Error during check-in");
        } finally {
            setProcessing(false);
        }
    };
    const handleAutoSeed = async () => {
        if (!id || processing) return;
        setProcessing(true);
        try {
            const cat = selectedCategory === 'all' ? undefined : selectedCategory;
            await autoSeedPlayers(id, cat);
            setShowRandomModal(false);
            await loadData();
        } catch (error) {
            showError(t('admin.tournaments.errorAutoSeeding'));
        } finally {
            setProcessing(false);
        }
    };

    const handleGenerateRandom = async () => {
        if (!id || processing) return;
        setProcessing(true);
        try {
            const count = parseInt(randomCount);
            for (let i = 0; i < count; i++) {
                const rnd = Math.floor(Math.random() * 10000);
                const fakeName = `Test Player ${rnd}`;
                const userRef = await addDoc(collection(db, 'users'), {
                    displayName: fakeName,
                    email: `test_${Date.now()}_${rnd}@test.com`,
                    createdAt: Timestamp.now(),
                    isManual: true,
                    role: 'player'
                });
                await addPlayerToTournament(id, {
                    name: fakeName,
                    uid: userRef.id,
                    isWildcard: false,
                    isManual: true,
                    category: randomCategory || undefined
                });
            }
            setShowRandomModal(false);
            await loadData();
        } catch (error) {
            showError(t('admin.tournaments.errorGeneratingPlayers'));
        } finally {
            setProcessing(false);
        }
    };

    const handleCleanup = () => {
        showConfirmation(
            t('admin.tournaments.deleteAllPlayers'),
            t('admin.tournaments.confirmDeleteAllTestData'),
            async () => {
                if (!id) return;
                setProcessing(true);
                try {
                    await deleteManualPlayers(id);
                    await loadData();
                } catch (error) {
                    showError(t('admin.tournaments.errorCleanup'));
                } finally {
                    setProcessing(false);
                    setConfirmModal(prev => ({ ...prev, open: false }));
                }
            },
            'danger'
        );
    };

    const filteredPlayers = players
        .filter(p =>
            p.registrationStatus === 'approved' &&
            (selectedCategory === 'all' || p.category === selectedCategory)
        )
        .sort((a, b) => {
            // 1. Seed Ascending (nulls last)
            const seedA = a.seed ?? Infinity;
            const seedB = b.seed ?? Infinity;
            if (seedA !== seedB) return seedA - seedB;

            // 2. Points Descending
            const pointsA = playerPoints[a.uid || ''] ?? 0;
            const pointsB = playerPoints[b.uid || ''] ?? 0;
            if (pointsA !== pointsB) return pointsB - pointsA;

            // 3. Name Ascending
            return a.name.localeCompare(b.name);
        });

    if (loading) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-tennis-green"></div>
        </div>
    );

    return (
        <div className="space-y-10 animate-fade-in relative">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate(`/admin/tournaments/${id}`)}
                        className="w-12 h-12 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center text-white transition-all"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-white text-3xl font-black uppercase tracking-tight">{tournament?.name} - {t('admin.tournaments.players.title')}</h1>
                        <p className="text-gray-500 font-bold uppercase text-xs tracking-widest mt-1">{t('admin.tournaments.manageRoster')}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleCleanup}
                        className="p-4 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-2xl border border-red-500/10 transition-all"
                        title={t('admin.tournaments.deleteAllPlayers')}
                    >
                        <Trash2 size={24} />
                    </button>
                    <button
                        onClick={() => setShowRandomModal(true)}
                        className="p-4 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-2xl border border-blue-500/10 transition-all"
                        title={t('admin.tournaments.genTestPlayers')}
                    >
                        <Users size={24} />
                    </button>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="bg-tennis-green hover:bg-tennis-green/90 text-tennis-dark px-8 py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-tennis-green/20 transition-all flex items-center gap-2"
                    >
                        <Plus size={20} />
                        {t('admin.tournaments.addPlayer')}
                    </button>
                </div>
            </div>

            {/* Pending Requests Section */}
            {pendingRegs.length > 0 && (
                <div className="space-y-6">
                    <h2 className="text-white text-xl font-bold uppercase tracking-tight flex items-center gap-3">
                        <Users className="text-orange-500" />
                        {t('admin.tournaments.pendingRegs', { count: pendingRegs.length })}
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {pendingRegs.map(player => (
                            <div key={player.id} className="glass border-orange-500/20 p-6 rounded-3xl space-y-4">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="text-white font-bold text-lg">{player.name}</h3>
                                        <p className="text-gray-500 text-xs">{player.email}</p>
                                        {player.category && (
                                            <span className="text-[10px] font-black uppercase tracking-widest text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded mt-2 inline-block">
                                                {t('admin.tournaments.category')}: {player.category ? t(`admin.tournaments.categories.${player.category}`) : t('common.none')}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex gap-2 pt-2">
                                    <button
                                        onClick={() => handleApprove(player)}
                                        className="flex-1 bg-tennis-green text-tennis-dark py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest hover:scale-[1.02] transition-all"
                                    >
                                        {t('common.approve')}
                                    </button>
                                    <button
                                        onClick={() => { setSelectedPlayer(player); setShowRejectModal(true); }}
                                        className="flex-1 bg-red-500/10 text-red-500 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest border border-red-500/20 hover:bg-red-500/20 transition-all"
                                    >
                                        {t('common.reject')}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Approved Players Section */}
            <div className="space-y-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <h2 className="text-white text-xl font-bold uppercase tracking-tight flex items-center gap-3">
                        <CheckCircle2 className="text-tennis-green" />
                        {t('admin.tournaments.approvedRoster', { count: players.length })}
                    </h2>

                    {tournament?.categories && tournament.categories.length > 0 && (
                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar max-w-full pb-1">
                            <button
                                onClick={() => setSelectedCategory('all')}
                                className={`px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${selectedCategory === 'all' ? 'bg-white text-tennis-dark' : 'bg-white/5 text-gray-400 hover:text-white'}`}
                            >
                                {t('common.allCategories')}
                            </button>
                            {[...(tournament.categories || [])].sort((a, b) => {
                                const order = ['OPEN', 'FIRST', 'SECOND', 'THIRD', 'FOURTH', 'FIFTH', 'ROOKIE'];
                                return order.indexOf(a.toUpperCase()) - order.indexOf(b.toUpperCase());
                            }).map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setSelectedCategory(cat)}
                                    className={`px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${selectedCategory === cat ? 'bg-white text-tennis-dark' : 'bg-white/5 text-gray-400 hover:text-white'}`}
                                >
                                    {t(`admin.tournaments.categories.${cat.toLowerCase()}`)}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 gap-4">
                    {filteredPlayers.length === 0 ? (
                        <div className="glass p-20 rounded-[40px] border-dashed border-2 border-white/10 flex flex-col items-center justify-center text-center">
                            <h3 className="text-white text-xl font-bold">{t('admin.tournaments.noPlayers')}</h3>
                            <p className="text-gray-500 mt-2">{t('admin.tournaments.noPlayersDesc')}</p>
                        </div>
                    ) : (
                        filteredPlayers.map(player => (
                            <div key={player.id} className="glass p-6 rounded-[32px] border-white/5 hover:border-white/10 transition-all flex flex-col md:flex-row items-center justify-between gap-6 group">
                                <div
                                    onClick={() => { setSelectedPlayer(player); setShowStatsModal(true); }}
                                    className="flex items-center gap-6 w-full md:w-auto cursor-pointer group"
                                >
                                    <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center text-white shrink-0 font-black text-2xl group-hover:bg-tennis-green group-hover:text-tennis-dark transition-all duration-500">
                                        {player.name.charAt(0)}
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-3">
                                            <h3 className="text-white font-bold text-lg">{player.name}</h3>
                                            {player.isWildcard && (
                                                <span className="bg-yellow-500/20 text-yellow-500 text-[8px] font-black px-2 py-0.5 rounded border border-yellow-500/20 flex items-center gap-1">
                                                    <Crown size={10} />
                                                    WC
                                                </span>
                                            )}
                                            {player.isManual && (
                                                <span className="text-gray-600 text-[8px] font-black uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded border border-white/5">{t('common.test')}</span>
                                            )}
                                        </div>
                                        <p className="text-gray-500 text-xs">{player.email || t('admin.tournaments.noEmail')}</p>
                                        <div className="flex items-center gap-4 mt-2">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-tennis-green bg-tennis-green/5 px-2 py-0.5 rounded border border-tennis-green/10">
                                                {player.category ? t(`admin.tournaments.categories.${player.category.toLowerCase()}`) : t('admin.tournaments.noCategory')}
                                            </span>
                                            <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${player.paymentStatus === 'paid' ? 'text-blue-400 bg-blue-500/5 border-blue-500/10' : 'text-gray-600 bg-white/5 border-white/5'}`}>
                                                {player.paymentStatus === 'paid' ? t('common.paid') : t('common.unpaid')}
                                            </span>
                                            {player.registrationStatus === 'rejected' && (
                                                <span className="text-[10px] font-black uppercase tracking-widest text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
                                                    {t('common.rejected') || 'Rejected'}
                                                </span>
                                            )}
                                            {player.seed && (
                                                <span className="text-[10px] font-black uppercase tracking-widest text-blue-400 bg-blue-500/5 px-2 py-0.5 rounded border border-blue-500/10">
                                                    {t('admin.tournaments.seedNum', { num: player.seed })}
                                                </span>
                                            )}
                                            {player.isCheckedIn && (
                                                <span className="text-[10px] font-black uppercase tracking-widest text-pink-400 bg-pink-500/10 px-2 py-0.5 rounded border border-pink-500/20 flex items-center gap-1">
                                                    <CheckCircle2 size={10} />
                                                    {t('admin.tournaments.checkIn.title') || "Checked In"}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                                    <button
                                        onClick={() => handleToggleCheckIn(player)}
                                        className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${player.isCheckedIn ? 'bg-pink-500/20 text-pink-400' : 'bg-white/5 text-gray-700 hover:bg-pink-500/10 hover:text-pink-400'}`}
                                        title={player.isCheckedIn ? (t('admin.tournaments.checkIn.revert') || "Revert Check In") : (t('admin.tournaments.checkIn.title') || "Check In")}
                                    >
                                        <CheckCircle2 size={20} />
                                    </button>
                                    <button
                                        onClick={() => { setSelectedPlayer(player); setSeedValue(player.seed?.toString() || ''); setShowSeedModal(true); }}
                                        className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${player.seed ? 'bg-blue-500/10 text-blue-400' : 'bg-white/5 text-gray-700 hover:text-white'}`}
                                        title={t('admin.tournaments.assignSeed')}
                                    >
                                        <ShieldAlert size={20} />
                                    </button>
                                    <button
                                        onClick={() => handleToggleWildcard(player)}
                                        className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${player.isWildcard ? 'bg-yellow-500/10 text-yellow-500' : 'bg-white/5 text-gray-700 hover:text-white'}`}
                                        title={t('admin.tournaments.toggleWildcard')}
                                    >
                                        <Crown size={20} />
                                    </button>
                                    {player.paymentStatus !== 'paid' ? (
                                        <button
                                            onClick={() => { setSelectedPlayer(player); setShowPaymentModal(true); }}
                                            className="w-12 h-12 bg-white/5 hover:bg-tennis-green hover:text-tennis-dark rounded-2xl flex items-center justify-center text-gray-500 transition-all border border-white/5 hover:border-tennis-green"
                                            title={t('admin.tournaments.recordPayment')}
                                        >
                                            <DollarSign size={20} />
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => handleRevertPayment(player)}
                                            className="w-12 h-12 bg-blue-500/10 text-blue-400 rounded-2xl flex items-center justify-center border border-blue-500/10 hover:bg-blue-500/20 transition-all"
                                            title={t('admin.tournaments.revertPayment')}
                                        >
                                            <RefreshCw size={20} />
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleRemovePlayer(player.id)}
                                        className="w-12 h-12 bg-white/5 hover:bg-red-500/20 text-gray-700 hover:text-red-500 rounded-2xl flex items-center justify-center transition-all border border-white/5 hover:border-red-500/20"
                                        title={t('admin.tournaments.removePlayer')}
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Modal: Add Player */}
            {showAddModal && (
                <>
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-40 transition-opacity" onClick={() => setShowAddModal(false)}></div>
                    <div className="fixed right-0 top-0 h-full w-full max-w-xl bg-gray-950 border-l border-white/10 z-50 p-12 overflow-y-auto transform transition-transform duration-300 animate-slide-in-right">
                        <div className="flex justify-between items-center mb-10">
                            <div>
                                <h2 className="text-white text-3xl font-black uppercase tracking-tight">{t('admin.tournaments.addPlayer')}</h2>
                                <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mt-1">{t('admin.tournaments.manualEnroll')}</p>
                            </div>
                            <button onClick={() => setShowAddModal(false)} className="w-12 h-12 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center text-gray-500 hover:text-white transition-all">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleAddPlayer} className="space-y-8">
                            <div className="space-y-4">
                                <label className="text-gray-500 text-[10px] font-black uppercase tracking-widest ml-1">{t('admin.tournaments.fullName')}</label>
                                <input
                                    required
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-white font-bold focus:outline-none focus:border-tennis-green/50"
                                    value={newPlayer.name}
                                    onChange={e => setNewPlayer({ ...newPlayer, name: e.target.value })}
                                    placeholder={t('admin.tournaments.phFullName')}
                                />
                            </div>
                            <div className="space-y-4">
                                <label className="text-gray-500 text-[10px] font-black uppercase tracking-widest ml-1">{t('admin.tournaments.emailOptional')}</label>
                                <input
                                    type="email"
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-white font-bold focus:outline-none focus:border-tennis-green/50"
                                    value={newPlayer.email}
                                    onChange={e => setNewPlayer({ ...newPlayer, email: e.target.value })}
                                    placeholder={t('admin.tournaments.phEmail')}
                                />
                                <p className="text-[10px] text-gray-600 italic">{t('admin.tournaments.emailEmailHint')}</p>
                            </div>

                            <div
                                onClick={() => setNewPlayer({ ...newPlayer, isWildcard: !newPlayer.isWildcard })}
                                className={`p-6 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${newPlayer.isWildcard ? 'bg-yellow-500/10 border-yellow-500/50' : 'bg-white/5 border-white/10 opacity-50'}`}
                            >
                                <div className="flex items-center gap-4">
                                    <Crown className={newPlayer.isWildcard ? 'text-yellow-500' : 'text-gray-500'} />
                                    <div>
                                        <p className={`font-bold text-sm uppercase tracking-tight ${newPlayer.isWildcard ? 'text-white' : 'text-gray-500'}`}>{t('admin.tournaments.wildcardEntry')}</p>
                                        <p className="text-[10px] text-gray-600">{t('admin.tournaments.goldenTicket')}</p>
                                    </div>
                                </div>
                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${newPlayer.isWildcard ? 'border-yellow-500 bg-yellow-500' : 'border-gray-800'}`}>
                                    {newPlayer.isWildcard && <Check size={14} className="text-tennis-dark" />}
                                </div>
                            </div>

                            <button
                                disabled={processing}
                                className="w-full bg-tennis-green text-tennis-dark py-6 rounded-3xl font-black uppercase tracking-widest shadow-2xl transition-all flex items-center justify-center gap-3 disabled:opacity-50 mt-10"
                            >
                                {processing ? <RefreshCw className="animate-spin" /> : <UserPlus size={24} />}
                                {t('admin.tournaments.enrollPlayer')}
                            </button>
                        </form>
                    </div>
                </>
            )}

            {/* Modal: Record Payment */}
            {showPaymentModal && selectedPlayer && (
                <>
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-40 transition-opacity" onClick={() => setShowPaymentModal(false)}></div>
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
                        <div className="bg-gray-950 border border-white/10 w-full max-w-lg rounded-[40px] p-12 space-y-8 animate-scale-in">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h2 className="text-white text-3xl font-black uppercase tracking-tight">{t('admin.tournaments.entryFeeLabel')}</h2>
                                    <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mt-1">{t('admin.tournaments.recordManualPayment')}</p>
                                </div>
                                <button onClick={() => setShowPaymentModal(false)} className="w-12 h-12 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center text-gray-500 transition-all">
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="bg-white/5 rounded-3xl p-6 text-center">
                                <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-1">{t('admin.tournaments.player')}</p>
                                <p className="text-white text-2xl font-black">{selectedPlayer.name}</p>
                            </div>

                            <form onSubmit={handlePayment} className="space-y-6">
                                <div className="space-y-4">
                                    <label className="text-gray-500 text-[10px] font-black uppercase tracking-widest ml-1">{t('admin.tournaments.amount')} ($)</label>
                                    <input
                                        required
                                        type="number"
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-white font-black text-3xl text-center focus:outline-none focus:border-tennis-green/50"
                                        value={paymentInfo.amount}
                                        onChange={e => setPaymentInfo({ ...paymentInfo, amount: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-4">
                                    <label className="text-gray-500 text-[10px] font-black uppercase tracking-widest ml-1">{t('admin.tournaments.internalNote')}</label>
                                    <input
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-white font-bold focus:outline-none focus:border-tennis-green/50"
                                        value={paymentInfo.note}
                                        onChange={e => setPaymentInfo({ ...paymentInfo, note: e.target.value })}
                                        placeholder={t('admin.tournaments.phInternalNote')}
                                    />
                                </div>
                                <button
                                    disabled={processing}
                                    className="w-full bg-tennis-green text-tennis-dark py-6 rounded-3xl font-black uppercase tracking-widest shadow-2xl transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                                >
                                    {processing ? <RefreshCw className="animate-spin" /> : <CheckCircle2 size={24} />}
                                    {t('admin.tournaments.confirmPayment')}
                                </button>
                            </form>
                        </div>
                    </div>
                </>
            )}

            {/* Modal: Reject Request */}
            {showRejectModal && selectedPlayer && (
                <>
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-40 transition-opacity" onClick={() => setShowRejectModal(false)}></div>
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
                        <div className="bg-gray-950 border border-white/10 w-full max-w-lg rounded-[40px] p-12 space-y-8 animate-scale-in">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h2 className="text-red-500 text-3xl font-black uppercase tracking-tight">{t('common.reject')}</h2>
                                    <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mt-1">{t('admin.tournaments.registrationDenial')}</p>
                                </div>
                                <button onClick={() => setShowRejectModal(false)} className="w-12 h-12 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center text-gray-500 transition-all">
                                    <X size={24} />
                                </button>
                            </div>

                            <p className="text-gray-400">{t('admin.tournaments.denyingRegFor')} <span className="font-bold text-white">{selectedPlayer.name}</span>. {t('admin.tournaments.provideReasonSent')}</p>

                            <div className="space-y-4">
                                <label className="text-gray-500 text-[10px] font-black uppercase tracking-widest ml-1">{t('admin.tournaments.reasonRejection')}</label>
                                <textarea
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-white font-bold focus:outline-none focus:border-red-500/50 min-h-[120px]"
                                    value={rejectReason}
                                    onChange={e => setRejectReason(e.target.value)}
                                    placeholder={t('admin.tournaments.phReasonRejection')}
                                />
                            </div>

                            <button
                                onClick={handleReject}
                                disabled={processing || !rejectReason.trim()}
                                className="w-full bg-red-500 text-white py-6 rounded-3xl font-black uppercase tracking-widest shadow-2xl shadow-red-500/20 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                            >
                                {processing ? <RefreshCw className="animate-spin" /> : <X size={24} />}
                                {t('admin.tournaments.confirmRejection')}
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* Modal: Random (Developer Tools) */}
            {showRandomModal && (
                <>
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-40 transition-opacity" onClick={() => setShowRandomModal(false)}></div>
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
                        <div className="bg-gray-950 border border-white/10 w-full max-w-lg rounded-[40px] p-12 space-y-8 animate-scale-in">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h2 className="text-white text-3xl font-black uppercase tracking-tight">{t('admin.tournaments.testSuite')}</h2>
                                    <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mt-1">{t('admin.tournaments.genRandomPlayers')}</p>
                                </div>
                                <button onClick={() => setShowRandomModal(false)} className="w-12 h-12 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center text-gray-500 transition-all">
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="space-y-6">
                                <div className="space-y-4">
                                    <label className="text-gray-500 text-[10px] font-black uppercase tracking-widest ml-1">{t('admin.tournaments.numPlayersLabel')}</label>
                                    <input
                                        type="number"
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-white font-black text-2xl text-center focus:outline-none focus:border-blue-500/50"
                                        value={randomCount}
                                        onChange={e => setRandomCount(e.target.value)}
                                    />
                                </div>

                                <div className="space-y-4">
                                    <label className="text-gray-500 text-[10px] font-black uppercase tracking-widest ml-1">{t('admin.tournaments.assignToCategory')}</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {CATEGORY_ORDER.map(cat => (
                                            <button
                                                key={cat}
                                                onClick={() => setRandomCategory(cat === randomCategory ? null : cat)}
                                                className={`px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all border ${randomCategory === cat ? 'bg-blue-500 text-white border-blue-500' : 'bg-white/5 text-gray-400 border-white/10 hover:border-white/20'}`}
                                            >
                                                {t(`admin.tournaments.categories.${cat.toLowerCase()}`)}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <button
                                    onClick={handleGenerateRandom}
                                    disabled={processing}
                                    className="w-full bg-blue-500 text-white py-6 rounded-3xl font-black uppercase tracking-widest shadow-2xl shadow-blue-500/20 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                                >
                                    {processing ? <RefreshCw className="animate-spin" /> : <Users size={24} />}
                                    {t('admin.tournaments.runGenerator')}
                                </button>

                                <div className="pt-4 border-t border-white/5 space-y-4">
                                    <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest text-center">{t('admin.tournaments.batchOperations')}</p>
                                    <button
                                        onClick={handleAutoSeed}
                                        disabled={processing}
                                        className="w-full bg-white/5 hover:bg-white/10 text-white py-4 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 border border-white/5"
                                    >
                                        <ShieldAlert size={16} />
                                        {t('admin.tournaments.autoSeedClub')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Modal: Seed Management */}
            {showSeedModal && (
                <>
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-40 transition-opacity" onClick={() => setShowSeedModal(false)}></div>
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
                        <div className="bg-gray-950 border border-white/10 w-full max-w-lg rounded-[40px] p-12 space-y-8 animate-scale-in">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h2 className="text-white text-3xl font-black uppercase tracking-tight">{t('admin.tournaments.assignSeed')}</h2>
                                    <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mt-1">{selectedPlayer?.name}</p>
                                </div>
                                <button onClick={() => setShowSeedModal(false)} className="w-12 h-12 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center text-gray-500 transition-all">
                                    <X size={24} />
                                </button>
                            </div>

                            <form onSubmit={handleUpdateSeed} className="space-y-6">
                                <div className="space-y-4">
                                    <label className="text-gray-400 text-xs font-bold uppercase tracking-widest ml-1">{t('admin.tournaments.seedInputLabel')}</label>
                                    <input
                                        type="number"
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-white text-3xl font-black text-center focus:outline-none focus:border-tennis-green/50 transition-all"
                                        placeholder={t('admin.tournaments.phSeedInput')}
                                        value={seedValue}
                                        onChange={e => setSeedValue(e.target.value)}
                                        autoFocus
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={processing}
                                    className="w-full bg-tennis-green text-tennis-dark py-6 rounded-3xl font-black uppercase tracking-widest shadow-2xl shadow-tennis-green/20 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                                >
                                    {processing ? <RefreshCw className="animate-spin" /> : <Check size={24} />}
                                    {t('admin.tournaments.saveSeedAssignment')}
                                </button>
                            </form>
                        </div>
                    </div>
                </>
            )}

            {/* Generic Confirmation Modal */}
            {confirmModal.open && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-fade-in">
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
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[110] flex items-center justify-center p-6 animate-fade-in">
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

            {/* Player Stats Modal */}
            {showStatsModal && selectedPlayer && (
                <PlayerStatsModal
                    player={selectedPlayer}
                    onClose={() => setShowStatsModal(false)}
                />
            )}
        </div>
    );
};

export default TournamentPlayersPage;
