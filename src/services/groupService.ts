import {
    collection,
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

export const getQualifiedPlayers = async (tournamentId: string, category?: TournamentCategory): Promise<{ uid: string, name: string }[]> => {
    try {
        const groups = await getGroups(tournamentId);
        const finalizedGroups = groups.filter(g => g.status === 'completed' && (!category || g.category === category));

        const standings = await getTournamentStandings(tournamentId, category);

        let qualified: { uid: string, name: string }[] = [];
        finalizedGroups.forEach(g => {
            const groupStandings = standings.filter((s: any) => s.group === g.name);
            const top = groupStandings.slice(0, g.qualifiersCount).map(s => ({ uid: s.uid, name: s.playerName }));
            qualified = [...qualified, ...top];
        });

        return qualified;
    } catch (error) {
        console.error(error);
        return [];
    }
};
