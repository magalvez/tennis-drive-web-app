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

export const createGroup = async (
    tournamentId: string,
    groupName: string,
    playerIds: string[],
    category?: TournamentCategory
): Promise<void> => {
    try {
        const docId = category ? `${category}_${groupName}` : groupName;
        const groupRef = doc(db, 'tournaments', tournamentId, 'groups', docId);

        const groupData: TournamentGroup = {
            id: docId,
            name: groupName,
            playerIds,
            status: 'in_progress',
            qualifiersCount: 2,
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
        const groupsRef = collection(db, 'tournaments', tournamentId, 'groups');
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
    category?: TournamentCategory
) => {
    try {
        const docId = category ? `${category}_${groupName}` : groupName;
        const groupRef = doc(db, 'tournaments', tournamentId, 'groups', docId);

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
    category?: TournamentCategory
) => {
    try {
        const docId = category ? `${category}_${groupName}` : groupName;
        const groupRef = doc(db, 'tournaments', tournamentId, 'groups', docId);
        await updateDoc(groupRef, {
            status: 'in_progress'
        });
    } catch (error) {
        console.error(error);
        throw error;
    }
};

export const getTournamentStandings = async (tournamentId: string, category?: TournamentCategory): Promise<GroupStanding[]> => {
    try {
        const [matches, players, tournament] = await Promise.all([
            getTournamentMatches(tournamentId),
            getTournamentPlayers(tournamentId),
            getTournamentById(tournamentId)
        ]);

        const scoringConfig = tournament?.scoringConfig || { win: 50, loss: 10, withdraw: 5 };
        const standings: { [pid: string]: GroupStanding } = {};

        // Initialize
        players.filter((p: any) => p.group && (!category || p.category === category)).forEach((p: any) => {
            standings[p.uid] = {
                position: 0,
                playerId: p.id,
                playerName: p.name,
                uid: p.uid,
                points: 0,
                wins: 0,
                losses: 0,
                played: 0,
                isQualifier: false,
                group: p.group
            } as any;
        });

        // Calculate
        matches.filter((m: any) => m.status === 'completed' && m.group && (!category || m.category === category)).forEach((m: any) => {
            const winner = m.winnerId;
            const loser = winner === m.player1Uid ? m.player2Uid : m.player1Uid;

            if (standings[winner]) {
                standings[winner].wins++;
                standings[winner].played = (standings[winner].played || 0) + 1;
                standings[winner].points += scoringConfig.win;
            }

            if (standings[loser]) {
                standings[loser].losses++;
                standings[loser].played = (standings[loser].played || 0) + 1;
                standings[loser].points += m.isWithdrawal ? scoringConfig.withdraw : scoringConfig.loss;
            }
        });

        return Object.values(standings).sort((a: any, b: any) => {
            if (b.points !== a.points) return b.points - a.points;
            if (b.wins !== a.wins) return b.wins - a.wins;
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
    category?: TournamentCategory
): Promise<{ id: string; uid: string; name: string; groupName: string; position: number }[]> => {
    try {
        const groups = await getGroups(tournamentId);
        const finalizedGroups = groups.filter(g => g.status === 'completed' && (!category || g.category === category));

        const standings = await getTournamentStandings(tournamentId, category);

        let qualified: { id: string; uid: string; name: string; groupName: string; position: number }[] = [];
        finalizedGroups.forEach(g => {
            const groupStandings = standings.filter((s: any) => s.group === g.name);
            const top = groupStandings.slice(0, g.qualifiersCount).map((s: any, idx) => ({
                id: s.playerId,
                uid: s.uid,
                name: s.playerName,
                groupName: g.name,
                position: idx + 1
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
    category?: TournamentCategory
): Promise<{ matchesCreated: number }> => {
    try {
        // Get the player being added
        const allPlayers = await getTournamentPlayers(tournamentId);
        const player = allPlayers.find(p => p.id === playerId);

        if (!player) {
            throw new Error('Player not found');
        }

        // Update player's group field
        const playerRef = doc(db, 'tournaments', tournamentId, 'players', playerId);
        await updateDoc(playerRef, { group: groupName });

        // Update group's playerIds array
        const docId = category ? `${category}_${groupName}` : groupName;
        const groupRef = doc(db, 'tournaments', tournamentId, 'groups', docId);
        await updateDoc(groupRef, {
            playerIds: arrayUnion(playerId)
        });

        // Get existing group members (excluding the new player)
        const groupPlayers = allPlayers.filter(p =>
            p.group === groupName &&
            p.id !== playerId &&
            (category ? p.category?.toLowerCase() === category.toLowerCase() : true)
        );

        // Create matches with each existing group member
        const matchesCollection = collection(db, 'tournaments', tournamentId, 'matches');
        let matchesCreated = 0;

        for (const opponent of groupPlayers) {
            await addDoc(matchesCollection, {
                player1Name: player.name,
                player1Uid: player.uid,
                player2Name: opponent.name,
                player2Uid: opponent.uid,
                status: 'scheduled',
                tournamentId: tournamentId,
                type: 'tournament',
                group: groupName,
                category: category // Add category to matches
            });
            matchesCreated++;
        }

        console.log(`[Groups] Added ${player.name} to group ${groupName} (ID: ${docId}), created ${matchesCreated} matches`);
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
    category?: TournamentCategory
): Promise<{ matchesDeleted: number }> => {
    try {
        // Get the player being removed
        const allPlayers = await getTournamentPlayers(tournamentId);
        const player = allPlayers.find(p => p.id === playerId);

        if (!player) {
            throw new Error('Player not found');
        }

        // Remove player's group field
        const playerRef = doc(db, 'tournaments', tournamentId, 'players', playerId);
        await updateDoc(playerRef, { group: null });

        // Update group's playerIds array
        const docId = category ? `${category}_${groupName}` : groupName;
        const groupRef = doc(db, 'tournaments', tournamentId, 'groups', docId);
        await updateDoc(groupRef, {
            playerIds: arrayRemove(playerId)
        });

        // Find and delete all matches involving this player in this group
        const matchesRef = collection(db, 'tournaments', tournamentId, 'matches');
        const matchesSnapshot = await getDocs(matchesRef);

        let matchesDeleted = 0;

        for (const matchDoc of matchesSnapshot.docs) {
            const match = matchDoc.data();
            // Only delete if match is in this group AND involves this player
            // AND matches the category if provided
            if (match.group === groupName &&
                (match.player1Uid === player.uid || match.player2Uid === player.uid) &&
                (category ? match.category === category : true)) {
                await deleteDoc(matchDoc.ref);
                matchesDeleted++;
            }
        }

        console.log(`[Groups] Removed ${player.name} from group ${groupName} (ID: ${docId}), deleted ${matchesDeleted} matches`);
        return { matchesDeleted };
    } catch (error) {
        console.error('Error removing player from group:', error);
        throw error;
    }
};

/**
 * Get players NOT in any group (available for adding)
 */
export const getPlayersWithoutGroup = async (
    tournamentId: string,
    category?: TournamentCategory
): Promise<{ id: string; name: string; uid: string }[]> => {
    try {
        const players = await getTournamentPlayers(tournamentId);

        return players
            .filter(p => !p.group && (category ? p.category?.toLowerCase() === category.toLowerCase() : true))
            .map(p => ({ id: p.id, name: p.name, uid: p.uid, category: p.category }));
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
    category?: TournamentCategory
): Promise<{ id: string; name: string; uid: string }[]> => {
    try {
        const players = await getTournamentPlayers(tournamentId);

        return players
            .filter(p =>
                p.group === groupName &&
                (category ? p.category?.toLowerCase() === category.toLowerCase() : true)
            )
            .map(p => ({ id: p.id, name: p.name, uid: p.uid, category: p.category }));
    } catch (error) {
        console.error('Error getting group players:', error);
        return [];
    }
};
