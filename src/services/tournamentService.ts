import { addDoc, collection, collectionGroup, deleteDoc, deleteField, doc, getDoc, getDocs, increment, orderBy, query, Timestamp, updateDoc, where, writeBatch } from 'firebase/firestore';
import { db } from '../config/firebase';
import { formatMatchScore } from '../utils/scoring';
import { logActivity } from './activityService';
import { createGroup } from './groupService';
import { advanceWinner } from './bracketService';
import type { Match, SetScore, TournamentCategory, TournamentData, TournamentPlayer } from './types';

export const CATEGORY_ORDER: TournamentCategory[] = ['open', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'rookie'];
export const TENNIS_CATEGORY_ORDER: TournamentCategory[] = ['open', 'first', 'second', 'third', 'fourth', 'fifth', 'rookie'];
export const PADEL_CATEGORY_ORDER: TournamentCategory[] = ['open', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth'];

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
 * Seeded Snake Draft - Ensures top-ranked players/teams are distributed across different groups
 * based on their club points or manual seeds.
 */
export const assignGroupsToPlayers = async (
    tournamentId: string,
    numberOfGroups: number,
    category?: TournamentCategory,
    playersList?: TournamentPlayer[],
    modality: 'singles' | 'doubles' = 'singles'
) => {
    try {
        const isDoubles = modality === 'doubles';
        const tournament = await getTournamentById(tournamentId);
        if (!tournament) throw new Error("Tournament not found");

        let items: any[] = [];
        if (isDoubles) {
            const { getDoublesTeams } = await import('./doublesTeamService');
            items = await getDoublesTeams(tournamentId);
        } else {
            items = playersList || await getTournamentPlayers(tournamentId);
        }

        // Sync Logic: Filter out rejected players AND filter by category
        items = items.filter(p =>
            p.registrationStatus !== 'rejected' &&
            (!category || p.category === category)
        );
        if (items.length === 0) throw new Error("No players/teams found");

        // Validation: All players must be checked in and (paid or wildcard)
        let unreadyItems: any[] = [];
        if (isDoubles) {
            unreadyItems = items.filter(t => (!t.player1CheckedIn || !t.player2CheckedIn) || (t.paymentStatus !== 'paid' && !t.isWildcard));
        } else {
            unreadyItems = items.filter(p => !p.isCheckedIn || (p.paymentStatus !== 'paid' && !p.isWildcard));
        }

        if (unreadyItems.length > 0) {
            const names = unreadyItems.map(p => p.name || p.teamName).join(", ");
            throw new Error(`PLAYERS_NOT_READY: ${names}`);
        }

        // 1. Fetch points for items who don't have a manual seed
        const itemsWithRank = await Promise.all(
            items.map(async (item) => {
                let rankValue = item.seed ? (10000 - item.seed) : 0; // Manual seeds take priority

                if (!item.seed && !item.isManual) {
                    if (isDoubles) {
                        // Combined points for doubles
                        let p1Points = 0;
                        let p2Points = 0;
                        if (item.player1Uid && tournament.clubId) {
                            const u1 = await getDoc(doc(db, 'users', item.player1Uid));
                            p1Points = u1.exists() ? (u1.data()?.clubs?.[tournament.clubId]?.points || 0) : 0;
                        }
                        if (item.player2Uid && tournament.clubId) {
                            const u2 = await getDoc(doc(db, 'users', item.player2Uid));
                            p2Points = u2.exists() ? (u2.data()?.clubs?.[tournament.clubId]?.points || 0) : 0;
                        }
                        rankValue = p1Points + p2Points;
                    } else if (item.uid && tournament.clubId) {
                        try {
                            const userDoc = await getDoc(doc(db, 'users', item.uid));
                            if (userDoc.exists()) {
                                const userData = userDoc.data();
                                rankValue = userData?.clubs?.[tournament.clubId]?.points ?? 0;
                            }
                        } catch (e) {
                            console.warn(`Could not fetch points for player ${item.uid}`);
                        }
                    }
                }
                return { ...item, rankValue };
            })
        );

        // 2. Sort by rankValue descending
        const sortedItems = [...itemsWithRank].sort((a, b) => b.rankValue - a.rankValue);

        const groupLetters = Array.from({ length: numberOfGroups }, (_, i) => String.fromCharCode(65 + i));
        const batch = writeBatch(db);
        const groupPlayerMap: { [group: string]: string[] } = {};

        // 3. Snake Draft Assignment
        sortedItems.forEach((item, index) => {
            const row = Math.floor(index / numberOfGroups);
            const posInRow = index % numberOfGroups;

            // Snake pattern: even rows left-to-right, odd rows right-to-left
            const groupIndex = row % 2 === 0
                ? posInRow
                : (numberOfGroups - 1 - posInRow);

            const groupName = groupLetters[groupIndex];
            const itemRef = doc(db, "tournaments", tournamentId, isDoubles ? "doublesTeams" : "players", item.id);

            batch.update(itemRef, {
                group: groupName,
                seed: index + 1 // Assign official tournament seed
            });

            if (!groupPlayerMap[groupName]) groupPlayerMap[groupName] = [];
            groupPlayerMap[groupName].push(item.id);
        });

        await batch.commit();

        // 4. Create Group Documents
        for (const [groupName, itemIds] of Object.entries(groupPlayerMap)) {
            await createGroup(tournamentId, groupName, itemIds, category, isDoubles);
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

export const generateGroupStageMatches = async (tournamentId: string, category?: TournamentCategory, modality: 'singles' | 'doubles' = 'singles') => {
    try {
        const isDoubles = modality === 'doubles';
        const tournament = await getTournamentById(tournamentId);
        const sport = tournament?.sport || 'tennis';

        let items: any[] = [];
        if (isDoubles) {
            const { getDoublesTeams } = await import('./doublesTeamService');
            items = await getDoublesTeams(tournamentId);
        } else {
            items = await getTournamentPlayers(tournamentId);
        }

        // Sync Logic: Filter out rejected players AND filter by category
        items = items.filter(p =>
            p.registrationStatus !== 'rejected' &&
            (!category || p.category === category)
        );

        const itemsByGroup: { [key: string]: any[] } = {};
        items.forEach(p => {
            if (p.group) {
                if (!itemsByGroup[p.group]) itemsByGroup[p.group] = [];
                itemsByGroup[p.group].push(p);
            }
        });

        const matchesCollection = collection(db, "tournaments", tournamentId, "matches");
        for (const [groupName, groupItems] of Object.entries(itemsByGroup)) {
            for (let i = 0; i < groupItems.length; i++) {
                for (let j = i + 1; j < groupItems.length; j++) {
                    const matchData: any = {
                        status: 'scheduled',
                        tournamentId,
                        type: 'tournament',
                        group: groupName,
                        category,
                        sport,
                        isDoubles: isDoubles
                    };

                    if (isDoubles) {
                        matchData.team1Id = groupItems[i].id;
                        matchData.team1Name = groupItems[i].teamName || `${groupItems[i].player1Name} / ${groupItems[i].player2Name}`;
                        matchData.team1Seed = groupItems[i].seed;
                        matchData.team2Id = groupItems[j].id;
                        matchData.team2Name = groupItems[j].teamName || `${groupItems[j].player1Name} / ${groupItems[j].player2Name}`;
                        matchData.team2Seed = groupItems[j].seed;
                        // Legacy support for doubles (setting one player UID for basic listings)
                        matchData.player1Uid = groupItems[i].player1Uid;
                        matchData.player2Uid = groupItems[j].player1Uid;
                    } else {
                        matchData.player1Name = groupItems[i].name;
                        matchData.player1Uid = groupItems[i].uid;
                        matchData.player1Seed = groupItems[i].seed;
                        matchData.player2Name = groupItems[j].name;
                        matchData.player2Uid = groupItems[j].uid;
                        matchData.player2Seed = groupItems[j].seed;
                    }

                    await addDoc(matchesCollection, matchData);
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
            ...(matchData.isDoubles && { winnerTeamId: data.winnerId }),
            isWithdrawal: !!data.isWithdrawal,
            completedAt: Timestamp.now(),
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
            await advanceWinner(tournamentId, matchId, data.winnerId);
        }
    } catch (error) {
        console.error(error);
        throw error;
    }
};

export const resetGroupStage = async (tournamentId: string, category?: TournamentCategory, modality: 'singles' | 'doubles' = 'singles') => {
    try {
        const isDoubles = modality === 'doubles';
        const matchesQuery = category
            ? query(collection(db, "tournaments", tournamentId, "matches"), where("category", "==", category))
            : query(collection(db, "tournaments", tournamentId, "matches"));
        const matchesSnapshot = await getDocs(matchesQuery);
        await Promise.all(matchesSnapshot.docs.filter(d => !!d.data().isDoubles === isDoubles).map(d => deleteDoc(d.ref)));

        const groupsQuery = category
            ? query(collection(db, "tournaments", tournamentId, "groups"), where("category", "==", category))
            : query(collection(db, "tournaments", tournamentId, "groups"));
        const groupsSnapshot = await getDocs(groupsQuery);
        await Promise.all(groupsSnapshot.docs.filter(d => !!d.data().isDoubles === isDoubles).map(d => deleteDoc(d.ref)));

        const batch = writeBatch(db);
        if (isDoubles) {
            const { getDoublesTeams } = await import('./doublesTeamService');
            let teams = await getDoublesTeams(tournamentId);
            if (category) teams = teams.filter(t => t.category === category);
            teams.forEach(t => {
                if (t.group) batch.update(doc(db, "tournaments", tournamentId, "doublesTeams", t.id), { group: null });
            });
        } else {
            const players = await getTournamentPlayers(tournamentId);
            const filteredPlayers = category ? players.filter(p => p.category === category) : players;
            filteredPlayers.forEach(p => {
                if (p.group) batch.update(doc(db, "tournaments", tournamentId, "players", p.id), { group: null });
            });
        }
        await batch.commit();
        await removeChampion(tournamentId, modality, category);
    } catch (error) {
        console.error(error);
        throw error;
    }
};

export const assignChampion = async (
    tournamentId: string,
    modality: 'singles' | 'doubles',
    category: TournamentCategory,
    winner: { uid: string; name: string },
    loser?: { uid: string; name: string }
) => {
    try {
        const tournamentRef = doc(db, 'tournaments', tournamentId);
        const tSnap = await getDoc(tournamentRef);
        const tData = tSnap.data();
        const champions = tData?.champions || {};

        const key = `${modality}_${category}`;
        champions[key] = {
            winnerUid: winner.uid,
            winnerName: winner.name,
            loserUid: loser?.uid || null,
            loserName: loser?.name || null,
            assignedAt: Timestamp.now()
        };

        await updateDoc(tournamentRef, { champions });

        // Also add to User's Hall of Fame
        if (winner.uid && !winner.uid.startsWith('manual_')) {
            const userRef = doc(db, 'users', winner.uid);
            await updateDoc(userRef, {
                hallOfFame: increment(1), // Minimal for now, mobile adds full object
            } as any);
        }
        return true;
    } catch (error) {
        console.error("Error assigning champion:", error);
        throw error;
    }
};

export const removeChampion = async (
    tournamentId: string,
    modality: 'singles' | 'doubles',
    category?: TournamentCategory
) => {
    try {
        const tournamentRef = doc(db, 'tournaments', tournamentId);
        const tSnap = await getDoc(tournamentRef);
        if (!tSnap.exists()) return;

        const tData = tSnap.data();
        const champions = tData?.champions || {};

        if (category) {
            const key = `${modality}_${category}`;
            delete champions[key];
        } else {
            // Remove all champions for this modality
            Object.keys(champions).forEach(key => {
                if (key.startsWith(`${modality}_`)) {
                    delete champions[key];
                }
            });
        }

        await updateDoc(tournamentRef, { champions });
    } catch (error) {
        console.error("Error removing champion:", error);
    }
};

export const simulateGroupMatchResults = async (tournamentId: string, category?: TournamentCategory, modality: 'singles' | 'doubles' = 'singles') => {
    try {
        const tournament = await getTournamentById(tournamentId);
        const scoring = tournament?.scoringConfig || { win: 3, loss: 0, withdraw: 0 };
        const clubId = tournament?.clubId;

        const matches = await getTournamentMatches(tournamentId);
        // Filter: Scheduled AND Group Stage (has group)
        let scheduledGroupMatches = matches.filter(m => m.status === 'scheduled' && !!m.group && (!!m.isDoubles === (modality === 'doubles')));

        if (category) {
            scheduledGroupMatches = scheduledGroupMatches.filter(m => m.category?.toLowerCase() === category.toLowerCase());
        }

        if (scheduledGroupMatches.length === 0) return 0;

        const batch = writeBatch(db);

        for (const match of scheduledGroupMatches) {
            const matchRef = doc(db, "tournaments", tournamentId, "matches", match.id);

            // 1. Determine Winner
            let winnerId = '';
            let loserId = '';
            let isP1Winner = Math.random() > 0.5;

            if (match.isDoubles) {
                winnerId = isP1Winner ? match.team1Id! : match.team2Id!;
                loserId = isP1Winner ? match.team2Id! : match.team1Id!;
            } else {
                winnerId = isP1Winner ? match.player1Uid : match.player2Uid;
                loserId = isP1Winner ? match.player2Uid : match.player1Uid;
            }

            // 2. Generate Simulated Sets (Best of 3)
            const sets: SetScore[] = [];
            const numSets = Math.random() > 0.7 ? 3 : 2;

            const generateRandomSet = (p1Wins: boolean): SetScore => {
                const outcomes = [
                    { w: 6, l: 0 }, { w: 6, l: 1 }, { w: 6, l: 2 },
                    { w: 6, l: 3 }, { w: 6, l: 4 }, { w: 7, l: 5 }, { w: 7, l: 6 }
                ];
                const outcome = outcomes[Math.floor(Math.random() * outcomes.length)];
                const set: SetScore = {
                    player1: p1Wins ? outcome.w : outcome.l,
                    player2: p1Wins ? outcome.l : outcome.w
                };
                if (outcome.w === 7 && outcome.l === 6) {
                    set.tiebreak = {
                        player1: p1Wins ? 7 : Math.floor(Math.random() * 6),
                        player2: p1Wins ? Math.floor(Math.random() * 6) : 7
                    };
                }
                return set;
            };

            if (numSets === 2) {
                sets.push(generateRandomSet(isP1Winner));
                sets.push(generateRandomSet(isP1Winner));
            } else {
                const p1WinnerFirst = Math.random() > 0.5;
                sets.push(generateRandomSet(p1WinnerFirst));
                sets.push(generateRandomSet(!p1WinnerFirst));
                sets.push(generateRandomSet(isP1Winner));
            }

            const scoreString = formatMatchScore(sets);

            // 3. Update Match Document
            batch.update(matchRef, {
                status: 'completed',
                winnerId: winnerId,
                sets: sets,
                score: scoreString,
                completedAt: Timestamp.now(),
                proposedScore: null,
                proposedWinnerId: null,
                submittedBy: null
            });

            // 4. Update Player XP & Club Points
            const winners = [];
            const losers = [];

            if (match.isDoubles) {
                // Fetch team members if we don't have them in the match object
                const team1Doc = await getDoc(doc(db, "tournaments", tournamentId, "doublesTeams", match.team1Id!));
                const team2Doc = await getDoc(doc(db, "tournaments", tournamentId, "doublesTeams", match.team2Id!));

                if (team1Doc.exists() && team2Doc.exists()) {
                    const t1 = team1Doc.data();
                    const t2 = team2Doc.data();
                    if (isP1Winner) {
                        winners.push(t1.player1Uid, t1.player2Uid);
                        losers.push(t2.player1Uid, t2.player2Uid);
                    } else {
                        winners.push(t2.player1Uid, t2.player2Uid);
                        losers.push(t1.player1Uid, t1.player2Uid);
                    }
                }
            } else {
                winners.push(winnerId);
                losers.push(loserId);
            }

            for (const uid of winners) {
                if (uid && !uid.startsWith('manual_')) {
                    try {
                        await updateDoc(doc(db, "users", uid), {
                            "tennisProfile.points": increment(50),
                            ...(clubId && { [`clubs.${clubId}.points`]: increment(scoring.win ?? 3) })
                        });
                    } catch (e) {
                        console.log(`Skipping points for winner ${uid}`);
                    }
                }
            }

            for (const uid of losers) {
                if (uid && !uid.startsWith('manual_')) {
                    try {
                        await updateDoc(doc(db, "users", uid), {
                            "tennisProfile.points": increment(-15),
                            ...(clubId && { [`clubs.${clubId}.points`]: increment(scoring.loss ?? 0) })
                        });
                    } catch (e) {
                        console.log(`Skipping points for loser ${uid}`);
                    }
                }
            }
        }

        await batch.commit();
        return scheduledGroupMatches.length;

    } catch (error) {
        console.error("Error simulating results:", error);
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

export const deleteManualPlayers = async (tournamentId: string, modality: 'singles' | 'doubles' = 'singles', category?: TournamentCategory) => {
    try {
        const isDoubles = modality === 'doubles';
        const collectionName = isDoubles ? 'doublesTeams' : 'players';
        const itemsRef = collection(db, 'tournaments', tournamentId, collectionName);

        let q = query(itemsRef, where('isManual', '==', true));
        if (category && category !== 'all' as any) {
            q = query(q, where('category', '==', category));
        }

        const snapshot = await getDocs(q);

        let count = 0;
        for (const itemDoc of snapshot.docs) {
            const data = itemDoc.data();

            // Cleanup matches
            const matchQueries = [];
            if (isDoubles) {
                matchQueries.push(query(collection(db, 'tournaments', tournamentId, 'matches'), where('team1Id', '==', itemDoc.id)));
                matchQueries.push(query(collection(db, 'tournaments', tournamentId, 'matches'), where('team2Id', '==', itemDoc.id)));
            } else {
                matchQueries.push(query(collection(db, 'tournaments', tournamentId, 'matches'), where('player1Uid', '==', data.uid)));
                matchQueries.push(query(collection(db, 'tournaments', tournamentId, 'matches'), where('player2Uid', '==', data.uid)));
            }

            const matchSnaps = await Promise.all(matchQueries.map(q => getDocs(q)));
            const matchDocs = matchSnaps.flatMap(s => s.docs);

            await Promise.all(matchDocs.map(d => deleteDoc(d.ref)));
            await deleteDoc(itemDoc.ref);
            count++;
        }
        return count;
    } catch (error) {
        console.error(error);
        throw error;
    }
};

export const checkInPlayer = async (tournamentId: string, playerId: string, playerUid?: string, value: boolean = true) => {
    try {
        const batch = writeBatch(db);

        // 1. Update the specific document by ID (ensures it works for guests/manual players)
        const playerRef = doc(db, "tournaments", tournamentId, "players", playerId);
        batch.update(playerRef, {
            isCheckedIn: value,
            checkInTime: value ? Timestamp.now() : deleteField()
        });

        // 2. If a UID is provided, update all other documents with the same UID correctly
        if (playerUid && playerUid !== 'guest') {
            const q = query(
                collection(db, "tournaments", tournamentId, "players"),
                where("uid", "==", playerUid)
            );
            const snapshot = await getDocs(q);
            snapshot.docs.forEach(d => {
                if (d.id !== playerId) {
                    batch.update(d.ref, {
                        isCheckedIn: value,
                        checkInTime: value ? Timestamp.now() : deleteField()
                    });
                }
            });
        }

        await batch.commit();
        return true;
    } catch (error) {
        console.error("Error checking in player:", error);
        throw error;
    }
};

export const getPlayerMatches = async (uid: string) => {
    try {
        const { or } = await import('firebase/firestore');
        const matchesRef = collectionGroup(db, 'matches');
        const q = query(matchesRef, or(where('player1Uid', '==', uid), where('player2Uid', '==', uid)));

        const querySnapshot = await getDocs(q);
        const matches: Match[] = [];
        const tournamentIds = new Set<string>();

        querySnapshot.forEach((docSnap) => {
            const match = { id: docSnap.id, ...(docSnap.data() as any) } as Match;
            matches.push(match);
            if (match.tournamentId) {
                tournamentIds.add(match.tournamentId);
            }
        });

        if (tournamentIds.size > 0) {
            const tournamentNames: { [id: string]: string } = {};
            const tournamentPromises = Array.from(tournamentIds).map(async (tid) => {
                try {
                    const tournamentDoc = await getDoc(doc(db, 'tournaments', tid));
                    if (tournamentDoc.exists()) {
                        tournamentNames[tid] = tournamentDoc.data()?.name || 'Tournament';
                    }
                } catch (e) {
                    console.warn(`Failed to fetch tournament ${tid}:`, e);
                }
            });
            await Promise.all(tournamentPromises);

            matches.forEach(m => {
                if (m.tournamentId && tournamentNames[m.tournamentId]) {
                    m.tournamentName = tournamentNames[m.tournamentId];
                }
            });
        }

        return matches;
    } catch (error) {
        console.error("Error fetching player matches:", error);
        return [];
    }
};
