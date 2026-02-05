import { addDoc, collection, doc, getDoc, getDocs, orderBy, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { logActivity } from './activityService';
import type { Transaction } from './types';

const TRANSACTIONS_COLLECTION = 'transactions';

export interface TransactionInput {
    userId: string;
    userName: string;
    amount: number;
    type: 'entry_fee' | 'other';
    referenceId: string;
    referenceName: string;
    currency?: string;
    paymentMethod?: string;
    status?: 'pending' | 'completed';
    tournamentPlayerId?: string;
    clubId?: string;
}

export const createTransaction = async (data: TransactionInput) => {
    try {
        const txData: any = {
            ...data,
            currency: data.currency || 'USD',
            status: data.status || 'pending',
            paymentMethod: data.paymentMethod || 'manual',
            tournamentPlayerId: data.tournamentPlayerId || null,
            createdAt: serverTimestamp()
        };

        const docRef = await addDoc(collection(db, TRANSACTIONS_COLLECTION), txData);
        await logActivity(
            'transaction',
            data.userName,
            `Initiated payment of $${data.amount} for ${data.referenceName}`,
            { amount: data.amount, referenceName: data.referenceName, status: data.status || 'pending', transactionId: docRef.id, userId: data.userId },
            data.clubId
        );

        return docRef.id;
    } catch (error) {
        console.error("Error creating transaction:", error);
        throw error;
    }
};

export const completeTransaction = async (transactionId: string, gatewayRef?: string, paymentMethod?: string) => {
    try {
        const docRef = doc(db, TRANSACTIONS_COLLECTION, transactionId);
        await updateDoc(docRef, {
            status: 'completed',
            gatewayRef: gatewayRef || 'manual',
            paymentMethod: paymentMethod || 'manual',
            completedAt: serverTimestamp()
        });

        const snap = await getDoc(docRef);
        if (snap.exists()) {
            const data = snap.data();
            if (data.type === 'entry_fee' && data.referenceId) {
                await markTournamentPlayerPaid(data.referenceId, data.userId, data.tournamentPlayerId);
            }

            await logActivity(
                'transaction',
                data.userName,
                `Paid $${data.amount} for ${data.referenceName}`,
                { amount: data.amount, status: 'completed', transactionId, userId: data.userId },
                data.clubId
            );
        }
        return true;
    } catch (error) {
        console.error("Error completing transaction:", error);
        throw error;
    }
};

export const markTournamentPlayerPaid = async (tournamentId: string, userId: string, playerId?: string) => {
    try {
        if (playerId) {
            const playerRef = doc(db, 'tournaments', tournamentId, 'players', playerId);
            await updateDoc(playerRef, {
                paymentStatus: 'paid',
                paidAt: serverTimestamp()
            });
            return;
        }

        const playersRef = collection(db, 'tournaments', tournamentId, 'players');
        const q = query(playersRef, where('uid', '==', userId));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            const playerDoc = snapshot.docs[0];
            await updateDoc(playerDoc.ref, {
                paymentStatus: 'paid',
                paidAt: serverTimestamp()
            });
        }
    } catch (error) {
        console.error("Error marking player as paid:", error);
    }
};

export const markTournamentPlayerUnpaid = async (tournamentId: string, userId: string, playerId?: string) => {
    try {
        if (playerId) {
            const playerRef = doc(db, 'tournaments', tournamentId, 'players', playerId);
            await updateDoc(playerRef, {
                paymentStatus: 'unpaid',
                paidAt: null
            });
            return;
        }

        const playersRef = collection(db, 'tournaments', tournamentId, 'players');
        const q = query(playersRef, where('uid', '==', userId));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            const playerDoc = snapshot.docs[0];
            await updateDoc(playerDoc.ref, {
                paymentStatus: 'unpaid',
                paidAt: null
            });
        }
    } catch (error) {
        console.error("Error marking player as unpaid:", error);
    }
};

export const revertLatestTransactionForUser = async (tournamentId: string, userId?: string, tournamentPlayerId?: string) => {
    try {
        let q;
        if (tournamentPlayerId) {
            q = query(
                collection(db, TRANSACTIONS_COLLECTION),
                where('referenceId', '==', tournamentId),
                where('tournamentPlayerId', '==', tournamentPlayerId),
                where('status', '==', 'completed'),
                orderBy('createdAt', 'desc')
            );
        } else if (userId) {
            q = query(
                collection(db, TRANSACTIONS_COLLECTION),
                where('referenceId', '==', tournamentId),
                where('userId', '==', userId),
                where('status', '==', 'completed'),
                orderBy('createdAt', 'desc')
            );
        } else {
            return false;
        }

        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            const latestTx = snapshot.docs[0];
            await revertTransaction(latestTx.id);
            return true;
        }

        if (tournamentPlayerId || userId) {
            await markTournamentPlayerUnpaid(tournamentId, userId || 'unknown', tournamentPlayerId);
            return true;
        }
        return false;
    } catch (error) {
        console.error("Error reverting latest transaction:", error);
        return false;
    }
};

export const revertTransaction = async (transactionId: string) => {
    try {
        const docRef = doc(db, TRANSACTIONS_COLLECTION, transactionId);
        const snap = await getDoc(docRef);

        if (snap.exists()) {
            const data = snap.data();
            await updateDoc(docRef, {
                status: 'refunded',
                refundedAt: serverTimestamp()
            });

            if (data.type === 'entry_fee' && data.referenceId && data.userId) {
                await markTournamentPlayerUnpaid(data.referenceId, data.userId, data.tournamentPlayerId);
            }

            await logActivity(
                'transaction',
                data.userName,
                `Refunded $${data.amount} for ${data.referenceName}`,
                { amount: data.amount, status: 'refunded', transactionId, userId: data.userId },
                data.clubId
            );
        }
    } catch (error) {
        console.error("Error reverting transaction:", error);
        throw error;
    }
};

export const getAllTransactions = async (clubId?: string) => {
    try {
        const q = clubId
            ? query(collection(db, TRANSACTIONS_COLLECTION), where('clubId', '==', clubId), orderBy('createdAt', 'desc'))
            : query(collection(db, TRANSACTIONS_COLLECTION), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
    } catch (error) {
        console.error("Error fetching transactions:", error);
        return [];
    }
};
