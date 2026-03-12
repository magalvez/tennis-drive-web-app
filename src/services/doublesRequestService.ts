
/**
 * Doubles Request Service
 * Handles partner invitation flow for doubles tournaments
 */

import {
    addDoc,
    collection,
    doc,
    getDoc,
    getDocs,
    orderBy,
    query,
    serverTimestamp,
    Timestamp,
    updateDoc,
    where,
    writeBatch
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { getTournamentById } from './tournamentService';

// ============================================================================
// INTERFACES
// ============================================================================

export type DoublesRequestStatus = 'pending' | 'accepted' | 'rejected' | 'expired';

export interface DoublesRequest {
    id?: string;
    fromUserId: string;
    fromUserName: string;
    toUserId: string;
    toUserName: string;
    tournamentId: string;
    tournamentName: string;
    category: string;
    status: DoublesRequestStatus;
    createdAt: Timestamp;
    respondedAt?: Timestamp;
    doublesTeamId?: string; // Set when accepted, links to created team
    expiresAt?: Timestamp; // Optional expiration
}

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

/**
 * Create a partner invitation request
 */
export const createDoublesRequest = async (
    request: Omit<DoublesRequest, 'id' | 'createdAt' | 'status'>
): Promise<string> => {
    try {
        const docRef = await addDoc(
            collection(db, 'tournaments', request.tournamentId, 'doublesRequests'),
            {
                ...request,
                status: 'pending',
                createdAt: serverTimestamp()
            }
        );

        return docRef.id;
    } catch (error) {
        console.error('Error creating doubles request:', error);
        throw error;
    }
};

/**
 * Get pending requests for a user (invitations they received)
 */
export const getPendingRequestsForUser = async (
    userId: string
): Promise<DoublesRequest[]> => {
    try {
        const { collectionGroup } = await import('firebase/firestore');
        const q = query(
            collectionGroup(db, 'doublesRequests'),
            where('toUserId', '==', userId),
            where('status', '==', 'pending'),
            orderBy('createdAt', 'desc')
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as DoublesRequest[];
    } catch (error) {
        console.error('Error fetching pending requests for user:', error);
        throw error;
    }
};

/**
 * Get all pending requests for a tournament (admin view)
 */
export const getPendingRequestsForTournament = async (
    tournamentId: string
): Promise<DoublesRequest[]> => {
    try {
        const q = query(
            collection(db, 'tournaments', tournamentId, 'doublesRequests'),
            where('status', '==', 'pending'),
            orderBy('createdAt', 'desc')
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as DoublesRequest[];
    } catch (error) {
        console.error('Error fetching pending requests for tournament:', error);
        throw error;
    }
};

/**
 * Accept a partner invitation
 */
export const acceptDoublesRequest = async (
    tournamentId: string,
    requestId: string
): Promise<string> => {
    try {
        const requestRef = doc(db, 'tournaments', tournamentId, 'doublesRequests', requestId);
        const requestSnap = await getDoc(requestRef);

        if (!requestSnap.exists()) {
            throw new Error('Request not found');
        }

        const request = { id: requestSnap.id, ...requestSnap.data() } as DoublesRequest;

        if (request.status !== 'pending') {
            throw new Error('Request is no longer pending');
        }

        const tournament = await getTournamentById(tournamentId);
        if (!tournament) {
            throw new Error('Tournament not found');
        }

        const isFree = tournament.entryFee === 0;
        const initialStatus = isFree ? 'approved' : 'pending_payment';
        const initialPaymentStatus = isFree ? 'paid' : 'unpaid';

        const participantIds = [request.fromUserId, request.toUserId];

        const otherRequestsQuery = query(
            collection(db, 'tournaments', tournamentId, 'doublesRequests'),
            where('status', '==', 'pending')
        );
        const otherRequestsSnap = await getDocs(otherRequestsQuery);
        const autoRejectedRequests = otherRequestsSnap.docs.filter(doc => {
            const data = doc.data();
            return doc.id !== requestId && (
                participantIds.includes(data.fromUserId) ||
                participantIds.includes(data.toUserId)
            );
        });

        const waitingRoomQuery = query(
            collection(db, 'tournaments', tournamentId, 'doublesTeams'),
            where('inWaitingRoom', '==', true),
            where('status', '==', 'pending_partner')
        );
        const waitingRoomSnap = await getDocs(waitingRoomQuery);
        const teamsToDelete = waitingRoomSnap.docs.filter(doc =>
            participantIds.includes(doc.data().player1Uid)
        );

        const batch = writeBatch(db);

        const newTeamRef = doc(collection(db, 'tournaments', tournamentId, 'doublesTeams'));
        const teamData = {
            player1Uid: request.fromUserId,
            player1Name: request.fromUserName,
            player2Uid: request.toUserId,
            player2Name: request.toUserName,
            category: request.category,
            status: initialStatus,
            paymentStatus: initialPaymentStatus,
            teamName: `${request.fromUserName.split(' ')[0]} / ${request.toUserName.split(' ')[0]}`,
            addedAt: Timestamp.now(),
            inWaitingRoom: false
        };
        batch.set(newTeamRef, teamData);

        batch.update(requestRef, {
            status: 'accepted',
            respondedAt: serverTimestamp(),
            doublesTeamId: newTeamRef.id
        });

        autoRejectedRequests.forEach(doc => {
            batch.update(doc.ref, {
                status: 'rejected',
                respondedAt: serverTimestamp(),
                rejectionReason: 'Already joined another team'
            });
        });

        teamsToDelete.forEach(doc => {
            batch.delete(doc.ref);
        });

        await batch.commit();

        try {
            const { getUserPushToken, sendPushNotification } = await import('./notificationService');

            // Notify inviter
            const fromUserToken = await getUserPushToken(request.fromUserId);
            if (fromUserToken) {
                await sendPushNotification(
                    fromUserToken,
                    '🎾 Invitation Accepted!',
                    `${request.toUserName} accepted your invitation to play doubles in ${request.tournamentName}.`,
                    { type: 'tournament', referenceId: tournamentId, doublesTeamId: newTeamRef.id }
                );
            }

            // Notify auto-rejected players
            for (const rejectDoc of autoRejectedRequests) {
                const data = rejectDoc.data();
                const userToNotify = participantIds.includes(data.fromUserId) ? data.toUserId : data.fromUserId;

                if (!participantIds.includes(userToNotify)) {
                    const notifyToken = await getUserPushToken(userToNotify);
                    if (notifyToken) {
                        await sendPushNotification(
                            notifyToken,
                            'Partner Status Update',
                            `A pending doubles request regarding ${request.fromUserName} or ${request.toUserName} is no longer available as they have formed a team.`,
                            { type: 'tournament', referenceId: tournamentId }
                        );
                    }
                }
            }
        } catch (e) {
            console.error('Error in secondary actions after accepting request:', e);
        }

        return newTeamRef.id;
    } catch (error) {
        console.error('Error accepting doubles request:', error);
        throw error;
    }
};

/**
 * Reject a partner invitation
 */
export const rejectDoublesRequest = async (
    tournamentId: string,
    requestId: string
): Promise<void> => {
    try {
        const requestRef = doc(db, 'tournaments', tournamentId, 'doublesRequests', requestId);
        await updateDoc(requestRef, {
            status: 'rejected',
            respondedAt: serverTimestamp()
        });
    } catch (error) {
        console.error('Error rejecting doubles request:', error);
        throw error;
    }
};
