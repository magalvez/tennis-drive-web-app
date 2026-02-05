import { collection, collectionGroup, doc, documentId, getDocs, increment, query, updateDoc, where, writeBatch } from 'firebase/firestore';
import { db } from "../config/firebase";
import { getClubById } from './clubService';
import type { Match } from './types';

const chunk = <T>(array: T[], size: number): T[][] => {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
};

export interface UserData {
    uid: string;
    email: string;
    displayName: string;
    role?: 'admin' | 'player';
    createdAt?: any;
    clubs?: {
        [clubId: string]: {
            isSuspended?: boolean;
            adminNotes?: string;
            points?: number;
        }
    };
    tennisProfile?: any;
    isManual?: boolean;
}

export const updateUser = async (uid: string, data: Partial<UserData>) => {
    try {
        const userRef = doc(db, "users", uid);
        await updateDoc(userRef, data);
    } catch (error) {
        console.error("Error updating user:", error);
        throw error;
    }
};

export const getClubPlayers = async (clubId: string) => {
    try {
        const tournamentsRef = collection(db, "tournaments");
        const q = query(tournamentsRef, where("clubId", "==", clubId));
        const tournamentSnap = await getDocs(q);

        const tournamentIds = tournamentSnap.docs.map(doc => doc.id);
        if (tournamentIds.length === 0) return [];

        const playersMap = new Map<string, any>();

        for (const tId of tournamentIds) {
            const playersRef = collection(db, "tournaments", tId, "players");
            const playersSnap = await getDocs(playersRef);
            playersSnap.forEach(docSnap => {
                const pData = docSnap.data();
                const uid = pData.uid || docSnap.id;
                if (!playersMap.has(uid)) {
                    playersMap.set(uid, {
                        ...pData,
                        id: docSnap.id,
                        tournamentId: tId
                    });
                }
            });
        }

        const distinctPlayers = Array.from(playersMap.values());
        const realPlayerUids = distinctPlayers
            .filter(p => p.uid && !p.isManual)
            .map(p => p.uid);

        const userDataMap = new Map<string, UserData>();

        if (realPlayerUids.length > 0) {
            const uidBatches = chunk(realPlayerUids, 30);
            for (const uidBatch of uidBatches) {
                const usersQuery = query(
                    collection(db, "users"),
                    where(documentId(), "in", uidBatch)
                );
                const usersSnap = await getDocs(usersQuery);
                usersSnap.forEach(userDoc => {
                    userDataMap.set(userDoc.id, { uid: userDoc.id, ...userDoc.data() } as UserData);
                });
            }
        }

        const enrichedPlayers = distinctPlayers.map(p => {
            if (p.uid && userDataMap.has(p.uid)) {
                const userData = userDataMap.get(p.uid)!;
                const clubInfo = userData.clubs?.[clubId] || {};
                return {
                    ...p,
                    ...userData,
                    isSuspended: clubInfo.isSuspended || false,
                    adminNotes: clubInfo.adminNotes || '',
                    points: clubInfo.points ?? 0,
                    displayName: userData.displayName || p.name
                };
            }
            return {
                ...p,
                displayName: p.name
            };
        });

        return enrichedPlayers;
    } catch (error) {
        console.error("Error fetching club players:", error);
        return [];
    }
};

export const recalculateClubPoints = async (clubId: string) => {
    try {
        const club = await getClubById(clubId);
        if (!club) return;
        const scoring = club.scoringConfig || { win: 3, loss: 0, withdraw: 0 };

        const tournamentsRef = collection(db, "tournaments");
        const tq = query(tournamentsRef, where("clubId", "==", clubId));
        const tournamentSnap = await getDocs(tq);
        const tournamentIds = tournamentSnap.docs.map(doc => doc.id);

        if (tournamentIds.length === 0) return;

        const playerPoints: Record<string, number> = {};

        for (const tId of tournamentIds) {
            const playersRef = collection(db, "tournaments", tId, "players");
            const playerSnap = await getDocs(playersRef);
            playerSnap.forEach(pDoc => {
                const pData = pDoc.data();
                if (pData.uid) playerPoints[pData.uid] = 0;
            });
        }

        for (const tId of tournamentIds) {
            const matchesRef = collection(db, "tournaments", tId, "matches");
            const mq = query(matchesRef, where("status", "==", "completed"));
            const matchSnap = await getDocs(mq);

            matchSnap.forEach(docSnap => {
                const match = docSnap.data() as Match;
                if (!match.winnerId) return;

                const p1 = match.player1Uid;
                const p2 = match.player2Uid;
                if (!p1 || !p2) return;

                const loserId = match.winnerId === p1 ? p2 : p1;
                const winnerId = match.winnerId;

                playerPoints[winnerId] = (playerPoints[winnerId] || 0) + (scoring.win ?? 3);
                const loserPoints = match.isWithdrawal ? (scoring.withdraw ?? 0) : (scoring.loss ?? 0);
                playerPoints[loserId] = (playerPoints[loserId] || 0) + loserPoints;
            });
        }

        const uids = Object.keys(playerPoints);
        for (let i = 0; i < uids.length; i += 500) {
            const batch = writeBatch(db);
            const batchChunk = uids.slice(i, i + 500);
            for (const uid of batchChunk) {
                const userRef = doc(db, "users", uid);
                batch.update(userRef, {
                    [`clubs.${clubId}.points`]: playerPoints[uid]
                });
            }
            await batch.commit();
        }
    } catch (error) {
        console.error("Error recalculating club points:", error);
        throw error;
    }
};

export const recalculateGlobalRankings = async () => {
    try {
        const matchesRef = collectionGroup(db, 'matches');
        const q = query(matchesRef, where('status', '==', 'completed'));
        const snapshot = await getDocs(q);

        const xpChanges: Record<string, number> = {};

        snapshot.forEach(docSnap => {
            const match = docSnap.data() as Match;
            if (match.winnerId) {
                const winnerId = match.winnerId;
                const loserId = match.player1Uid === winnerId ? match.player2Uid : match.player1Uid;

                xpChanges[winnerId] = (xpChanges[winnerId] || 0) + 50;
                if (loserId) xpChanges[loserId] = (xpChanges[loserId] || 0) - 15;
            }
        });

        const uids = Object.keys(xpChanges);
        for (let i = 0; i < uids.length; i += 500) {
            const batch = writeBatch(db);
            const batchChunk = uids.slice(i, i + 500);
            for (const uid of batchChunk) {
                if (uid.startsWith('manual_')) continue;
                const userRef = doc(db, 'users', uid);
                batch.update(userRef, {
                    'tennisProfile.points': increment(xpChanges[uid])
                });
            }
            await batch.commit();
        }
    } catch (error) {
        console.error(error);
        throw error;
    }
}

export const getAdmins = async (): Promise<UserData[]> => {
    try {
        const q = query(collection(db, "users"), where("role", "==", "admin"));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserData));
    } catch (error) {
        console.error("Error fetching admins:", error);
        throw error;
    }
};

export const promoteUserByEmail = async (email: string): Promise<boolean> => {
    try {
        const q = query(collection(db, "users"), where("email", "==", email));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            throw new Error("User not found");
        }

        const userDoc = snapshot.docs[0];
        const userData = userDoc.data();

        if (userData.isManual) {
            throw new Error("Manual users cannot be admins");
        }

        if (userData.role === 'admin') {
            return true;
        }

        await updateDoc(userDoc.ref, { role: 'admin' });
        return true;
    } catch (error: any) {
        if (error.message !== "User not found" && error.message !== "Manual users cannot be admins") {
            console.error("Error promoting user:", error);
        }
        throw error;
    }
};

export const removeAdminRole = async (uid: string): Promise<void> => {
    try {
        const userRef = doc(db, "users", uid);
        await updateDoc(userRef, { role: 'player' });
    } catch (error) {
        console.error("Error removing admin role:", error);
        throw error;
    }
};
