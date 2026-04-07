import { collection, doc, getDocs, onSnapshot, orderBy, query, Timestamp, updateDoc, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { TournamentPlayer } from './types';
import { col } from '../config/environment';


export const getPendingRegistrations = async (tournamentId: string): Promise<TournamentPlayer[]> => {
    try {
        const q = query(
            collection(db, col('tournaments'), tournamentId, 'players'),
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

export const subscribeToTournamentPendingRegistrations = (
    tournamentId: string,
    callback: (players: TournamentPlayer[]) => void
) => {
    const q = query(
        collection(db, col('tournaments'), tournamentId, 'players'),
        where('registrationStatus', '==', 'pending'),
        orderBy('addedAt', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
        const players = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as TournamentPlayer[];
        callback(players);
    }, (error) => {
        console.error(`Error listening to pending registrations for ${tournamentId}:`, error);
    });
};

export const getClubPendingRegistrations = async (clubId: string): Promise<{ tournamentId: string; tournamentName: string; player: TournamentPlayer }[]> => {
    try {
        const tournamentsQuery = query(
            collection(db, col('tournaments')),
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
        const playerRef = doc(db, col('tournaments'), tournamentId, 'players', playerId);
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
        const playerRef = doc(db, col('tournaments'), tournamentId, 'players', playerId);
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

export const subscribeToClubPendingRegistrations = (
    clubId: string,
    callback: (results: { tournamentId: string; tournamentName: string; player: TournamentPlayer }[]) => void
) => {
    const tournamentsQuery = query(
        collection(db, col('tournaments')),
        where('clubId', '==', clubId),
        where('status', 'in', ['upcoming', 'active'])
    );

    const playerUnsubscribes: { [tournamentId: string]: () => void } = {};
    const doublesUnsubscribes: { [tournamentId: string]: () => void } = {};
    const tournamentDataRecord: { [tournamentId: string]: { name: string } } = {};
    const pendingByTournament: { [tournamentId: string]: TournamentPlayer[] } = {};
    const doublesPendingByTournament: { [tournamentId: string]: TournamentPlayer[] } = {};

    const emit = () => {
        const consolidated: { tournamentId: string; tournamentName: string; player: TournamentPlayer }[] = [];
        Object.keys(pendingByTournament).forEach(tId => {
            const tName = tournamentDataRecord[tId]?.name || 'Unknown';
            pendingByTournament[tId].forEach(player => {
                consolidated.push({ tournamentId: tId, tournamentName: tName, player });
            });
        });

        Object.keys(doublesPendingByTournament).forEach(tId => {
            const tName = tournamentDataRecord[tId]?.name || 'Unknown';
            doublesPendingByTournament[tId].forEach(team => {
                consolidated.push({ tournamentId: tId, tournamentName: tName, player: team });
            });
        });

        // Sort by addedAt descending
        consolidated.sort((a, b) => (b.player.addedAt?.seconds || 0) - (a.player.addedAt?.seconds || 0));
        callback(consolidated);
    };

    const unsubTournaments = onSnapshot(tournamentsQuery, (snapshot) => {
        const currentTournamentIds = snapshot.docs.map(doc => doc.id);

        Object.keys(playerUnsubscribes).forEach(tId => {
            if (!currentTournamentIds.includes(tId)) {
                playerUnsubscribes[tId]();
                delete playerUnsubscribes[tId];
                if (doublesUnsubscribes[tId]) {
                    doublesUnsubscribes[tId]();
                    delete doublesUnsubscribes[tId];
                }
                delete tournamentDataRecord[tId];
                delete pendingByTournament[tId];
                delete doublesPendingByTournament[tId];
            }
        });

        snapshot.docs.forEach(tDoc => {
            const tId = tDoc.id;
            const tName = tDoc.data().name;
            tournamentDataRecord[tId] = { name: tName };

            if (!playerUnsubscribes[tId]) {
                const playersQuery = query(
                    collection(db, col('tournaments'), tId, 'players'),
                    where('registrationStatus', '==', 'pending'),
                    orderBy('addedAt', 'desc')
                );

                playerUnsubscribes[tId] = onSnapshot(playersQuery, (pSnapshot) => {
                    pendingByTournament[tId] = pSnapshot.docs.map(pDoc => ({ id: pDoc.id, ...pDoc.data() } as TournamentPlayer));
                    emit();
                }, (error) => {
                    console.error(`Error listening to players for tournament ${tId}:`, error);
                });
            }

            if (!doublesUnsubscribes[tId]) {
                const doublesQuery = query(
                    collection(db, col('tournaments'), tId, 'doublesTeams'),
                    where('status', '==', 'pending_payment')
                );

                doublesUnsubscribes[tId] = onSnapshot(doublesQuery, (dSnapshot) => {
                    doublesPendingByTournament[tId] = dSnapshot.docs
                        .filter(d => !!d.data().paymentProofUrl)
                        .map(dDoc => {
                            const d = dDoc.data();
                            return {
                                id: dDoc.id,
                                name: d.teamName || `${d.player1Name} / ${d.player2Name}`,
                                category: d.category,
                                addedAt: d.addedAt,
                                isDoubles: true,
                                paymentProofUrl: d.paymentProofUrl,
                                registrationStatus: 'pending',
                                paymentStatus: 'unpaid'
                            } as any;
                        });
                    emit();
                }, (error) => {
                    console.error(`Error listening to doubles for tournament ${tId}:`, error);
                });
            }
        });
        emit();
    }, (error) => {
        console.error('Error listening to club tournaments:', error);
    });

    return () => {
        unsubTournaments();
        Object.values(playerUnsubscribes).forEach(unsub => unsub());
        Object.values(doublesUnsubscribes).forEach(unsub => unsub());
    };
};
