import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    query,
    updateDoc,
    where
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { getTournamentById } from './tournamentService';
import type { Match, TournamentCategory } from './types';

export type BracketRound = 'round_of_128' | 'round_of_64' | 'round_of_32' | 'round_of_16' | 'quarter_finals' | 'semi_finals' | 'final';

export interface BracketMatch extends Match {
    bracketRound: BracketRound;
    roundNumber: number;
    bracketPosition: number;
    nextMatchId?: string;
    nextMatchSlot?: 1 | 2;
    isBye?: boolean;
}

const ROUND_NAMES: { [size: number]: { [round: number]: BracketRound } } = {
    8: { 1: 'quarter_finals', 2: 'semi_finals', 3: 'final' },
    16: { 1: 'round_of_16', 2: 'quarter_finals', 3: 'semi_finals', 4: 'final' },
    32: { 1: 'round_of_32', 2: 'round_of_16', 3: 'quarter_finals', 4: 'semi_finals', 5: 'final' },
    64: { 1: 'round_of_64', 2: 'round_of_32', 3: 'round_of_16', 4: 'quarter_finals', 5: 'semi_finals', 6: 'final' },
    128: { 1: 'round_of_128', 2: 'round_of_64', 3: 'round_of_32', 4: 'round_of_16', 5: 'quarter_finals', 6: 'semi_finals', 7: 'final' }
};

export const calculateBracketSize = (playerCount: number): 8 | 16 | 32 | 64 | 128 => {
    if (playerCount <= 8) return 8;
    if (playerCount <= 16) return 16;
    if (playerCount <= 32) return 32;
    if (playerCount <= 64) return 64;
    return 128;
};

export const getRoundName = (roundNumber: number, bracketSize: number): BracketRound => {
    return ROUND_NAMES[bracketSize]?.[roundNumber] || 'round_of_16';
};

const getSeededPositions = (count: number): number[] => {
    let positions = [1];
    for (let i = 0; i < Math.log2(count); i++) {
        const nextPositions = [];
        const sum = Math.pow(2, i + 1) + 1;
        for (const p of positions) {
            nextPositions.push(p);
            nextPositions.push(sum - p);
        }
        positions = nextPositions;
    }
    return positions;
};

export const generateMainDraw = async (tournamentId: string, players: any[], category?: TournamentCategory) => {
    try {
        const tournament = await getTournamentById(tournamentId);
        if (!tournament) throw new Error("Tournament not found");

        const bracketSize = calculateBracketSize(players.length);
        const rounds = Math.log2(bracketSize);
        const matchesCollection = collection(db, 'tournaments', tournamentId, 'matches');

        // 1. Sort players by seed (if available) or points
        const sortedPlayers = [...players].sort((a, b) => (a.seed || 999) - (b.seed || 999));

        // 2. Map seeds to players
        const seedToPlayer: { [seed: number]: any } = {};
        sortedPlayers.forEach((p, idx) => {
            seedToPlayer[idx + 1] = p;
        });

        // 3. Get seeded positions for first round
        const seedOrder = getSeededPositions(bracketSize);

        // 4. Generate all matches for all rounds to build the tree
        // We'll store them in a map to link nextMatchId
        const matchTree: { [roundPos: string]: any } = {};

        // Generate matches from final back to first round
        for (let r = rounds; r >= 1; r--) {
            const matchesInRound = Math.pow(2, rounds - r);
            for (let p = 1; p <= matchesInRound; p++) {
                const matchId = `r${r}_p${p}`;
                const isFirstRound = r === 1;

                let p1 = null;
                let p2 = null;
                let status = 'pending';
                let winnerId = undefined;
                let isBye = false;

                if (isFirstRound) {
                    const s1 = seedOrder[(p - 1) * 2];
                    const s2 = seedOrder[(p - 1) * 2 + 1];
                    p1 = seedToPlayer[s1];
                    p2 = seedToPlayer[s2];

                    status = (p1 && p2) ? 'scheduled' : 'completed';
                    if (!p1 || !p2) {
                        isBye = true;
                        winnerId = p1 ? p1.uid : (p2 ? p2.uid : undefined);
                        status = 'completed';
                    } else {
                        status = 'scheduled';
                    }
                }

                const matchData: any = {
                    player1Uid: p1?.uid || '',
                    player1Name: p1?.name || (isFirstRound && !p1 ? 'BYE' : ''),
                    player1Seed: p1?.seed || null,
                    player2Uid: p2?.uid || '',
                    player2Name: p2?.name || (isFirstRound && !p2 ? 'BYE' : ''),
                    player2Seed: p2?.seed || null,
                    status: status,
                    winnerId: winnerId || null,
                    roundNumber: r,
                    bracketPosition: p,
                    bracketRound: getRoundName(r, bracketSize),
                    tournamentId,
                    type: 'tournament',
                    category: category || null,
                    isBye,
                    createdAt: new Date().toISOString()
                };

                // Link to next match
                if (r < rounds) {
                    const nextP = Math.ceil(p / 2);
                    const nextMatchRef = matchTree[`r${r + 1}_p${nextP}`];
                    matchData.nextMatchId = nextMatchRef.id;
                    matchData.nextMatchSlot = p % 2 === 1 ? 1 : 2;
                }

                const docRef = await addDoc(matchesCollection, matchData);
                matchData.id = docRef.id;
                matchTree[matchId] = matchData;

                // If this was a BYE, auto-advance the winner to the next match
                if (isBye && winnerId && r < rounds) {
                    const nextP = Math.ceil(p / 2);
                    const nextId = matchTree[`r${r + 1}_p${nextP}`].id;
                    const slot = p % 2 === 1 ? 1 : 2;

                    const nextMatchRef = doc(db, 'tournaments', tournamentId, 'matches', nextId);
                    const updateData: any = {};
                    const winnerName = p1 ? p1.name : p2.name;
                    if (slot === 1) {
                        updateData.player1Name = winnerName;
                        updateData.player1Uid = winnerId;
                    } else {
                        updateData.player2Name = winnerName;
                        updateData.player2Uid = winnerId;
                    }
                    await updateDoc(nextMatchRef, updateData);
                }
            }
        }
    } catch (error) {
        console.error(error);
        throw error;
    }
};

export const deleteBracketMatches = async (tournamentId: string) => {
    try {
        const q = query(collection(db, 'tournaments', tournamentId, 'matches'), where('type', '==', 'tournament'));
        const snapshot = await getDocs(q);
        const bracketMatches = snapshot.docs.filter(d => (d.data() as any).bracketRound);
        await Promise.all(bracketMatches.map(d => deleteDoc(d.ref)));
    } catch (error) {
        console.error(error);
        throw error;
    }
};

export const advanceWinner = async (
    tournamentId: string,
    currentMatchId: string,
    winnerId: string
): Promise<void> => {
    try {
        const matchRef = doc(db, 'tournaments', tournamentId, 'matches', currentMatchId);
        const matchSnap = await getDoc(matchRef);

        if (!matchSnap.exists()) return;
        const match = matchSnap.data() as Match;

        if (!match.nextMatchId) return;

        const isPlayer1Winner = match.player1Uid === winnerId;
        const winnerName = isPlayer1Winner ? match.player1Name : match.player2Name;

        const nextMatchRef = doc(db, 'tournaments', tournamentId, 'matches', match.nextMatchId);
        const nextMatchSnap = await getDoc(nextMatchRef);

        if (!nextMatchSnap.exists()) return;

        const slot = match.nextMatchSlot || 1;
        const updateData: any = {};
        if (slot === 1) {
            updateData.player1Name = winnerName;
            updateData.player1Uid = winnerId;
        } else {
            updateData.player2Name = winnerName;
            updateData.player2Uid = winnerId;
        }

        await updateDoc(nextMatchRef, updateData);
    } catch (error) {
        console.error('Error advancing winner:', error);
        throw error;
    }
};
