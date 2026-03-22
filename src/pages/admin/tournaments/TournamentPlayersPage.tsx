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
    Users,
    X,
    AlertTriangle,
    Banknote,
    Building2
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../../../config/firebase';
import { useAuth } from '../../../context/AuthContext';
import { useLanguage } from '../../../context/LanguageContext';
import { notifyPlayerApproved } from '../../../services/notificationService';
import { completeTransaction, createTransaction, revertLatestTransactionForUser } from '../../../services/paymentService';
import { approveRegistration, getPendingRegistrations, rejectRegistration, subscribeToTournamentPendingRegistrations } from '../../../services/registrationService';
import {
    addPlayerToTournament,
    autoSeedPlayers,
    checkInPlayer,
    deleteManualPlayers,
    getTournamentById,
    getTournamentPlayers,
    removePlayerFromTournament,
    updatePlayerInTournament,
    updatePlayerSeed
} from '../../../services/tournamentService';
import {
    getDoublesTeams,
    createDoublesTeam,
    removeDoublesTeam,
    updateDoublesTeamSeed,
    updateDoublesTeam,
    checkInDoublesPlayer,
    rejectDoublesTeamRegistration,
    autoSeedDoublesTeams
} from '../../../services/doublesTeamService';
import {
    getPendingRequestsForTournament,
    acceptDoublesRequest,
    rejectDoublesRequest
} from '../../../services/doublesRequestService';
import type { DoublesRequest } from '../../../services/doublesRequestService';
import type { TournamentCategory, TournamentData, TournamentPlayer } from '../../../services/types';
import type { DoublesTeam } from '../../../services/doublesTeamService';
import PlayerStatsModal from '../../../components/admin/PlayerStatsModal';

const TournamentPlayersPage = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { t } = useLanguage();

    const [tournament, setTournament] = useState<TournamentData | null>(null);
    const [players, setPlayers] = useState<TournamentPlayer[]>([]);
    const [pendingRegs, setPendingRegs] = useState<TournamentPlayer[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<TournamentCategory | ''>('');

    const [selectedModality, setSelectedModality] = useState<'singles' | 'doubles' | 'requests'>('singles');
    const [doublesTeams, setDoublesTeams] = useState<DoublesTeam[]>([]);
    const [doublesRequests, setDoublesRequests] = useState<DoublesRequest[]>([]);

    // Modals
    const [showAddModal, setShowAddModal] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showRandomModal, setShowRandomModal] = useState(false);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [showSeedModal, setShowSeedModal] = useState(false);
    const [showStatsModal, setShowStatsModal] = useState(false);

    // Form States
    const [newPlayer, setNewPlayer] = useState({ name: '', player2Name: '', email: '', isWildcard: false });
    const [paymentInfo, setPaymentInfo] = useState({ amount: '50', note: '', type: 'cash' });
    const [selectedPlayer, setSelectedPlayer] = useState<TournamentPlayer | null>(null);
    const [selectedTeam, setSelectedTeam] = useState<DoublesTeam | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [randomCount, setRandomCount] = useState('5');
    const [seedValue, setSeedValue] = useState('');

    // Generic Modal States
    const [confirmModal, setConfirmModal] = useState<{
        open: boolean;
        title: string;
        message: string;
        onConfirm: () => Promise<void>;
        type: 'danger' | 'warning' | 'info' | 'success';
    }>({ open: false, title: '', message: '', onConfirm: async () => { }, type: 'danger' });

    const [errorModal, setErrorModal] = useState<{
        open: boolean;
        message: string;
    }>({ open: false, message: '' });

    const showError = (msg: string) => {
        setErrorModal({ open: true, message: msg });
    };

    const showConfirmation = (title: string, message: string, onConfirm: () => Promise<void>, type: 'danger' | 'warning' | 'info' | 'success' = 'danger') => {
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

            if (tData) {
                const hasDoubles = tData.modalities?.doubles || tData.modalityConfig?.doubles;
                if (hasDoubles) {
                    const [dTeams, dReqs] = await Promise.all([
                        getDoublesTeams(id),
                        getPendingRequestsForTournament(id)
                    ]);
                    setDoublesTeams(dTeams);
                    setDoublesRequests(dReqs);
                }

                // Auto-select modality if only one is available
                if (tData.modalityConfig) {
                    if (tData.modalityConfig.singles && !tData.modalityConfig.doubles) {
                        setSelectedModality('singles');
                    } else if (!tData.modalityConfig.singles && tData.modalityConfig.doubles) {
                        setSelectedModality('doubles');
                    }
                } else if (tData.modalities) {
                    if (tData.modalities.singles && !tData.modalities.doubles) {
                        setSelectedModality('singles');
                    } else if (!tData.modalities.singles && tData.modalities.doubles) {
                        setSelectedModality('doubles');
                    }
                }

                // Auto-select first category if none selected or if selected is 'all'
                const availableCats = [...((tData.categories || tData.modalityConfig?.[selectedModality === 'requests' ? 'doubles' : selectedModality]?.categories) || [])].sort((a, b) => {
                    const order = ['OPEN', 'FIRST', 'SECOND', 'THIRD', 'FOURTH', 'FIFTH', 'ROOKIE'];
                    const idxA = order.indexOf(a.toUpperCase());
                    const idxB = order.indexOf(b.toUpperCase());
                    return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
                });

                if (availableCats.length > 0 && !selectedCategory) {
                    setSelectedCategory(availableCats[0] as TournamentCategory);
                }
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [id, selectedModality, selectedCategory]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    useEffect(() => {
        if (!id) return;
        const unsubscribe = subscribeToTournamentPendingRegistrations(id, (regs) => {
            setPendingRegs(regs);
        });
        return () => unsubscribe();
    }, [id]);

    const handleAddPlayer = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id || !newPlayer.name.trim() || processing) return;

        setProcessing(true);
        try {
            const tournamentSport = tournament?.sport || 'tennis';
            const cat = selectedCategory as TournamentCategory;

            let sportsProfiles: any = {};
            if (cat) {
                if (tournamentSport === 'tennis') {
                    const { CATEGORY_NTRP_MAP } = await import('../../../services/profileRequestService');
                    const { calculateNtrpPoints } = await import('../../../services/ntrpService');
                    sportsProfiles.tennis = {
                        category: cat,
                        ntrp: CATEGORY_NTRP_MAP[cat.toLowerCase()] || 'Beginner (1.0 - 2.5)',
                        ntrp_points: calculateNtrpPoints(cat, 0),
                        points: 0
                    };
                } else {
                    sportsProfiles[tournamentSport] = {
                        category: cat,
                        points: 0
                    };
                }
            }

            if (selectedModality === 'doubles') {
                if (!newPlayer.player2Name.trim()) return;

                const user1Ref = await addDoc(collection(db, 'users'), {
                    displayName: newPlayer.name.trim(),
                    createdAt: Timestamp.now(),
                    isManual: true,
                    role: 'player',
                    sportsProfiles
                });
                const user2Ref = await addDoc(collection(db, 'users'), {
                    displayName: newPlayer.player2Name.trim(),
                    createdAt: Timestamp.now(),
                    isManual: true,
                    role: 'player',
                    sportsProfiles
                });

                await createDoublesTeam(id, {
                    player1Uid: user1Ref.id,
                    player1Name: newPlayer.name.trim(),
                    player2Uid: user2Ref.id,
                    player2Name: newPlayer.player2Name.trim(),
                    category: cat,
                    status: 'approved',
                    paymentStatus: 'paid',
                    paidAt: Timestamp.now() as any,
                    isManual: true,
                    isWildcard: newPlayer.isWildcard,
                    addedAt: Timestamp.now()
                } as any);
            } else {
                let userUid: string | undefined = undefined;
                const email = newPlayer.email?.trim();

                if (email) {
                    const q = query(collection(db, 'users'), where('email', '==', email));
                    const snap = await getDocs(q);
                    if (!snap.empty) {
                        userUid = snap.docs[0].id;
                    } else {
                        const userRef = await addDoc(collection(db, 'users'), {
                            displayName: newPlayer.name.trim(),
                            email: email,
                            createdAt: Timestamp.now(),
                            isManual: true,
                            role: 'player',
                            sportsProfiles
                        });
                        userUid = userRef.id;
                    }
                } else {
                    const userRef = await addDoc(collection(db, 'users'), {
                        displayName: newPlayer.name.trim(),
                        createdAt: Timestamp.now(),
                        isManual: true,
                        role: 'player',
                        sportsProfiles
                    });
                    userUid = userRef.id;
                }

                await addPlayerToTournament(id, {
                    name: newPlayer.name.trim(),
                    uid: userUid,
                    email: email || undefined,
                    isWildcard: newPlayer.isWildcard,
                    category: cat,
                    registrationStatus: 'approved'
                });
            }

            setShowAddModal(false);
            setNewPlayer({ name: '', player2Name: '', email: '', isWildcard: false });
            await loadData();
            showConfirmation(t('common.success'), t('admin.tournaments.players.successAdd'), async () => { }, 'success');
        } catch (error) {
            console.error(error);
            showError("Failed to add player");
        } finally {
            setProcessing(false);
        }
    };

    const handleGenerateRandom = async () => {
        const catToUse = selectedCategory as TournamentCategory;
        if (!id || processing || !catToUse) return;
        setProcessing(true);
        try {
            const count = parseInt(randomCount);
            const tournamentSport = tournament?.sport || 'tennis';
            const { CATEGORY_NTRP_MAP } = await import('../../../services/profileRequestService');
            const { calculateNtrpPoints } = await import('../../../services/ntrpService');

            const promises = [];
            for (let i = 0; i < count; i++) {
                promises.push((async () => {
                    const rnd = Math.floor(Math.random() * 9000) + 1000;
                    let sportsProfiles: any = {};
                    if (tournamentSport === 'tennis') {
                        sportsProfiles.tennis = {
                            category: catToUse,
                            ntrp: CATEGORY_NTRP_MAP[catToUse.toLowerCase()] || 'Beginner (1.0 - 2.5)',
                            ntrp_points: calculateNtrpPoints(catToUse, 0),
                            points: 0
                        };
                    } else {
                        sportsProfiles[tournamentSport] = {
                            category: catToUse,
                            points: 0
                        };
                    }

                    if (selectedModality === 'doubles') {
                        const p1Name = `Rnd ${rnd} A`;
                        const p2Name = `Rnd ${rnd} B`;
                        const u1 = await addDoc(collection(db, 'users'), { displayName: p1Name, isManual: true, role: 'player', sportsProfiles, createdAt: Timestamp.now() });
                        const u2 = await addDoc(collection(db, 'users'), { displayName: p2Name, isManual: true, role: 'player', sportsProfiles, createdAt: Timestamp.now() });
                        await createDoublesTeam(id, {
                            player1Uid: u1.id, player1Name: p1Name,
                            player2Uid: u2.id, player2Name: p2Name,
                            category: catToUse, status: 'approved', paymentStatus: 'paid', isManual: true, addedAt: Timestamp.now()
                        } as any);
                    } else {
                        const name = `Test Player ${rnd}`;
                        const u = await addDoc(collection(db, 'users'), { displayName: name, isManual: true, role: 'player', sportsProfiles, createdAt: Timestamp.now() });
                        await addPlayerToTournament(id, { name, uid: u.id, category: catToUse, registrationStatus: 'approved' });
                    }
                })());
            }

            await Promise.all(promises);
            await loadData();
            setShowRandomModal(false);
            showConfirmation(t('common.success'), t('admin.tournaments.players.successGenerate'), async () => { }, 'success');
        } catch (error) {
            console.error(error);
            showError("Failed to generate test players");
        } finally {
            setProcessing(false);
        }
    };

    const handleRemove = async (item: TournamentPlayer | DoublesTeam) => {
        if (!id) return;
        showConfirmation(
            t('admin.tournaments.removePlayer'),
            t('admin.tournaments.removePlayerConfirm'),
            async () => {
                setProcessing(true);
                try {
                    if ('player1Uid' in item) {
                        await removeDoublesTeam(id, (item as DoublesTeam).id);
                    } else {
                        await removePlayerFromTournament(id, (item as TournamentPlayer).id);
                    }
                    await loadData();
                    showConfirmation(t('common.success'), t('admin.tournaments.players.successRemove'), async () => { }, 'success');
                } catch (error) {
                    console.error(error);
                    showError("Failed to remove player/team");
                } finally {
                    setProcessing(false);
                }
            }
        );
    };

    const handleToggleCheckIn = async (item: TournamentPlayer | DoublesTeam) => {
        if (!id || processing) return;
        setProcessing(true);
        try {
            if ('player1Uid' in item) {
                const team = item as DoublesTeam;
                const newValue = !team.player1CheckedIn;
                await checkInDoublesPlayer(id, team.id, team.player1Uid, newValue);
                if (team.player2Uid) await checkInDoublesPlayer(id, team.id, team.player2Uid, newValue);
            } else {
                const player = item as TournamentPlayer;
                await checkInPlayer(id, player.id, player.uid, !player.isCheckedIn);
            }
            await loadData();
            showConfirmation(t('common.success'), t('admin.tournaments.players.successUpdate'), async () => { }, 'success');
        } catch (error) {
            console.error(error);
            showError("Failed to update check-in");
        } finally {
            setProcessing(false);
        }
    };

    const handleToggleWildcard = async (item: TournamentPlayer | DoublesTeam) => {
        if (!id || processing) return;
        setProcessing(true);
        try {
            const updates = { isWildcard: !item.isWildcard };
            if ('player1Uid' in item) {
                await updateDoublesTeam(id, item.id, updates);
            } else {
                await updatePlayerInTournament(id, item.id, updates);
            }
            await loadData();
            showConfirmation(t('common.success'), t('admin.tournaments.players.successUpdate'), async () => { }, 'success');
        } catch (error) {
            console.error(error);
            showError("Failed to update wildcard");
        } finally {
            setProcessing(false);
        }
    };

    const handleUpdateSeed = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id || processing) return;
        const val = seedValue.trim() === '' ? null : parseInt(seedValue);
        setProcessing(true);
        try {
            if (selectedModality === 'doubles' && selectedTeam) {
                await updateDoublesTeamSeed(id, selectedTeam.id, val);
            } else if (selectedPlayer) {
                await updatePlayerSeed(id, selectedPlayer.id, val);
            }
            setShowSeedModal(false);
            await loadData();
            showConfirmation(t('common.success'), t('admin.tournaments.players.successUpdate'), async () => { }, 'success');
        } catch (error) {
            console.error(error);
            showError("Failed to update seed");
        } finally {
            setProcessing(false);
        }
    };

    const handleAutoSeed = async () => {
        if (!id || processing) return;
        setProcessing(true);
        try {
            const cat = selectedCategory as TournamentCategory;
            if (selectedModality === 'doubles') {
                await autoSeedDoublesTeams(id, cat);
            } else {
                await autoSeedPlayers(id, cat);
            }
            await loadData();
            showConfirmation(t('common.success'), t('admin.tournaments.players.successAutoSeed'), async () => { }, 'success');
        } catch (error) {
            console.error(error);
            showError("Failed to auto-seed");
        } finally {
            setProcessing(false);
        }
    };

    const handleRecordPayment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id || (!selectedPlayer && !selectedTeam) || processing) return;
        setProcessing(true);
        try {
            const isDoubles = selectedModality === 'doubles';
            const item = isDoubles ? selectedTeam! : selectedPlayer!;
            const txId = await createTransaction({
                userId: isDoubles ? (item as DoublesTeam).player1Uid : (item as TournamentPlayer).uid || 'guest',
                userName: isDoubles ? ((item as DoublesTeam).teamName || `${(item as DoublesTeam).player1Name} / ${(item as DoublesTeam).player2Name}`) : (item as TournamentPlayer).name,
                amount: parseFloat(paymentInfo.amount),
                type: 'entry_fee',
                referenceId: id,
                referenceName: (tournament?.name || '') + ' Entry',
                category: item.category || null,
                modality: isDoubles ? 'doubles' : 'singles',
                doublesTeamId: isDoubles ? item.id : null,
                tournamentPlayerId: isDoubles ? null : (item as TournamentPlayer).id,
                clubId: tournament?.clubId,
                paymentMethod: paymentInfo.type
            } as any);
            await completeTransaction(txId, 'manual_admin', paymentInfo.type, { note: paymentInfo.note });
            setShowPaymentModal(false);
            setPaymentInfo({ amount: tournament?.entryFee?.toString() || '50', note: '', type: 'cash' });
            await loadData();
            showConfirmation(t('common.success'), t('admin.tournaments.players.successRecord'), async () => { }, 'success');
        } catch (error) {
            console.error(error);
            showError("Failed to record payment");
        } finally {
            setProcessing(false);
        }
    };

    const handleRevertPayment = async (item: TournamentPlayer | DoublesTeam) => {
        if (!id || processing) return;

        const name = 'player1Uid' in item ? (item as DoublesTeam).teamName || `${(item as DoublesTeam).player1Name} / ${(item as DoublesTeam).player2Name}` : (item as TournamentPlayer).name;

        showConfirmation(
            t('admin.tournaments.players.revertTitle'),
            t('admin.tournaments.players.revertConfirm', { name }),
            async () => {
                setProcessing(true);
                try {
                    const uid = 'player1Uid' in item ? (item as DoublesTeam).player1Uid : (item as TournamentPlayer).uid;
                    const playerId = 'player1Uid' in item ? item.id : (item as TournamentPlayer).id;

                    const success = await revertLatestTransactionForUser(id, uid, playerId);
                    if (success) {
                        await loadData();
                        showConfirmation(t('common.success'), t('admin.tournaments.players.revertedSuccess'), async () => { }, 'success');
                    } else {
                        showError(t('admin.tournaments.players.revertError'));
                    }
                } catch (error) {
                    console.error(error);
                    showError(t('admin.tournaments.players.revertError'));
                } finally {
                    setProcessing(false);
                }
            },
            'warning'
        );
    };

    const handleAcceptRequest = async (request: DoublesRequest) => {
        if (!id || processing) return;
        setProcessing(true);
        try {
            await acceptDoublesRequest(id, request.id!);
            loadData();
        } catch (error) {
            console.error(error);
            showError("Failed to accept request");
        } finally {
            setProcessing(false);
        }
    };

    const handleRejectRequest = async (request: DoublesRequest) => {
        if (!id || processing) return;
        setProcessing(true);
        try {
            await rejectDoublesRequest(id, request.id!);
            await loadData();
            showConfirmation(t('common.success'), t('admin.tournaments.players.successUpdate'), async () => { }, 'success');
        } catch (error) {
            console.error(error);
            showError("Failed to reject request");
        } finally {
            setProcessing(false);
        }
    };

    const handleApproveRegistration = async (playerId: string) => {
        if (!id || processing) return;
        setProcessing(true);
        try {
            await approveRegistration(id, playerId, user?.uid || 'system');
            await loadData();
            showConfirmation(t('common.success'), t('admin.tournaments.players.successUpdate'), async () => { }, 'success');
        } catch (error) {
            console.error(error);
            showError("Failed to approve registration");
        } finally {
            setProcessing(false);
        }
    };

    const handleApprovePayment = async (team: DoublesTeam) => {
        if (!id || processing) return;
        setProcessing(true);
        try {
            await updateDoublesTeam(id, team.id, { paymentStatus: 'paid', status: 'approved', paidAt: Timestamp.now() as any });
            await notifyPlayerApproved(team.player1Uid, tournament?.name || '', id);
            if (team.player2Uid) await notifyPlayerApproved(team.player2Uid, tournament?.name || '', id);
            await loadData();
            showConfirmation(t('common.success'), t('admin.tournaments.players.successUpdate'), async () => { }, 'success');
        } catch (error) {
            console.error(error);
            showError("Failed to approve payment");
        } finally {
            setProcessing(false);
        }
    };

    const handleRejectRegistration = async () => {
        if (!id || (!selectedPlayer && !selectedTeam) || !rejectReason.trim() || processing) return;
        setProcessing(true);
        try {
            if (selectedModality === 'doubles' && selectedTeam) {
                await rejectDoublesTeamRegistration(id, selectedTeam.id, rejectReason);
            } else if (selectedPlayer) {
                await rejectRegistration(id, selectedPlayer.id, user?.uid || 'system', rejectReason);
            }
            setShowRejectModal(false);
            setRejectReason('');
            loadData();
        } catch (error) {
            console.error(error);
            showError("Failed to reject registration");
        } finally {
            setProcessing(false);
        }
    };

    const handleCleanup = async () => {
        if (!id || processing) return;

        const categoryLabel = selectedCategory ? t(`admin.tournaments.categories.${(selectedCategory as string).toLowerCase()}`) : '---';

        showConfirmation(
            t('common.attention'),
            t('admin.tournaments.players.cleanupConfirm', {
                modality: selectedModality === 'doubles' ? t('admin.tournaments.modalities.doubles') : t('admin.tournaments.modalities.singles'),
                category: categoryLabel
            }),
            async () => {
                setProcessing(true);
                try {
                    await deleteManualPlayers(id, selectedModality === 'doubles' ? 'doubles' : 'singles', selectedCategory as TournamentCategory);
                    await loadData();
                    showConfirmation(t('common.success'), t('admin.tournaments.players.successDelete'), async () => { }, 'success');
                } catch (error) {
                    console.error(error);
                    showError("Failed to cleanup players");
                } finally {
                    setProcessing(false);
                }
            },
            'danger'
        );
    };

    const filteredItems = selectedModality === 'doubles'
        ? doublesTeams.filter(t => t.category === selectedCategory)
        : players.filter(p => p.category === selectedCategory);

    const currentPending = selectedModality === 'doubles'
        ? doublesTeams.filter(t => t.paymentStatus === 'unpaid' && !!t.paymentProofUrl)
        : pendingRegs;

    if (loading) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-tennis-green"></div>
        </div>
    );

    return (
        <div className="space-y-10 animate-fade-in relative">
            {/* Header omitted for brevity, same as before but ensured buttons call correct handlers */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(`/admin/tournaments/${id}`)} className="w-12 h-12 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center text-white transition-all"><ArrowLeft size={20} /></button>
                    <div>
                        <h1 className="text-white text-3xl font-black uppercase tracking-tight">{tournament?.name} - {t('admin.tournaments.players.title')}</h1>
                        <p className="text-gray-500 font-bold uppercase text-xs tracking-widest mt-1">{t('admin.tournaments.manageRoster')}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={handleCleanup} className="p-4 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-2xl border border-red-500/10 transition-all"><Trash2 size={24} /></button>
                    <button onClick={() => setShowRandomModal(true)} className="p-4 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-2xl border border-blue-500/10 transition-all"><Users size={24} /></button>
                    <button onClick={() => setShowAddModal(true)} className="bg-tennis-green hover:bg-tennis-green/90 text-tennis-dark px-8 py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl transition-all flex items-center gap-2">
                        <Plus size={20} />
                        {selectedModality === 'doubles' ? t('admin.tournaments.addTeam') : t('admin.tournaments.addPlayer')}
                    </button>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-4">
                {(tournament?.modalities?.doubles || tournament?.modalityConfig?.doubles) && (
                    <div className="flex items-center gap-4 bg-white/5 p-1.5 rounded-2xl w-fit">
                        {(['singles', 'doubles', 'requests'] as const).map(mod => (
                            <button key={mod} onClick={() => setSelectedModality(mod)} className={`px-8 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all ${selectedModality === mod ? 'bg-tennis-green text-tennis-dark' : 'text-gray-500 hover:text-white'}`}>
                                {mod === 'requests' ? `${t('admin.tournaments.players.requests')} (${doublesRequests.length})` : (mod === 'doubles' ? t('admin.tournaments.modalities.doubles') : t('admin.tournaments.modalities.singles')) + ` (${mod === 'doubles' ? doublesTeams.length : players.length})`}
                            </button>
                        ))}
                    </div>
                )}

                <div className="flex items-center gap-2 bg-white/5 p-1.5 rounded-2xl w-fit">
                    {(([...((tournament?.categories || tournament?.modalityConfig?.[selectedModality === 'requests' ? 'doubles' : selectedModality]?.categories) || [])].sort((a, b) => {
                        const order = ['OPEN', 'FIRST', 'SECOND', 'THIRD', 'FOURTH', 'FIFTH', 'ROOKIE'];
                        const idxA = order.indexOf(a.toUpperCase());
                        const idxB = order.indexOf(b.toUpperCase());
                        return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
                    })).map(cat => {
                        const count = selectedModality === 'doubles'
                            ? doublesTeams.filter(t => t.category === cat).length
                            : players.filter(p => p.category === cat).length;
                        return (
                            <button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-4 py-2 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all ${selectedCategory === cat ? 'bg-tennis-green/20 text-tennis-green' : 'text-gray-500 hover:text-white'}`}>
                                {t(`admin.tournaments.categories.${cat.toLowerCase()}`)} <span className="opacity-60 ml-1">{count}</span>
                            </button>
                        );
                    }))}
                </div>
            </div>

            {selectedModality === 'requests' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {doublesRequests.map(req => (
                        <div key={req.id} className="glass p-6 rounded-3xl space-y-4">
                            <h3 className="text-white font-bold">{req.fromUserName} {'->'} {req.toUserName}</h3>
                            <div className="flex gap-2">
                                <button onClick={() => handleAcceptRequest(req)} className="flex-1 bg-blue-500 text-white py-2 rounded-xl text-xs font-bold uppercase">Accept</button>
                                <button onClick={() => handleRejectRequest(req)} className="flex-1 bg-red-500/10 text-red-500 py-2 rounded-xl text-xs font-bold uppercase">Reject</button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="space-y-8">
                    {currentPending.length > 0 && (
                        <div className="space-y-4">
                            <h2 className="text-white text-xl font-bold uppercase">{t('admin.tournaments.pendingRegistrations')}</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {currentPending.map(item => (
                                    <div key={item.id} className="glass p-6 rounded-3xl flex justify-between items-center">
                                        <div>
                                            <h3 className="text-white font-bold">{('player1Uid' in item) ? (item as DoublesTeam).teamName || `${(item as DoublesTeam).player1Name} / ${(item as DoublesTeam).player2Name}` : (item as TournamentPlayer).name}</h3>
                                            <p className="text-gray-500 text-xs">{item.category}</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button title={t('common.approve')} onClick={() => ('player1Uid' in item) ? handleApprovePayment(item as DoublesTeam) : handleApproveRegistration((item as TournamentPlayer).id)} className="bg-tennis-green p-2 rounded-xl text-white"><Check size={20} /></button>
                                            <button title={t('common.reject')} onClick={() => { if ('player1Uid' in item) setSelectedTeam(item as DoublesTeam); else setSelectedPlayer(item as TournamentPlayer); setShowRejectModal(true); }} className="bg-red-500/10 p-2 rounded-xl text-red-500"><X size={20} /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex justify-between items-center">
                        <h2 className="text-white text-xl font-bold uppercase">{selectedModality === 'doubles' ? t('admin.tournaments.modalities.doubles') : t('admin.tournaments.modalities.singles')} {t('admin.tournaments.players.roster')}</h2>
                        <button onClick={handleAutoSeed} className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 rounded-xl text-blue-400 text-xs font-bold uppercase"><RefreshCw size={14} /> {t('admin.tournaments.players.autoSeed')}</button>
                    </div>

                    <div className="space-y-4">
                        {filteredItems.map(item => (
                            <div key={item.id} className="glass p-6 rounded-[32px] flex items-center justify-between group">
                                <div onClick={() => { if (!('player1Uid' in item)) { setSelectedPlayer(item as TournamentPlayer); setShowStatsModal(true); } }} className="flex items-center gap-6 cursor-pointer">
                                    <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center text-white font-black text-2xl group-hover:bg-tennis-green group-hover:text-tennis-dark transition-all">
                                        {('player1Uid' in item) ? <Users size={24} /> : (item as TournamentPlayer).name.charAt(0)}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-3">
                                            <h3 className="text-white font-bold text-lg">{('player1Uid' in item) ? (item as DoublesTeam).teamName || `${(item as DoublesTeam).player1Name} / ${(item as DoublesTeam).player2Name}` : (item as TournamentPlayer).name}</h3>
                                            {item.isWildcard && <span className="text-yellow-500"><Crown size={14} /></span>}
                                        </div>
                                        <div className="flex items-center gap-3 mt-1">
                                            <span className="text-[10px] text-tennis-green uppercase font-black">
                                                {item.category ? t(`admin.tournaments.categories.${(item.category as string).toLowerCase()}`) : ''}
                                            </span>
                                            {item.seed && <span className="text-[10px] text-blue-400 uppercase font-black">{t('bracket.seed')} #{item.seed}</span>}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button title={t('common.checkIn')} onClick={() => handleToggleCheckIn(item)} className={`p-3 rounded-xl ${(('player1Uid' in item) ? (item as DoublesTeam).player1CheckedIn : (item as TournamentPlayer).isCheckedIn) ? 'text-pink-400 bg-pink-500/10' : 'text-gray-500 bg-white/5'}`}><CheckCircle2 size={20} /></button>
                                    <button title={t('common.manage')} onClick={() => { if ('player1Uid' in item) setSelectedTeam(item as DoublesTeam); else setSelectedPlayer(item as TournamentPlayer); setSeedValue(item.seed?.toString() || ''); setShowSeedModal(true); }} className="p-3 rounded-xl bg-white/5 text-gray-500 hover:text-white"><ShieldAlert size={20} /></button>
                                    <button title={t('common.wildcard')} onClick={() => handleToggleWildcard(item)} className={`p-3 rounded-xl ${item.isWildcard ? 'text-yellow-500 bg-yellow-500/10' : 'text-gray-500 bg-white/5'}`}><Crown size={20} /></button>
                                    {item.paymentStatus !== 'paid' ? (
                                        <button title={t('common.payment')} onClick={() => { if ('player1Uid' in item) setSelectedTeam(item as DoublesTeam); else setSelectedPlayer(item as TournamentPlayer); setShowPaymentModal(true); }} className="p-3 rounded-xl bg-white/5 text-gray-500 hover:text-tennis-green"><DollarSign size={20} /></button>
                                    ) : (
                                        <button title={t('admin.tournaments.players.revertTitle')} onClick={() => handleRevertPayment(item)} className="p-3 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-all"><Check size={20} /></button>
                                    )}
                                    <button title={t('common.delete')} onClick={() => handleRemove(item)} className="p-3 rounded-xl bg-white/5 text-gray-500 hover:text-red-500"><Trash2 size={20} /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Modals Implementation */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex justify-end">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
                    <div className="w-full max-w-xl bg-gray-950 p-12 overflow-y-auto relative border-l border-white/10">
                        <h2 className="text-white text-3xl font-black uppercase mb-10">{selectedModality === 'doubles' ? t('admin.tournaments.addTeam') : t('admin.tournaments.addPlayer')}</h2>
                        <form onSubmit={handleAddPlayer} className="space-y-8">
                            <input className="w-full bg-white/5 p-5 rounded-2xl text-white font-bold border border-white/10" value={newPlayer.name} onChange={e => setNewPlayer({ ...newPlayer, name: e.target.value })} placeholder={t('common.name')} required />
                            {selectedModality !== 'doubles' && (
                                <input
                                    className="w-full bg-white/5 p-5 rounded-2xl text-white font-bold border border-white/10"
                                    value={newPlayer.email}
                                    onChange={e => setNewPlayer({ ...newPlayer, email: e.target.value })}
                                    placeholder={t('auth.email') + " " + t('common.optional')}
                                    type="email"
                                />
                            )}
                            {selectedModality === 'doubles' && <input className="w-full bg-white/5 p-5 rounded-2xl text-white font-bold border border-white/10" value={newPlayer.player2Name} onChange={e => setNewPlayer({ ...newPlayer, player2Name: e.target.value })} placeholder={t('admin.tournaments.partnerName')} required />}
                            <div onClick={() => setNewPlayer({ ...newPlayer, isWildcard: !newPlayer.isWildcard })} className={`p-6 rounded-2xl cursor-pointer flex justify-between items-center ${newPlayer.isWildcard ? 'bg-yellow-500/10 border-yellow-500' : 'bg-white/5'}`}>
                                <div className="flex items-center gap-4"><Crown className={newPlayer.isWildcard ? 'text-yellow-500' : 'text-gray-500'} /><span className="text-white font-bold">{t('common.wildcard')}</span></div>
                                <div className={`w-6 h-6 rounded-full border-2 ${newPlayer.isWildcard ? 'bg-yellow-500 border-yellow-500' : 'border-gray-800'}`} />
                            </div>
                            <button className="w-full bg-tennis-green text-tennis-dark py-6 rounded-3xl font-black uppercase tracking-widest">
                                {selectedModality === 'doubles' ? t('admin.tournaments.addTeam') : t('admin.tournaments.addPlayer')}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {showSeedModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center">
                    <div className="fixed inset-0 bg-black/80" onClick={() => setShowSeedModal(false)} />
                    <div className="bg-gray-950 p-12 rounded-[40px] border border-white/10 w-full max-w-md relative">
                        <h2 className="text-white text-2xl font-black uppercase mb-6">{t('admin.tournaments.players.assignSeed')}</h2>
                        <input type="number" className="w-full bg-white/5 p-5 rounded-2xl text-white text-3xl text-center font-black" value={seedValue} onChange={e => setSeedValue(e.target.value)} autoFocus />
                        <button onClick={handleUpdateSeed} className="w-full bg-tennis-green text-tennis-dark py-5 rounded-2xl mt-8 font-black uppercase">{t('common.update')}</button>
                    </div>
                </div>
            )}

            {showPaymentModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-fade-in">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowPaymentModal(false)} />
                    <div className="bg-gray-950 p-10 rounded-[40px] border border-white/10 w-full max-w-md relative shadow-2xl">
                        <div className="flex items-center gap-4 border-b border-white/5 pb-6 mb-8">
                            <div className="w-12 h-12 bg-tennis-green/10 rounded-2xl flex items-center justify-center text-tennis-green">
                                <DollarSign size={24} />
                            </div>
                            <h2 className="text-white text-2xl font-black uppercase tracking-tight">{t('admin.tournaments.players.recordPayment')}</h2>
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-3">
                                <label className="text-gray-500 text-[10px] font-black uppercase tracking-widest ml-1">{t('admin.tournaments.edit.fee')}</label>
                                <div className="relative group">
                                    <DollarSign className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-tennis-green transition-colors" size={20} />
                                    <input
                                        type="number"
                                        className="w-full bg-white/5 border border-white/5 rounded-2xl pl-16 pr-6 py-5 text-white text-2xl font-black focus:outline-none focus:border-tennis-green/20 transition-all"
                                        value={paymentInfo.amount}
                                        onChange={e => setPaymentInfo({ ...paymentInfo, amount: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="text-gray-500 text-[10px] font-black uppercase tracking-widest ml-1">{t('admin.tournaments.players.method')}</label>
                                <div className="grid grid-cols-2 gap-4">
                                    {[
                                        { id: 'cash', label: t('admin.tournaments.paymentMethods.labels.cash'), icon: <Banknote size={24} />, color: 'text-tennis-green' },
                                        { id: 'daviplata', label: t('admin.tournaments.paymentMethods.labels.daviplata'), icon: <DollarSign size={24} />, color: 'text-pink-500' },
                                        { id: 'wireTransfer', label: t('admin.tournaments.paymentMethods.labels.wireTransfer'), icon: <Building2 size={24} />, color: 'text-blue-400' },
                                        { id: 'other', label: t('admin.tournaments.paymentMethods.labels.other'), icon: <Plus size={24} />, color: 'text-gray-400' }
                                    ].map(method => (
                                        <div
                                            key={method.id}
                                            onClick={() => setPaymentInfo({ ...paymentInfo, type: method.id })}
                                            className={`p-4 rounded-2xl border cursor-pointer flex flex-col items-center gap-3 text-center transition-all ${paymentInfo.type === method.id ? 'bg-tennis-green/10 border-tennis-green' : 'bg-white/5 border-white/5 hover:border-white/10'}`}
                                        >
                                            <div className={method.color}>{method.icon}</div>
                                            <span className="text-[10px] font-bold uppercase tracking-widest">{method.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="text-gray-500 text-[10px] font-black uppercase tracking-widest ml-1">{t('admin.tournaments.players.note')}</label>
                                <textarea
                                    className="w-full bg-white/5 border border-white/5 rounded-2xl px-6 py-4 text-white text-sm font-bold focus:outline-none focus:border-tennis-green/20 transition-all resize-none h-24"
                                    placeholder={t('admin.tournaments.players.notePlaceholder')}
                                    value={paymentInfo.note}
                                    onChange={e => setPaymentInfo({ ...paymentInfo, note: e.target.value })}
                                />
                            </div>
                        </div>

                        <button
                            onClick={handleRecordPayment}
                            disabled={processing}
                            className="w-full bg-tennis-green text-tennis-dark py-6 rounded-3xl mt-10 font-black uppercase tracking-widest shadow-xl shadow-tennis-green/10 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {processing && <RefreshCw size={20} className="animate-spin" />}
                            {t('common.complete')}
                        </button>
                    </div>
                </div>
            )}

            {showRandomModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center">
                    <div className="fixed inset-0 bg-black/80" onClick={() => setShowRandomModal(false)} />
                    <div className="bg-gray-950 p-12 rounded-[40px] border border-white/10 w-full max-w-md relative">
                        <h2 className="text-white text-2xl font-black uppercase mb-6">{t('admin.tournaments.players.generateTestTitle')}</h2>
                        <div className="space-y-4">
                            <label className="text-gray-500 text-[10px] font-black uppercase tracking-widest">{t('admin.tournaments.players.generateCount')}</label>
                            <input type="number" className="w-full bg-white/5 p-5 rounded-2xl text-white font-bold" value={randomCount} onChange={e => setRandomCount(e.target.value)} placeholder="5" />
                            <label className="text-gray-500 text-[10px] font-black uppercase tracking-widest">{t('admin.tournaments.players.fixedCategory')}</label>
                            <div className="w-full bg-white/5 p-5 rounded-2xl text-tennis-green font-bold border border-white/5">
                                {selectedCategory ? t(`admin.tournaments.categories.${selectedCategory.toLowerCase()}`) : '---'}
                            </div>
                        </div>
                        <button onClick={handleGenerateRandom} className="w-full bg-blue-500 text-white py-5 rounded-2xl mt-8 font-black uppercase">{t('admin.tournaments.players.generateButton')}</button>
                    </div>
                </div>
            )}

            {showRejectModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center">
                    <div className="fixed inset-0 bg-black/80" onClick={() => setShowRejectModal(false)} />
                    <div className="bg-gray-950 p-12 rounded-[40px] border border-white/10 w-full max-w-md relative">
                        <h2 className="text-white text-2xl font-black uppercase mb-6">{t('admin.tournaments.rejectRegistration')}</h2>
                        <textarea className="w-full bg-white/5 p-5 rounded-2xl text-white font-bold h-32" value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder={t('admin.tournaments.rejectReasonPh')} />
                        <button onClick={handleRejectRegistration} className="w-full bg-red-500 text-white py-5 rounded-2xl mt-8 font-black uppercase">{t('common.reject')}</button>
                    </div>
                </div>
            )}

            {confirmModal.open && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm no-print">
                    <div className="glass max-w-md w-full p-12 rounded-[40px] text-center space-y-6 shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className={`w-20 h-20 ${confirmModal.type === 'success' ? 'bg-tennis-green/10 text-tennis-green' : confirmModal.type === 'danger' ? 'bg-red-500/10 text-red-500' : 'bg-yellow-500/10 text-yellow-500'} rounded-3xl flex items-center justify-center mx-auto`}>
                            {confirmModal.type === 'success' ? <CheckCircle2 size={40} /> : <AlertTriangle size={40} />}
                        </div>
                        <h2 className="text-white text-2xl font-black uppercase tracking-tight">{confirmModal.title}</h2>
                        <p className="text-gray-400 font-bold leading-relaxed">{confirmModal.message}</p>
                        <div className="flex gap-4">
                            {confirmModal.type !== 'success' && (
                                <button onClick={() => setConfirmModal({ ...confirmModal, open: false })} className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-gray-400 font-black rounded-2xl transition-all uppercase tracking-widest border border-white/10">
                                    {t('common.cancel')}
                                </button>
                            )}
                            <button
                                onClick={() => {
                                    if (confirmModal.type === 'success') {
                                        setConfirmModal({ ...confirmModal, open: false });
                                    } else {
                                        confirmModal.onConfirm().then(() => setConfirmModal({ ...confirmModal, open: false }));
                                    }
                                }}
                                className={`flex-1 py-4 ${confirmModal.type === 'success' ? 'bg-tennis-green text-tennis-dark' : 'bg-red-500 text-white'} font-black rounded-2xl transition-all uppercase tracking-widest shadow-lg`}
                            >
                                {confirmModal.type === 'success' ? t('common.close') : t('common.confirm')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showStatsModal && selectedPlayer && (
                <PlayerStatsModal player={selectedPlayer} onClose={() => setShowStatsModal(false)} />
            )}
            {/* Error Modal */}
            {errorModal.open && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm no-print">
                    <div className="glass max-w-md w-full p-10 rounded-[40px] border-red-500/20 text-center space-y-6 shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="w-20 h-20 bg-red-500/10 rounded-3xl flex items-center justify-center text-red-500 mx-auto">
                            <AlertTriangle size={40} />
                        </div>
                        <h3 className="text-white text-2xl font-black uppercase tracking-tight">{t('common.error')}</h3>
                        <p className="text-gray-400 font-bold leading-relaxed">{errorModal.message}</p>
                        <button onClick={() => setErrorModal({ open: false, message: '' })} className="w-full py-4 bg-white/5 hover:bg-white/10 text-white font-black rounded-2xl transition-all uppercase tracking-widest border border-white/10">{t('common.close')}</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TournamentPlayersPage;
