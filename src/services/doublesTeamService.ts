
/**
 * Doubles Team Service
 * Handles doubles team registration and management for tournaments
 */

import {
    addDoc,
    collection,
    doc,
    getDocs,
    orderBy,
    query,
    Timestamp,
    updateDoc,
    where
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { col } from '../config/environment';


// ============================================================================
// INTERFACES
// ============================================================================

export type DoublesTeamStatus = 'pending_partner' | 'pending_payment' | 'approved' | 'rejected';

export interface DoublesTeam {
    id: string;
    player1Uid: string;
    player1Name: string;
    player2Uid?: string;
    player2Name?: string;
    teamName?: string;
    category?: string;
    seed?: number;
    seedType?: 'manual' | 'automatic';
    group?: string;
    status: DoublesTeamStatus;
    registrationStatus?: 'approved' | 'pending' | 'rejected';
    rejectionReason?: string;
    paymentStatus: 'paid' | 'unpaid';
    paidAt?: Timestamp;
    paidByUserId?: string;
    transactionId?: string;
    addedAt: Timestamp;
    invitedAt?: Timestamp;
    respondedAt?: Timestamp;
    isManual?: boolean;
    inWaitingRoom?: boolean;
    paymentMethod?: 'cash' | 'wireTransfer' | 'gateway' | 'epayco';
    paymentProofUrl?: string;
    paymentProofRejected?: boolean;
    isWildcard?: boolean;
    player1CheckedIn?: boolean;
    player1CheckInTime?: Timestamp;
    player2CheckedIn?: boolean;
    player2CheckInTime?: Timestamp;
}

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

/**
 * Create a doubles team for a tournament
 */
export const createDoublesTeam = async (
    tournamentId: string,
    team: Omit<DoublesTeam, 'id' | 'addedAt'>
): Promise<string> => {
    try {
        const teamData = {
            ...team,
            teamName: team.teamName || (team.player2Name ? `${team.player1Name} / ${team.player2Name}` : team.player1Name),
            addedAt: Timestamp.now()
        };

        const docRef = await addDoc(
            collection(db, col('tournaments'), tournamentId, 'doublesTeams'),
            teamData
        );

        return docRef.id;
    } catch (error) {
        console.error('Error creating doubles team:', error);
        throw error;
    }
};

/**
 * Get all doubles teams for a tournament
 */
export const getDoublesTeams = async (
    tournamentId: string
): Promise<DoublesTeam[]> => {
    try {
        const q = query(
            collection(db, col('tournaments'), tournamentId, 'doublesTeams'),
            orderBy('addedAt', 'desc')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as DoublesTeam[];
    } catch (error) {
        console.error('Error fetching doubles teams:', error);
        throw error;
    }
};

/**
 * Get doubles teams filtered by category
 */
export const getDoublesTeamsByCategory = async (
    tournamentId: string,
    category: string
): Promise<DoublesTeam[]> => {
    try {
        const q = query(
            collection(db, col('tournaments'), tournamentId, 'doublesTeams'),
            where('category', '==', category),
            orderBy('addedAt', 'desc')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as DoublesTeam[];
    } catch (error) {
        console.error('Error fetching doubles teams by category:', error);
        throw error;
    }
};

/**
 * Get approved doubles teams for a category (for group/bracket generation)
 */
export const getApprovedDoublesTeams = async (
    tournamentId: string,
    category?: string
): Promise<DoublesTeam[]> => {
    try {
        const teams = category
            ? await getDoublesTeamsByCategory(tournamentId, category)
            : await getDoublesTeams(tournamentId);

        // Filter to only approved teams with paid status
        return teams.filter(t =>
            t.registrationStatus !== 'rejected' &&
            t.registrationStatus !== 'pending'
        );
    } catch (error) {
        console.error('Error fetching approved doubles teams:', error);
        throw error;
    }
};

/**
 * Get a single doubles team by ID
 */
export const getDoublesTeamById = async (
    tournamentId: string,
    teamId: string
): Promise<DoublesTeam | null> => {
    try {
        const docRef = doc(db, col('tournaments'), tournamentId, 'doublesTeams', teamId);
        const { getDoc } = await import('firebase/firestore');
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() } as DoublesTeam;
        }
        return null;
    } catch (error) {
        console.error('Error fetching doubles team:', error);
        throw error;
    }
};

/**
 * Get total number of doubles teams across all tournaments in a club
 */
export const getClubDoublesTeamsCount = async (clubId: string): Promise<number> => {
    try {
        const tournamentsRef = collection(db, col('tournaments'));
        const q = query(tournamentsRef, where('clubId', '==', clubId));
        const snapshot = await getDocs(q);

        let totalCount = 0;
        for (const tDoc of snapshot.docs) {
            const doublesRef = collection(db, col('tournaments'), tDoc.id, 'doublesTeams');
            const dSnapshot = await getDocs(doublesRef);
            totalCount += dSnapshot.size;
        }
        return totalCount;
    } catch (error) {
        console.error('Error getting club doubles teams count:', error);
        return 0;
    }
};

/**
 * Update a doubles team
 */
export const updateDoublesTeam = async (
    tournamentId: string,
    teamId: string,
    data: Partial<DoublesTeam>
): Promise<void> => {
    try {
        const teamRef = doc(db, col('tournaments'), tournamentId, 'doublesTeams', teamId);
        await updateDoc(teamRef, data);
    } catch (error) {
        console.error('Error updating doubles team:', error);
        throw error;
    }
};

/**
 * Remove a doubles team from tournament
 */
export const removeDoublesTeam = async (
    tournamentId: string,
    teamId: string
): Promise<void> => {
    try {
        const teamRef = doc(db, col('tournaments'), tournamentId, 'doublesTeams', teamId);
        const { deleteDoc } = await import('firebase/firestore');
        await deleteDoc(teamRef);
    } catch (error) {
        console.error('Error removing doubles team:', error);
        throw error;
    }
};

// ============================================================================
// SEEDING
// ============================================================================

/**
 * Auto-seed doubles teams based on combined player ranking points
 */
export const autoSeedDoublesTeams = async (
    tournamentId: string,
    category?: string
): Promise<boolean> => {
    try {
        const { getTournamentById } = await import('./tournamentService');
        const tournament = await getTournamentById(tournamentId);
        if (!tournament || !tournament.clubId) {
            throw new Error('Tournament or Club not found');
        }

        let teams = category
            ? await getDoublesTeamsByCategory(tournamentId, category)
            : await getDoublesTeams(tournamentId);

        // Filter to approved teams only
        teams = teams.filter(t => t.registrationStatus !== 'rejected');

        // Reserved seeds from manual assignment
        const manuallySeeded = teams.filter(t => t.seed && t.seedType === 'manual');
        const usedSeeds = new Set(manuallySeeded.map(t => t.seed!));
        const teamsToAutoSeed = teams.filter(t => !t.seed || t.seedType !== 'manual');

        // Fetch combined points for teams to auto-seed
        const { getDoc } = await import('firebase/firestore');
        const teamsWithPoints = await Promise.all(
            teamsToAutoSeed.map(async (team) => {
                let combinedPoints = 0;

                // Get player 1 points
                if (team.player1Uid && !team.isManual) {
                    const user1Doc = await getDoc(doc(db, col('users'), team.player1Uid));
                    if (user1Doc.exists()) {
                        combinedPoints += user1Doc.data()?.clubs?.[tournament.clubId!]?.points ?? 0;
                    }
                }

                // Get player 2 points
                if (team.player2Uid && !team.isManual) {
                    const user2Doc = await getDoc(doc(db, col('users'), team.player2Uid));
                    if (user2Doc.exists()) {
                        combinedPoints += user2Doc.data()?.clubs?.[tournament.clubId!]?.points ?? 0;
                    }
                }

                return { ...team, combinedPoints };
            })
        );

        // Sort by combined points descending
        const sorted = [...teamsWithPoints].sort((a, b) => b.combinedPoints - a.combinedPoints);

        // Batch update seeds
        const { writeBatch } = await import('firebase/firestore');
        const batch = writeBatch(db);
        let currentSeed = 1;
        sorted.forEach((team) => {
            while (usedSeeds.has(currentSeed)) {
                currentSeed++;
            }
            const teamRef = doc(db, col('tournaments'), tournamentId, 'doublesTeams', team.id);
            batch.update(teamRef, { seed: currentSeed, seedType: 'automatic' });
            usedSeeds.add(currentSeed);
            currentSeed++;
        });

        await batch.commit();
        return true;
    } catch (error) {
        console.error('Error auto-seeding doubles teams:', error);
        throw error;
    }
};

/**
 * Update seed for a specific doubles team
 */
export const updateDoublesTeamSeed = async (
    tournamentId: string,
    teamId: string,
    seed: number | null,
    seedType: 'manual' | 'automatic' = 'manual'
): Promise<boolean> => {
    try {
        const teamRef = doc(db, col('tournaments'), tournamentId, 'doublesTeams', teamId);
        await updateDoc(teamRef, { seed, seedType: seed === null ? null : seedType });
        return true;
    } catch (error) {
        console.error('Error updating doubles team seed:', error);
        throw error;
    }
};

// ============================================================================
// GROUP ASSIGNMENT
// ============================================================================

/**
 * Get doubles teams without a group assignment (available for adding to groups)
 */
export const getDoublesTeamsWithoutGroup = async (
    tournamentId: string,
    category?: string
): Promise<DoublesTeam[]> => {
    try {
        const teams = await getApprovedDoublesTeams(tournamentId, category);
        return teams.filter(t => !t.group);
    } catch (error) {
        console.error('Error fetching doubles teams without group:', error);
        throw error;
    }
};

/**
 * Get doubles teams in a specific group
 */
export const getDoublesTeamsInGroup = async (
    tournamentId: string,
    groupName: string,
    category?: string
): Promise<DoublesTeam[]> => {
    try {
        const teams = await getApprovedDoublesTeams(tournamentId, category);
        return teams.filter(t => t.group === groupName);
    } catch (error) {
        console.error('Error fetching doubles teams in group:', error);
        throw error;
    }
};

// ============================================================================
// WAITING ROOM
// ============================================================================

/**
 * Join the waiting room for a doubles category.
 */
export const joinWaitingRoom = async (
    tournamentId: string,
    playerUid: string,
    playerName: string,
    category: string
): Promise<string> => {
    try {
        const existing = await getWaitingRoomPlayers(tournamentId, category);
        if (existing.some(t => t.player1Uid === playerUid)) {
            throw new Error('Already in the waiting room for this category');
        }

        const teamId = await createDoublesTeam(tournamentId, {
            player1Uid: playerUid,
            player1Name: playerName,
            category,
            status: 'pending_partner',
            paymentStatus: 'unpaid',
            inWaitingRoom: true,
        });

        return teamId;
    } catch (error) {
        console.error('Error joining waiting room:', error);
        throw error;
    }
};

/**
 * Leave the waiting room
 */
export const leaveWaitingRoom = async (
    tournamentId: string,
    teamId: string
): Promise<void> => {
    try {
        await removeDoublesTeam(tournamentId, teamId);
    } catch (error) {
        console.error('Error leaving waiting room:', error);
        throw error;
    }
};

/**
 * Get all players currently in the waiting room for a specific category.
 */
export const getWaitingRoomPlayers = async (
    tournamentId: string,
    category?: string
): Promise<DoublesTeam[]> => {
    try {
        const teamsRef = collection(db, col('tournaments'), tournamentId, "doublesTeams");
        const q = query(teamsRef,
            where("inWaitingRoom", "==", true),
            where("status", "==", "pending_partner")
        );
        const snapshot = await getDocs(q);

        let teams: DoublesTeam[] = snapshot.docs.map(d => ({
            ...(d.data() as Omit<DoublesTeam, 'id'>),
            id: d.id,
        }));

        if (category) {
            teams = teams.filter(t => t.category === category);
        }

        return teams;
    } catch (error) {
        console.error('Error fetching waiting room players:', error);
        throw error;
    }
};

/**
 * Invite a player from the waiting room to form a team.
 */
export const inviteFromWaitingRoom = async (
    tournamentId: string,
    inviterTeamId: string,
    invitedTeam: DoublesTeam,
    inviterName: string
): Promise<void> => {
    try {
        const teamName = `${inviterName.split(' ')[0]} / ${invitedTeam.player1Name.split(' ')[0]}`;

        await updateDoublesTeam(tournamentId, inviterTeamId, {
            player2Uid: invitedTeam.player1Uid,
            player2Name: invitedTeam.player1Name,
            teamName,
            status: 'pending_payment',
            inWaitingRoom: false,
            invitedAt: Timestamp.now(),
        });

        await removeDoublesTeam(tournamentId, invitedTeam.id!);
    } catch (error) {
        console.error('Error inviting from waiting room:', error);
        throw error;
    }
};

/**
 * Withdraw from a doubles tournament
 */
export const withdrawFromDoubles = async (
    tournamentId: string,
    teamId: string,
    withdrawerUid: string,
    withdrawerName: string
): Promise<void> => {
    try {
        const teamRef = doc(db, col('tournaments'), tournamentId, 'doublesTeams', teamId);
        const { getDoc, deleteDoc } = await import('firebase/firestore');
        const teamSnap = await getDoc(teamRef);

        if (!teamSnap.exists()) {
            throw new Error('Team not found');
        }

        const teamData = teamSnap.data() as DoublesTeam;
        const partnerUid = teamData.player1Uid === withdrawerUid ? teamData.player2Uid : teamData.player1Uid;

        await deleteDoc(teamRef);

        try {
            const { getTournamentById } = await import('./tournamentService');
            const tournament = await getTournamentById(tournamentId);
            const tournamentName = tournament?.name || 'Tournament';

            if (partnerUid && !partnerUid.startsWith('manual_')) {
                const { getUserPushToken, sendPushNotification } = await import('./notificationService');
                const token = await getUserPushToken(partnerUid);
                if (token) {
                    await sendPushNotification(
                        token,
                        '🎾 Tournament Update',
                        `${withdrawerName} withdrew from doubles in ${tournamentName}. Your team was removed.`,
                        { type: 'tournament', referenceId: tournamentId }
                    );
                }
            }
        } catch (e) {
            console.error('Error in withdrawal actions:', e);
        }
    } catch (error) {
        console.error('Error withdrawing from doubles:', error);
        throw error;
    }
};

/**
 * Check in a player within a doubles team
 */
export const checkInDoublesPlayer = async (
    tournamentId: string,
    teamId: string,
    userUid: string,
    value: boolean = true
): Promise<void> => {
    try {
        const teamRef = doc(db, col('tournaments'), tournamentId, 'doublesTeams', teamId);
        const { getDoc } = await import('firebase/firestore');
        const teamSnap = await getDoc(teamRef);

        if (!teamSnap.exists()) throw new Error('Team not found');
        const team = teamSnap.data() as DoublesTeam;

        const updateData: any = {};
        if (team.player1Uid === userUid) {
            updateData.player1CheckedIn = value;
            updateData.player1CheckInTime = value ? Timestamp.now() : null;
        } else if (team.player2Uid === userUid) {
            updateData.player2CheckedIn = value;
            updateData.player2CheckInTime = value ? Timestamp.now() : null;
        } else {
            throw new Error('User is not part of this team');
        }

        await updateDoc(teamRef, updateData);
    } catch (error) {
        console.error('Error checking in doubles player:', error);
        throw error;
    }
};

/**
 * Reject a doubles team registration
 */
export const rejectDoublesTeamRegistration = async (
    tournamentId: string,
    teamId: string,
    reason: string
) => {
    try {
        const teamRef = doc(db, col('tournaments'), tournamentId, 'doublesTeams', teamId);
        await updateDoc(teamRef, {
            paymentStatus: 'unpaid' as const,
            paymentProofRejected: true,
            rejectionReason: reason,
            status: 'pending_payment'
        });
        return true;
    } catch (error) {
        console.error('Error rejecting doubles team registration:', error);
        throw error;
    }
};
