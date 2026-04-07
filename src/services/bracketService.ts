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
import { col } from '../config/environment';

export type SeedingLogic = 'standard' | 'best_of_groups';


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

export const generateMainDraw = async (
    tournamentId: string,
    items: any[],
    category?: TournamentCategory,
    modality: 'singles' | 'doubles' = 'singles',
    seedingLogic: SeedingLogic = 'standard'
) => {
    try {
        const isDoubles = modality === 'doubles';
        const tournament = await getTournamentById(tournamentId);
        if (!tournament) throw new Error("Tournament not found");

        const bracketSize = calculateBracketSize(items.length);
        const rounds = Math.log2(bracketSize);
        const matchesCollection = collection(db, col('tournaments'), tournamentId, 'matches');

        // 1. Sort items by seed (if available) or group performance
        let sortedItems = [...items];
        if (seedingLogic === 'best_of_groups') {
            sortedItems.sort((a, b) => {
                const winsA = a.wins || 0;
                const winsB = b.wins || 0;
                const gfA = a.gamesFinal || 0;
                const gfB = b.gamesFinal || 0;

                if (winsB !== winsA) return winsB - winsA;
                if (gfB !== gfA) return gfB - gfA;

                return Math.random() - 0.5;
            });
            console.log('--- BEST OF GROUPS SEEDING INPUT (WEB) ---');
            console.log('SEEDED ITEMS:', JSON.stringify(sortedItems.map((p, index) => ({
                name: modality === 'doubles' ? p.teamName : p.name,
                seed: index + 1,
                wins: p.wins || 0,
                games_final: p.gamesFinal || 0
            })), null, 2));
        } else {
            sortedItems.sort((a, b) => (a.seed || 999) - (b.seed || 999));
        }

        // 2. Map seeds to items
        const seedToItem: { [seed: number]: any } = {};
        sortedItems.forEach((p, idx) => {
            seedToItem[idx + 1] = p;
        });

        // 3. Get seeded positions for first round
        const seedOrder = getSeededPositions(bracketSize);

        // 4. Generate all matches for all rounds to build the tree
        const matchTree: { [roundPos: string]: any } = {};

        // Generate matches from final back to first round
        for (let r = rounds; r >= 1; r--) {
            const matchesInRound = Math.pow(2, rounds - r);
            for (let p = 1; p <= matchesInRound; p++) {
                const matchId = `r${r}_p${p}`;
                const isFirstRound = r === 1;

                let item1 = null;
                let item2 = null;
                let status = 'pending';
                let winnerId = undefined;
                let isBye = false;

                if (isFirstRound) {
                    const s1 = seedOrder[(p - 1) * 2];
                    const s2 = seedOrder[(p - 1) * 2 + 1];
                    item1 = seedToItem[s1];
                    item2 = seedToItem[s2];

                    if (!item1 || !item2) {
                        isBye = true;
                        winnerId = isDoubles
                            ? (item1 ? item1.id : (item2 ? item2.id : undefined))
                            : (item1 ? item1.uid : (item2 ? item2.uid : undefined));
                        status = 'completed';
                    } else {
                        status = 'scheduled';
                    }
                }

                const matchData: any = {
                    status: status,
                    winnerId: winnerId || null,
                    roundNumber: r,
                    bracketPosition: p,
                    bracketRound: getRoundName(r, bracketSize),
                    tournamentId,
                    type: 'tournament',
                    category: category || null,
                    isBye,
                    isDoubles,
                    sport: tournament.sport,
                    createdAt: new Date().toISOString()
                };

                if (isDoubles) {
                    matchData.team1Id = item1?.id || '';
                    matchData.team1Name = item1?.teamName || (isFirstRound && !item1 ? 'BYE' : '');
                    matchData.team1Seed = item1?.seed || null;
                    matchData.team2Id = item2?.id || '';
                    matchData.team2Name = item2?.teamName || (isFirstRound && !item2 ? 'BYE' : '');
                    matchData.team2Seed = item2?.seed || null;
                    if (winnerId) matchData.winnerTeamId = winnerId;
                } else {
                    matchData.player1Uid = item1?.uid || '';
                    matchData.player1Name = item1?.name || (isFirstRound && !item1 ? 'BYE' : '');
                    matchData.player1Seed = item1?.seed || null;
                    matchData.player2Uid = item2?.uid || '';
                    matchData.player2Name = item2?.name || (isFirstRound && !item2 ? 'BYE' : '');
                    matchData.player2Seed = item2?.seed || null;
                }

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
                    const nextMatch = matchTree[`r${r + 1}_p${nextP}`];
                    const nextId = nextMatch.id;
                    const slot = p % 2 === 1 ? 1 : 2;

                    const nextMatchRef = doc(db, col('tournaments'), tournamentId, 'matches', nextId);
                    const updateData: any = {};
                    const winnerName = isDoubles
                        ? (item1 ? item1.teamName : item2.teamName)
                        : (item1 ? item1.name : item2.name);

                    if (isDoubles) {
                        if (slot === 1) {
                            updateData.team1Name = winnerName;
                            updateData.team1Id = winnerId;
                        } else {
                            updateData.team2Name = winnerName;
                            updateData.team2Id = winnerId;
                        }
                    } else {
                        if (slot === 1) {
                            updateData.player1Name = winnerName;
                            updateData.player1Uid = winnerId;
                        } else {
                            updateData.player2Name = winnerName;
                            updateData.player2Uid = winnerId;
                        }
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

export const deleteBracketMatches = async (tournamentId: string, category?: TournamentCategory, modality: 'singles' | 'doubles' = 'singles') => {
    try {
        const isDoubles = modality === 'doubles';
        const q = category
            ? query(collection(db, col('tournaments'), tournamentId, 'matches'), where('category', '==', category))
            : query(collection(db, col('tournaments'), tournamentId, 'matches'));

        const snapshot = await getDocs(q);
        const bracketMatches = snapshot.docs.filter(d => {
            const data = d.data() as any;
            return data.bracketRound && !!data.isDoubles === isDoubles && data.type === 'tournament';
        });
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
        const matchRef = doc(db, col('tournaments'), tournamentId, 'matches', currentMatchId);
        const matchSnap = await getDoc(matchRef);

        if (!matchSnap.exists()) return;
        const match = matchSnap.data() as Match;

        if (!match.nextMatchId) return;

        const nextMatchRef = doc(db, col('tournaments'), tournamentId, 'matches', match.nextMatchId);
        const nextMatchSnap = await getDoc(nextMatchRef);

        if (!nextMatchSnap.exists()) return;

        const slot = match.nextMatchSlot || 1;
        const updateData: any = {};
        const isDoubles = !!match.isDoubles;

        if (isDoubles) {
            const winnerName = match.team1Id === winnerId ? match.team1Name : match.team2Name;
            if (slot === 1) {
                updateData.team1Name = winnerName;
                updateData.team1Id = winnerId;
            } else {
                updateData.team2Name = winnerName;
                updateData.team2Id = winnerId;
            }
        } else {
            const winnerName = match.player1Uid === winnerId ? match.player1Name : match.player2Name;
            if (slot === 1) {
                updateData.player1Name = winnerName;
                updateData.player1Uid = winnerId;
            } else {
                updateData.player2Name = winnerName;
                updateData.player2Uid = winnerId;
            }
        }

        await updateDoc(nextMatchRef, updateData);
    } catch (error) {
        console.error('Error advancing winner:', error);
        throw error;
    }
};
