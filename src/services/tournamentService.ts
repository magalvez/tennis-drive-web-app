import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, increment, orderBy, query, Timestamp, updateDoc, where, writeBatch } from 'firebase/firestore';
import { db } from '../config/firebase';
import { formatMatchScore } from '../utils/scoring';
import { logActivity } from './activityService';
import type { Match, TournamentCategory, TournamentData, TournamentPlayer } from './types';

export const CATEGORY_ORDER: TournamentCategory[] = ['open', 'first', 'second', 'third', 'fourth', 'fifth', 'rookie'];

export const createTournament = async (data: Omit<TournamentData, 'status' | 'createdAt'>) => {
    try {
        const tournamentData: any = {
            ...data,
            status: 'upcoming',
            createdAt: Timestamp.now(),
        };

        const docRef = await addDoc(collection(db, "tournaments"), tournamentData);
        await logActivity(
            'tournament_create',
            'Tournament Created',
            `Created tournament: ${data.name}`,
            { tournamentId: docRef.id, clubId: data.clubId },
            data.clubId
        );
        return docRef.id;
    } catch (error) {
        console.error(error);
        throw error;
    }
};

export const getTournamentsByClub = async (clubId: string) => {
    try {
        const q = query(collection(db, "tournaments"), where("clubId", "==", clubId), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TournamentData));
    } catch (error) {
        console.error(error);
        return [];
    }
};

export const deleteTournament = async (id: string) => {
    try {
        const matchesQuery = query(collection(db, "tournaments", id, "matches"));
        const matchesSnapshot = await getDocs(matchesQuery);
        await Promise.all(matchesSnapshot.docs.map(doc => deleteDoc(doc.ref)));

        const playersQuery = query(collection(db, "tournaments", id, "players"));
        const playersSnapshot = await getDocs(playersQuery);
        await Promise.all(playersSnapshot.docs.map(doc => deleteDoc(doc.ref)));

        await deleteDoc(doc(db, "tournaments", id));
    } catch (error) {
        console.error(error);
        throw error;
    }
};

export const getTournamentById = async (id: string) => {
    try {
        const docRef = doc(db, "tournaments", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() } as TournamentData;
        }
        return null;
    } catch (error) {
        console.error(error);
        throw error;
    }
};

export const updateTournament = async (id: string, data: Partial<TournamentData>) => {
    try {
        const docRef = doc(db, "tournaments", id);
        await updateDoc(docRef, data);
    } catch (error) {
        console.error(error);
        throw error;
    }
};

export const getTournamentPlayers = async (tournamentId: string) => {
    try {
        const q = query(collection(db, "tournaments", tournamentId, "players"), orderBy("addedAt", "desc"));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TournamentPlayer))
            .sort((a, b) => (a.group || 'Z').localeCompare(b.group || 'Z'));
    } catch (error) {
        console.error(error);
        throw error;
    }
};

export const getTournamentMatches = async (tournamentId: string) => {
    try {
        const q = query(collection(db, "tournaments", tournamentId, "matches"));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Match));
    } catch (error) {
        console.error(error);
        throw error;
    }
};

/**
 * Seeded Snake Draft - Ensures top-ranked players are distributed across different groups
 * based on their club points or manual seeds.
 */
export const assignGroupsToPlayers = async (tournamentId: string, numberOfGroups: number, category?: TournamentCategory) => {
    try {
        const tournament = await getTournamentById(tournamentId);
        if (!tournament) throw new Error("Tournament not found");

        let players = await getTournamentPlayers(tournamentId);
        if (category) players = players.filter(p => p.category === category);
        if (players.length === 0) throw new Error("No players found");

        // 1. Fetch points for players who don't have a manual seed
        const playersWithRank = await Promise.all(
            players.map(async (player) => {
                let rankValue = player.seed ? (10000 - player.seed) : 0; // Manual seeds take priority

                if (!player.seed && player.uid && tournament.clubId && !player.isManual) {
                    try {
                        const userDoc = await getDoc(doc(db, 'users', player.uid));
                        if (userDoc.exists()) {
                            const userData = userDoc.data();
                            rankValue = userData?.clubs?.[tournament.clubId]?.points ?? 0;
                        }
                    } catch (e) {
                        console.warn(`Could not fetch points for player ${player.uid}`);
                    }
                }
                return { ...player, rankValue };
            })
        );

        // 2. Sort by rankValue descending
        const sortedPlayers = [...playersWithRank].sort((a, b) => b.rankValue - a.rankValue);

        const groupLetters = Array.from({ length: numberOfGroups }, (_, i) => String.fromCharCode(65 + i));
        const batch = writeBatch(db);
        const groupPlayerMap: { [group: string]: string[] } = {};

        // 3. Snake Draft Assignment
        sortedPlayers.forEach((player, index) => {
            const row = Math.floor(index / numberOfGroups);
            const posInRow = index % numberOfGroups;

            // Snake pattern: even rows left-to-right, odd rows right-to-left
            const groupIndex = row % 2 === 0
                ? posInRow
                : (numberOfGroups - 1 - posInRow);

            const groupName = groupLetters[groupIndex];
            const playerRef = doc(db, "tournaments", tournamentId, "players", player.id);

            batch.update(playerRef, {
                group: groupName,
                seed: index + 1 // Assign official tournament seed
            });

            if (!groupPlayerMap[groupName]) groupPlayerMap[groupName] = [];
            groupPlayerMap[groupName].push(player.id);
        });

        await batch.commit();

        // 4. Create Group Documents
        const { createGroup } = await import('./groupService');
        for (const [groupName, playerIds] of Object.entries(groupPlayerMap)) {
            await createGroup(tournamentId, groupName, playerIds, category);
        }
        return true;
    } catch (error) {
        console.error(error);
        throw error;
    }
};

export const updatePlayerSeed = async (tournamentId: string, playerId: string, seed: number | null) => {
    try {
        const playerRef = doc(db, "tournaments", tournamentId, "players", playerId);
        await updateDoc(playerRef, { seed });
        return true;
    } catch (error) {
        console.error(error);
        throw error;
    }
};

export const autoSeedPlayers = async (tournamentId: string, category?: TournamentCategory) => {
    try {
        const tournament = await getTournamentById(tournamentId);
        if (!tournament || !tournament.clubId) throw new Error("Tournament or Club not found");

        let players = await getTournamentPlayers(tournamentId);
        if (category) players = players.filter(p => p.category === category);

        // Fetch points
        const playersWithRank = await Promise.all(
            players.map(async (player) => {
                let points = 0;
                if (player.uid && !player.isManual) {
                    const userDoc = await getDoc(doc(db, 'users', player.uid));
                    if (userDoc.exists()) {
                        points = userDoc.data()?.clubs?.[tournament.clubId!]?.points ?? 0;
                    }
                }
                return { ...player, points };
            })
        );

        // Sort by points descending
        const sorted = [...playersWithRank].sort((a, b) => b.points - a.points);

        const batch = writeBatch(db);
        sorted.forEach((p, idx) => {
            const playerRef = doc(db, "tournaments", tournamentId, "players", p.id);
            batch.update(playerRef, { seed: idx + 1 });
        });

        await batch.commit();
        return true;
    } catch (error) {
        console.error(error);
        throw error;
    }
};

export const generateGroupStageMatches = async (tournamentId: string, category?: TournamentCategory) => {
    try {
        let players = await getTournamentPlayers(tournamentId);
        if (category) players = players.filter(p => p.category === category);

        const playersByGroup: { [key: string]: TournamentPlayer[] } = {};
        players.forEach(p => {
            if (p.group) {
                if (!playersByGroup[p.group]) playersByGroup[p.group] = [];
                playersByGroup[p.group].push(p);
            }
        });

        const matchesCollection = collection(db, "tournaments", tournamentId, "matches");
        for (const [groupName, groupPlayers] of Object.entries(playersByGroup)) {
            for (let i = 0; i < groupPlayers.length; i++) {
                for (let j = i + 1; j < groupPlayers.length; j++) {
                    await addDoc(matchesCollection, {
                        player1Name: groupPlayers[i].name,
                        player1Uid: groupPlayers[i].uid,
                        player2Name: groupPlayers[j].name,
                        player2Uid: groupPlayers[j].uid,
                        status: 'scheduled',
                        tournamentId,
                        type: 'tournament',
                        group: groupName,
                        category
                    });
                }
            }
        }
        return true;
    } catch (error) {
        console.error(error);
        throw error;
    }
};

export const saveMatchScoreByAdmin = async (
    tournamentId: string,
    matchId: string,
    data: { sets: any[], winnerId: string, isWithdrawal?: boolean }
) => {
    try {
        const matchRef = doc(db, "tournaments", tournamentId, "matches", matchId);
        const matchSnap = await getDoc(matchRef);
        if (!matchSnap.exists()) throw new Error("Match not found");
        const matchData = matchSnap.data() as Match;

        const score = formatMatchScore(data.sets);
        await updateDoc(matchRef, {
            status: 'completed',
            sets: data.sets,
            score,
            winnerId: data.winnerId,
            isWithdrawal: !!data.isWithdrawal,
            proposedSets: null,
            proposedScore: null,
            proposedWinnerId: null,
            submittedBy: null
        });

        const tournament = await getTournamentById(tournamentId);
        if (tournament?.clubId) {
            const scoring = tournament.scoringConfig || { win: 3, loss: 0, withdraw: 0 };
            const loserId = data.winnerId === matchData.player1Uid ? matchData.player2Uid : matchData.player1Uid;

            if (data.winnerId && !data.winnerId.startsWith('manual_')) {
                await updateDoc(doc(db, "users", data.winnerId), {
                    [`clubs.${tournament.clubId}.points`]: increment(scoring.win),
                    "tennisProfile.points": increment(50)
                });
            }

            if (loserId && !loserId.startsWith('manual_')) {
                const loserPoints = data.isWithdrawal ? scoring.withdraw : scoring.loss;
                await updateDoc(doc(db, "users", loserId), {
                    [`clubs.${tournament.clubId}.points`]: increment(loserPoints),
                    "tennisProfile.points": increment(-15)
                });
            }
        }

        if (matchData.nextMatchId && data.winnerId) {
            const { advanceWinner } = await import('./bracketService');
            await advanceWinner(tournamentId, matchId, data.winnerId);
        }
    } catch (error) {
        console.error(error);
        throw error;
    }
};

export const resetGroupStage = async (tournamentId: string, category?: TournamentCategory) => {
    try {
        const matchesQuery = category
            ? query(collection(db, "tournaments", tournamentId, "matches"), where("category", "==", category))
            : query(collection(db, "tournaments", tournamentId, "matches"));
        const matchesSnapshot = await getDocs(matchesQuery);
        await Promise.all(matchesSnapshot.docs.map(d => deleteDoc(d.ref)));

        const groupsQuery = category
            ? query(collection(db, "tournaments", tournamentId, "groups"), where("category", "==", category))
            : query(collection(db, "tournaments", tournamentId, "groups"));
        const groupsSnapshot = await getDocs(groupsQuery);
        await Promise.all(groupsSnapshot.docs.map(d => deleteDoc(d.ref)));

        const players = await getTournamentPlayers(tournamentId);
        const filteredPlayers = category ? players.filter(p => p.category === category) : players;
        const batch = writeBatch(db);
        filteredPlayers.forEach(p => {
            if (p.group) batch.update(doc(db, "tournaments", tournamentId, "players", p.id), { group: null });
        });
        await batch.commit();
    } catch (error) {
        console.error(error);
        throw error;
    }
};

export const simulateGroupMatchResults = async (tournamentId: string, category?: TournamentCategory) => {
    try {
        const matches = await getTournamentMatches(tournamentId);
        let scheduledGroupMatches = matches.filter(m => m.status === 'scheduled' && !!m.group);
        if (category) scheduledGroupMatches = scheduledGroupMatches.filter(m => m.category === category);

        for (const match of scheduledGroupMatches) {
            const winnerId = Math.random() > 0.5 ? match.player1Uid : match.player2Uid;
            const sets: any[] = [
                { player1: Math.random() > 0.5 ? 6 : 4, player2: Math.random() > 0.5 ? 4 : 6 },
                { player1: Math.random() > 0.5 ? 6 : 3, player2: Math.random() > 0.5 ? 3 : 6 }
            ];
            await saveMatchScoreByAdmin(tournamentId, match.id, { sets, winnerId });
        }
        return scheduledGroupMatches.length;
    } catch (error) {
        console.error(error);
        throw error;
    }
};

export const addPlayerToTournament = async (tournamentId: string, player: Partial<TournamentPlayer>) => {
    try {
        const playerRef = collection(db, 'tournaments', tournamentId, 'players');
        const docRef = await addDoc(playerRef, {
            ...player,
            registrationStatus: player.registrationStatus || 'approved',
            addedAt: Timestamp.now()
        });
        return docRef.id;
    } catch (error) {
        console.error(error);
        throw error;
    }
};

export const removePlayerFromTournament = async (tournamentId: string, playerId: string) => {
    try {
        await deleteDoc(doc(db, 'tournaments', tournamentId, 'players', playerId));
    } catch (error) {
        console.error(error);
        throw error;
    }
};

export const updatePlayerInTournament = async (tournamentId: string, playerId: string, data: Partial<TournamentPlayer>) => {
    try {
        await updateDoc(doc(db, 'tournaments', tournamentId, 'players', playerId), data);
    } catch (error) {
        console.error(error);
        throw error;
    }
};

export const deleteManualPlayers = async (tournamentId: string) => {
    try {
        const playersRef = collection(db, 'tournaments', tournamentId, 'players');
        const q = query(playersRef, where('isManual', '==', true));
        const snapshot = await getDocs(q);

        let count = 0;
        for (const playerDoc of snapshot.docs) {
            // Also cleanup their matches
            const matchesQuery = query(
                collection(db, 'tournaments', tournamentId, 'matches'),
                where('player1Uid', '==', playerDoc.data().uid)
            );
            const matches2Query = query(
                collection(db, 'tournaments', tournamentId, 'matches'),
                where('player2Uid', '==', playerDoc.data().uid)
            );

            const [m1, m2] = await Promise.all([getDocs(matchesQuery), getDocs(matches2Query)]);
            await Promise.all([...m1.docs, ...m2.docs].map(d => deleteDoc(d.ref)));

            await deleteDoc(playerDoc.ref);
            count++;
        }
        return count;
    } catch (error) {
        console.error(error);
        throw error;
    }
};
