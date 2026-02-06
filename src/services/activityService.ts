import { addDoc, collection, limit as firestoreLimit, getDocs, onSnapshot, orderBy, query, Timestamp, where } from 'firebase/firestore';
import { db } from '../config/firebase';

export type ActivityType = 'transaction' | 'tournament_create' | 'tournament_join' | 'tournament_withdraw' | 'user_register' | 'match_complete';

export interface Activity {
    id: string;
    type: ActivityType;
    title: string;
    description: string;
    metadata?: any;
    clubId?: string;
    createdAt: Timestamp;
}

export const logActivity = async (
    type: ActivityType,
    title: string,
    description: string,
    metadata: any = {},
    clubId?: string
) => {
    try {
        const activitiesRef = collection(db, 'activities');
        const activityData: any = {
            type,
            title,
            description,
            metadata,
            createdAt: Timestamp.now(),
        };

        if (clubId) {
            activityData.clubId = clubId;
        }

        await addDoc(activitiesRef, activityData);
    } catch (error) {
        console.error('Error logging activity:', error);
    }
};

export const getRecentActivities = async (limitCount: number = 20, clubId?: string): Promise<Activity[]> => {
    try {
        const activitiesRef = collection(db, 'activities');
        let q;
        if (clubId) {
            q = query(
                activitiesRef,
                where('clubId', '==', clubId),
                orderBy('createdAt', 'desc'),
                firestoreLimit(limitCount)
            );
        } else {
            q = query(activitiesRef, orderBy('createdAt', 'desc'), firestoreLimit(limitCount));
        }
        const snapshot = await getDocs(q);

        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as Activity));
    } catch (error) {
        console.error('Error fetching activities:', error);
        return [];
    }
};

export const subscribeToRecentActivities = (
    limitCount: number = 20,
    clubId: string | undefined,
    callback: (activities: Activity[]) => void
) => {
    const activitiesRef = collection(db, 'activities');
    let q;
    if (clubId) {
        q = query(
            activitiesRef,
            where('clubId', '==', clubId),
            orderBy('createdAt', 'desc'),
            firestoreLimit(limitCount)
        );
    } else {
        q = query(activitiesRef, orderBy('createdAt', 'desc'), firestoreLimit(limitCount));
    }

    return onSnapshot(q, (snapshot) => {
        const activities = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as Activity));
        callback(activities);
    });
};
