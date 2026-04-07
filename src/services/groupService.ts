import {
    addDoc,
    arrayRemove,
    arrayUnion,
    collection,
    deleteDoc,
    doc,
    getDocs,
    setDoc,
    updateDoc
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { getTournamentById, getTournamentMatches, getTournamentPlayers } from './tournamentService';
import type { GroupStanding, TournamentCategory, TournamentGroup } from './types';
import { col } from '../config/environment';


export const createGroup = async (
    tournamentId: string,
    groupName: string,
    playerIds: string[],
    category?: TournamentCategory,
    isDoubles: boolean = false
): Promise<void> => {
    try {
        const prefix = isDoubles ? 'doubles' : 'singles';
        const docId = category ? `${prefix}_${category}_${groupName}` : `${prefix}_${groupName}`;
        const groupRef = doc(db, col('tournaments'), tournamentId, 'groups', docId);

        const groupData: TournamentGroup = {
            id: docId,
            name: groupName,
            playerIds,
            status: 'in_progress',
            qualifiersCount: 2,
            isDoubles,
            ...(category && { category })
        };

        await setDoc(groupRef, groupData);
    } catch (error) {
        console.error('Error creating group:', error);
        throw error;
    }
};

export const getGroups = async (tournamentId: string): Promise<TournamentGroup[]> => {
    try {
        const groupsRef = collection(db, col('tournaments'), tournamentId, 'groups');
        const snapshot = await getDocs(groupsRef);

        return snapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id,
        })) as TournamentGroup[];
    } catch (error) {
        console.error('Error fetching groups:', error);
        return [];
    }
};

export const finalizeGroup = async (
    tournamentId: string,
    groupName: string,
    qualifiersCount: number,
    category?: TournamentCategory,
    isDoubles: boolean = false
) => {
    try {
        const prefix = isDoubles ? 'doubles' : 'singles';
        const docId = category ? `${prefix}_${category}_${groupName}` : `${prefix}_${groupName}`;
        const groupRef = doc(db, col('tournaments'), tournamentId, 'groups', docId);

        // In a real app, you'd calculate standings here from match results.
        // For now, mirroring mobile logic of marking it completed.
        await updateDoc(groupRef, {
            status: 'completed',
            qualifiersCount
        });
    } catch (error) {
        console.error(error);
        throw error;
    }
};

export const unfinalizeGroup = async (
    tournamentId: string,
    groupName: string,
    category?: TournamentCategory,
    isDoubles: boolean = false
) => {
    try {
        const prefix = isDoubles ? 'doubles' : 'singles';
        const docId = category ? `${prefix}_${category}_${groupName}` : `${prefix}_${groupName}`;
        const groupRef = doc(db, col('tournaments'), tournamentId, 'groups', docId);
        await updateDoc(groupRef, {
            status: 'in_progress'
        });
    } catch (error) {
        console.error(error);
        throw error;
    }
};

export const getTournamentStandings = async (tournamentId: string, category?: TournamentCategory, modality: 'singles' | 'doubles' = 'singles'): Promise<GroupStanding[]> => {
    try {
        const isDoubles = modality === 'doubles';
        const [matches, tournament] = await Promise.all([
            getTournamentMatches(tournamentId),
            getTournamentById(tournamentId)
        ]);

        let items: any[] = [];
        if (isDoubles) {
            const { getDoublesTeams } = await import('./doublesTeamService');
            items = await getDoublesTeams(tournamentId);
        } else {
            items = await getTournamentPlayers(tournamentId);
        }

        const scoringConfig = tournament?.scoringConfig || { win: 3, loss: 0, withdraw: 0 };
        const standings: { [pid: string]: GroupStanding } = {};

        // Initialize
        items.filter((p: any) => p.group && (!category || p.category === category)).forEach((p: any) => {
            standings[p.id] = {
                position: 0,
                playerId: p.id,
                playerName: isDoubles ? p.teamName : p.name,
                uid: isDoubles ? p.player1Uid : p.uid,
                points: 0,
                wins: 0,
                losses: 0,
                gamesWon: 0,
                gamesLost: 0,
                gamesFinal: 0,
                played: 0,
                isQualifier: false,
                group: p.group
            } as any;
        });

        // Calculate
        matches.filter((m: any) => m.status === 'completed' && m.group && (!category || m.category === category) && !!m.isDoubles === isDoubles).forEach((m: any) => {
            const winner = m.winnerId || m.winnerTeamId;
            const loser = isDoubles
                ? (winner === m.team1Id ? m.team2Id : m.team1Id)
                : (winner === m.player1Uid ? m.player2Uid : m.player1Uid);

            // Check if loser is manual (for singles)
            const actualLoserId = !isDoubles ? items.find(p => p.uid === loser)?.id : loser;

            if (standings[winner]) {
                standings[winner].wins++;
                standings[winner].played = (standings[winner].played || 0) + 1;
                standings[winner].points += scoringConfig.win;
            }

            if (actualLoserId && standings[actualLoserId]) {
                standings[actualLoserId].losses++;
                standings[actualLoserId].played = (standings[actualLoserId].played || 0) + 1;
                standings[actualLoserId].points += m.isWithdrawal ? scoringConfig.withdraw : scoringConfig.loss;
            }

            // Calculate Games
            if (m.sets && m.sets.length > 0) {
                const player1Id = isDoubles ? m.team1Id : items.find(p => p.uid === m.player1Uid)?.id;
                const player2Id = isDoubles ? m.team2Id : items.find(p => p.uid === m.player2Uid)?.id;

                m.sets.forEach((set: any) => {
                    const g1 = set.player1 || 0;
                    const g2 = set.player2 || 0;

                    if (player1Id && standings[player1Id]) {
                        standings[player1Id].gamesWon += g1;
                        standings[player1Id].gamesLost += g2;
                    }
                    if (player2Id && standings[player2Id]) {
                        standings[player2Id].gamesWon += g2;
                        standings[player2Id].gamesLost += g1;
                    }
                });
            }
        });

        // Calculate gamesFinal for all
        Object.values(standings).forEach(s => {
            s.gamesFinal = s.gamesWon - s.gamesLost;
        });

        return Object.values(standings).sort((a: any, b: any) => {
            if (b.points !== a.points) return b.points - a.points;
            if (b.wins !== a.wins) return b.wins - a.wins;
            if (b.gamesFinal !== a.gamesFinal) return b.gamesFinal - a.gamesFinal;
            if (b.gamesWon !== a.gamesWon) return b.gamesWon - a.gamesWon;
            return a.playerName.localeCompare(b.playerName);
        });
    } catch (error) {
        console.error(error);
        return [];
    }
};

export const areAllGroupsFinalized = async (tournamentId: string, category?: TournamentCategory): Promise<boolean> => {
    try {
        const groups = await getGroups(tournamentId);
        const relevantGroups = groups.filter(g => !category || g.category === category);
        if (relevantGroups.length === 0) return false;
        return relevantGroups.every(g => g.status === 'completed');
    } catch (error) {
        console.error(error);
        return false;
    }
};

export const getQualifiedPlayers = async (
    tournamentId: string,
    category?: TournamentCategory,
    modality: 'singles' | 'doubles' = 'singles'
): Promise<{ id: string; uid: string; name: string; groupName: string; position: number; wins: number; gamesFinal: number }[]> => {
    try {
        const isDoubles = modality === 'doubles';
        const groups = await getGroups(tournamentId);
        const finalizedGroups = groups.filter(g => g.status === 'completed' && (!category || g.category === category) && !!g.isDoubles === isDoubles);

        const standings = await getTournamentStandings(tournamentId, category, modality);

        let qualified: { id: string; uid: string; name: string; groupName: string; position: number; wins: number; gamesFinal: number }[] = [];
        finalizedGroups.forEach(g => {
            const groupStandings = standings.filter((s: any) => s.group === g.name);
            const top = groupStandings.slice(0, g.qualifiersCount).map((s: any, idx) => ({
                id: s.playerId,
                uid: s.uid,
                name: s.playerName,
                groupName: g.name,
                position: idx + 1,
                wins: s.wins,
                gamesFinal: s.gamesFinal
            }));
            qualified = [...qualified, ...top];
        });

        return qualified;
    } catch (error) {
        console.error(error);
        return [];
    }
};

/**
 * Add a player to a group and create matches with existing members
 */
export const addPlayerToGroup = async (
    tournamentId: string,
    groupName: string,
    playerId: string,
    category?: TournamentCategory,
    isDoubles: boolean = false
): Promise<{ matchesCreated: number }> => {
    try {
        const tournament = await getTournamentById(tournamentId);
        const sport = tournament?.sport;

        let player: any;
        let allItems: any[];

        if (isDoubles) {
            const { getDoublesTeams } = await import('./doublesTeamService');
            allItems = await getDoublesTeams(tournamentId);
            player = allItems.find(t => t.id === playerId);
        } else {
            allItems = await getTournamentPlayers(tournamentId);
            player = allItems.find(p => p.id === playerId);
        }

        if (!player) {
            throw new Error('Item not found');
        }

        // Update player's group field
        const itemRef = doc(db, col('tournaments'), tournamentId, isDoubles ? 'doublesTeams' : 'players', playerId);
        await updateDoc(itemRef, { group: groupName });

        // Update group's playerIds array
        const prefix = isDoubles ? 'doubles' : 'singles';
        const docId = category ? `${prefix}_${category}_${groupName}` : `${prefix}_${groupName}`;
        const groupRef = doc(db, col('tournaments'), tournamentId, 'groups', docId);
        await updateDoc(groupRef, {
            playerIds: arrayUnion(playerId)
        });

        // Get existing group members (excluding the new player)
        const groupItems = allItems.filter(p =>
            p.group === groupName &&
            p.id !== playerId &&
            (category ? p.category === category : true)
        );

        // Create matches with each existing group member
        const matchesCollection = collection(db, col('tournaments'), tournamentId, 'matches');
        let matchesCreated = 0;

        for (const opponent of groupItems) {
            const matchData: any = {
                status: 'scheduled',
                tournamentId: tournamentId,
                type: 'tournament',
                group: groupName,
                category: category,
                sport,
                isDoubles
            };

            if (isDoubles) {
                matchData.team1Id = player.id;
                matchData.team1Name = player.teamName;
                matchData.team1Seed = player.seed;
                matchData.team2Id = opponent.id;
                matchData.team2Name = opponent.teamName;
                matchData.team2Seed = opponent.seed;
                matchData.player1Uid = player.player1Uid;
                matchData.player2Uid = opponent.player1Uid;
            } else {
                matchData.player1Name = player.name;
                matchData.player1Uid = player.uid;
                matchData.player1Seed = player.seed;
                matchData.player2Name = opponent.name;
                matchData.player2Uid = opponent.uid;
                matchData.player2Seed = opponent.seed;
            }

            await addDoc(matchesCollection, matchData);
            matchesCreated++;
        }

        console.log(`[Groups] Added ${isDoubles ? player.teamName : player.name} to group ${groupName}, created ${matchesCreated} matches`);
        return { matchesCreated };
    } catch (error) {
        console.error('Error adding player to group:', error);
        throw error;
    }
};

/**
 * Remove a player from a group and delete all their matches in that group
 */
export const removePlayerFromGroup = async (
    tournamentId: string,
    groupName: string,
    playerId: string,
    category?: TournamentCategory,
    isDoubles: boolean = false
): Promise<{ matchesDeleted: number }> => {
    try {
        let item: any;
        if (isDoubles) {
            const { getDoublesTeams } = await import('./doublesTeamService');
            const teams = await getDoublesTeams(tournamentId);
            item = teams.find(t => t.id === playerId);
        } else {
            const players = await getTournamentPlayers(tournamentId);
            item = players.find(p => p.id === playerId);
        }

        if (!item) {
            throw new Error(isDoubles ? 'Team not found' : 'Player not found');
        }

        // Remove item's group field
        const itemRef = isDoubles
            ? doc(db, col('tournaments'), tournamentId, 'doublesTeams', playerId)
            : doc(db, col('tournaments'), tournamentId, 'players', playerId);
        await updateDoc(itemRef, { group: null });

        // Update group's playerIds array
        const prefix = isDoubles ? 'doubles' : 'singles';
        const docId = category ? `${prefix}_${category}_${groupName}` : `${prefix}_${groupName}`;
        const groupRef = doc(db, col('tournaments'), tournamentId, 'groups', docId);
        await updateDoc(groupRef, {
            playerIds: arrayRemove(playerId)
        });

        // Find and delete all matches involving this item in this group
        const matchesRef = collection(db, col('tournaments'), tournamentId, 'matches');
        const matchesSnapshot = await getDocs(matchesRef);

        let matchesDeleted = 0;

        for (const matchDoc of matchesSnapshot.docs) {
            const match = matchDoc.data();
            const isInGroup = match.group === groupName && (category ? match.category === category : true);
            const isMatchDoubles = !!match.isDoubles;

            if (isInGroup && isMatchDoubles === isDoubles) {
                if (isDoubles) {
                    if (match.team1Id === playerId || match.team2Id === playerId) {
                        await deleteDoc(matchDoc.ref);
                        matchesDeleted++;
                    }
                } else {
                    if (match.player1Uid === item.uid || match.player2Uid === item.uid) {
                        await deleteDoc(matchDoc.ref);
                        matchesDeleted++;
                    }
                }
            }
        }

        console.log(`[Groups] Removed ${isDoubles ? item.teamName : item.name} from group ${groupName}, deleted ${matchesDeleted} matches`);
        return { matchesDeleted };
    } catch (error) {
        console.error('Error removing player/team from group:', error);
        throw error;
    }
};

/**
 * Get players NOT in any group (available for adding)
 */
export const getPlayersWithoutGroup = async (
    tournamentId: string,
    category?: TournamentCategory,
    isDoubles: boolean = false
): Promise<{ id: string; name: string; uid: string }[]> => {
    try {
        let items: any[];
        if (isDoubles) {
            const { getDoublesTeams } = await import('./doublesTeamService');
            items = await getDoublesTeams(tournamentId);
        } else {
            items = await getTournamentPlayers(tournamentId);
        }

        return items
            .filter(p => !p.group && (category ? p.category === category : true))
            .map(p => ({
                id: p.id,
                name: isDoubles ? (p.teamName || `${p.player1Name} / ${p.player2Name}`) : p.name,
                uid: isDoubles ? p.player1Uid : p.uid,
                category: p.category
            }));
    } catch (error) {
        console.error('Error getting players without group:', error);
        return [];
    }
};

/**
 * Get players in a specific group
 */
export const getGroupPlayers = async (
    tournamentId: string,
    groupName: string,
    category?: TournamentCategory,
    isDoubles: boolean = false
): Promise<{ id: string; name: string; uid: string }[]> => {
    try {
        let items: any[];
        if (isDoubles) {
            const { getDoublesTeams } = await import('./doublesTeamService');
            items = await getDoublesTeams(tournamentId);
        } else {
            items = await getTournamentPlayers(tournamentId);
        }

        return items
            .filter(p =>
                p.group === groupName &&
                (category ? p.category === category : true)
            )
            .map(p => ({
                id: p.id,
                name: isDoubles ? (p.teamName || `${p.player1Name} / ${p.player2Name}`) : p.name,
                uid: isDoubles ? p.player1Uid : p.uid,
                category: p.category
            }));
    } catch (error) {
        console.error('Error getting group players:', error);
        return [];
    }
};
