import { collection, doc, getDocs, orderBy, query, Timestamp, updateDoc, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { TournamentPlayer } from './types';

export const getPendingRegistrations = async (tournamentId: string): Promise<TournamentPlayer[]> => {
    try {
        const q = query(
            collection(db, 'tournaments', tournamentId, 'players'),
            where('registrationStatus', '==', 'pending'),
            orderBy('addedAt', 'desc')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as TournamentPlayer[];
    } catch (error) {
        console.error('Error fetching pending registrations:', error);
        throw error;
    }
};

export const getClubPendingRegistrations = async (clubId: string): Promise<{ tournamentId: string; tournamentName: string; player: TournamentPlayer }[]> => {
    try {
        const tournamentsQuery = query(
            collection(db, 'tournaments'),
            where('clubId', '==', clubId),
            where('status', 'in', ['upcoming', 'active'])
        );
        const tournamentsSnapshot = await getDocs(tournamentsQuery);
        const results: { tournamentId: string; tournamentName: string; player: TournamentPlayer }[] = [];

        for (const tournamentDoc of tournamentsSnapshot.docs) {
            const tournamentId = tournamentDoc.id;
            const tournamentName = tournamentDoc.data().name;
            const pending = await getPendingRegistrations(tournamentId);

            pending.forEach(player => {
                results.push({ tournamentId, tournamentName, player });
            });
        }
        return results;
    } catch (error) {
        console.error('Error fetching club pending registrations:', error);
        throw error;
    }
};

export const approveRegistration = async (tournamentId: string, playerId: string, reviewerUid: string): Promise<void> => {
    try {
        const playerRef = doc(db, 'tournaments', tournamentId, 'players', playerId);
        await updateDoc(playerRef, {
            registrationStatus: 'approved',
            reviewedAt: Timestamp.now(),
            reviewedBy: reviewerUid
        });
    } catch (error) {
        console.error('Error approving registration:', error);
        throw error;
    }
};

export const rejectRegistration = async (tournamentId: string, playerId: string, reviewerUid: string, reason: string): Promise<void> => {
    try {
        const playerRef = doc(db, 'tournaments', tournamentId, 'players', playerId);
        await updateDoc(playerRef, {
            registrationStatus: 'rejected',
            rejectionReason: reason,
            reviewedAt: Timestamp.now(),
            reviewedBy: reviewerUid
        });
    } catch (error) {
        console.error('Error rejecting registration:', error);
        throw error;
    }
};
