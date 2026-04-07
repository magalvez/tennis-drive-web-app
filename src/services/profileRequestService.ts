
import {
    addDoc,
    collection,
    doc,
    getDoc,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    updateDoc,
    where,
    writeBatch
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { col } from '../config/environment';

export interface CategoryRequest {
    id: string;
    userId: string;
    userName: string;
    currentCategory: string;
    requestedCategory: string;
    reason: string;
    clubId: string;
    status: 'pending' | 'approved' | 'rejected';
    createdAt: any;
    adminId?: string;
    rejectionReason?: string;
    resolvedAt?: any;
}

// Automatic NTRP Mapping
export const CATEGORY_NTRP_MAP: Record<string, string> = {
    // English Keys
    'rookie': 'Beginner (1.0 - 2.5)',
    'fifth': 'Beginner (1.0 - 2.5)',
    'fourth': 'Intermediate (3.0 - 4.0)',
    'third': 'Intermediate (3.0 - 4.0)',
    'second': 'Advanced (4.5+)',
    'first': 'Advanced (4.5+)',
    'open': 'Advanced (4.5+)',
    // Spanish Keys
    'principiante': 'Beginner (1.0 - 2.5)',
    'quinta': 'Beginner (1.0 - 2.5)',
    'cuarta': 'Intermediate (3.0 - 4.0)',
    'tercera': 'Intermediate (3.0 - 4.0)',
    'segunda': 'Advanced (4.5+)',
    'primera': 'Advanced (4.5+)',
    'abierta': 'Advanced (4.5+)'
};

/**
 * Submit a new category change request
 */
export const submitCategoryRequest = async (
    userId: string,
    userName: string,
    currentCategory: string,
    requestedCategory: string,
    reason: string,
    clubId: string
) => {
    try {
        const requestsRef = collection(db, col('profileChangeRequests'));
        await addDoc(requestsRef, {
            userId,
            userName,
            currentCategory,
            requestedCategory,
            reason,
            clubId,
            status: 'pending',
            createdAt: serverTimestamp()
        });
    } catch (error) {
        console.error("Error submitting category request:", error);
        throw error;
    }
};

/**
 * Subscribe to pending category requests for a specific club
 */
export const subscribeToPendingRequests = (clubId: string, callback: (requests: CategoryRequest[]) => void) => {
    const requestsRef = collection(db, col('profileChangeRequests'));
    const q = query(
        requestsRef,
        where("clubId", "==", clubId),
        where("status", "==", "pending"),
        orderBy("createdAt", "desc")
    );

    return onSnapshot(q, (snapshot) => {
        const requests = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as CategoryRequest[];
        callback(requests);
    });
};

/**
 * Approve a category change request
 */
export const approveCategoryRequest = async (request: CategoryRequest, adminId: string) => {
    try {
        const batch = writeBatch(db);

        // 1. Update request status
        const requestRef = doc(db, col('profileChangeRequests'), request.id);
        batch.update(requestRef, {
            status: 'approved',
            adminId,
            resolvedAt: serverTimestamp()
        });

        // 2. Update user profile
        const userRef = doc(db, col('users'), request.userId);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.data();
        const currentXP = userData?.sportsProfiles?.tennis?.points || 0;

        const catKey = request.requestedCategory.toLowerCase();
        const newNtrp = CATEGORY_NTRP_MAP[catKey] || 'Beginner (1.0 - 2.5)';

        const { calculateNtrpPoints } = await import('./ntrpService');
        const ntrpPoints = calculateNtrpPoints(request.requestedCategory, currentXP);

        batch.update(userRef, {
            "sportsProfiles.tennis.category": request.requestedCategory,
            "sportsProfiles.tennis.ntrp": newNtrp,
            "sportsProfiles.tennis.ntrp_points": ntrpPoints
        });

        await batch.commit();
    } catch (error) {
        console.error("Error approving category request:", error);
        throw error;
    }
};

/**
 * Reject a category change request
 */
export const rejectCategoryRequest = async (requestId: string, adminId: string, reason: string) => {
    try {
        const requestRef = doc(db, col('profileChangeRequests'), requestId);
        await updateDoc(requestRef, {
            status: 'rejected',
            adminId,
            rejectionReason: reason,
            resolvedAt: serverTimestamp()
        });
    } catch (error) {
        console.error("Error rejecting category request:", error);
        throw error;
    }
};

import { getDocs, limit } from 'firebase/firestore';


export const hasPendingRequest = async (userId: string) => {
    try {
        const requestsRef = collection(db, col('profileChangeRequests'));
        const q = query(
            requestsRef,
            where("userId", "==", userId),
            where("status", "==", "pending"),
            limit(1)
        );
        const snapshot = await getDocs(q);
        return !snapshot.empty;
    } catch (error) {
        console.error("Error checking pending request:", error);
        return false;
    }
};
