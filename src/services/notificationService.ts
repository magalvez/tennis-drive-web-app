import { addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query, Timestamp, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { col } from '../config/environment';


// Helper to get a user's push token
export const getUserPushToken = async (uid: string): Promise<string | null> => {
    try {
        const userRef = doc(db, col('users'), uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            return userSnap.data().pushToken || null;
        }
        return null;
    } catch (error) {
        console.error("Error fetching push token:", error);
        return null;
    }
};

// URL for the Expo Relay (Local proxy in dev, Cloud Function in production)
const PUSH_RELAY_URL = import.meta.env.DEV
    ? '/expo-push'
    : 'https://us-central1-tennis-driveapp.cloudfunctions.net/relayPushNotifications';

// Send a single notification via Expo Push API
export const sendPushNotification = async (expoPushToken: string, title: string, body: string, data: any = {}) => {
    // Temporarily disabled for testing
    console.log(`[Push Notification (DISABLED)] To: ${expoPushToken}, Title: ${title}, Body: ${body}`);
    return;
};

export const addNotification = async (
    targetUid: string,
    title: string,
    body: string,
    type: 'challenge' | 'tournament' | 'system' = 'system',
    referenceId?: string
) => {
    try {
        await addDoc(collection(db, col('users'), targetUid, "notifications"), {
            title,
            body,
            date: Timestamp.now(),
            read: false,
            type,
            referenceId: referenceId || null
        });
    } catch (error) {
        console.error("Error adding in-app notification:", error);
    }
};

export interface NotificationItem {
    id: string;
    title: string;
    body: string;
    date: any; // Timestamp
    read: boolean;
    type?: 'challenge' | 'tournament' | 'system';
    referenceId?: string;
}

export const getUserNotifications = async (uid: string, limitCount = 20) => {
    try {
        const notifsRef = collection(db, col('users'), uid, "notifications");
        const q = query(notifsRef, orderBy("date", "desc"), limit(limitCount));
        const snapshot = await getDocs(q);

        const notifications: NotificationItem[] = [];
        snapshot.forEach(doc => {
            notifications.push({ id: doc.id, ...doc.data() } as NotificationItem);
        });
        return notifications;
    } catch (error) {
        console.error("Error fetching notifications:", error);
        return [];
    }
};

export const notifyPlayerApproved = async (uid: string, title: string, body: string) => {
    // In-app notification
    await addNotification(uid, title, body, 'tournament');

    // Push notification
    const token = await getUserPushToken(uid);
    if (token) {
        await sendPushNotification(token, title, body);
    }
};

export const notifyPlayerRejected = async (uid: string, title: string, body: string) => {
    // In-app notification
    await addNotification(uid, title, body, 'tournament');

    // Push notification
    const token = await getUserPushToken(uid);
    if (token) {
        await sendPushNotification(token, title, body);
    }
};

export const getAllPushTokens = async (clubId?: string): Promise<string[]> => {
    try {
        const usersRef = collection(db, col('users'));
        let q;
        if (clubId) {
            q = query(usersRef, where(`clubs.${clubId}`, "!=", null));
        } else {
            q = query(usersRef, where('pushToken', '!=', null));
        }
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => doc.data().pushToken).filter(t => !!t);
    } catch (error) {
        console.error("Error fetching all tokens:", error);
        return [];
    }
};

export const sendPushNotificationsBatch = async (tokens: string[], title: string, body: string, data: any = {}) => {
    // Temporarily disabled for testing
    console.log(`[Push Batch (DISABLED)] To ${tokens.length} users: ${title}`);
    return;
};

export interface UserWithToken {
    uid: string;
    displayName: string;
    email: string;
    pushToken: string;
}

export const getUsersWithTokens = async (clubId?: string): Promise<UserWithToken[]> => {
    try {
        const usersRef = collection(db, col('users'));
        let q;
        if (clubId) {
            q = query(usersRef, where(`clubs.${clubId}`, "!=", null));
        } else {
            q = query(usersRef, where('pushToken', '!=', null));
        }
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            uid: doc.id,
            displayName: doc.data().displayName || doc.data().name || 'Anonymous',
            email: doc.data().email || '',
            pushToken: doc.data().pushToken
        })).filter(u => !!u.pushToken);
    } catch (error) {
        console.error("Error fetching users with tokens:", error);
        return [];
    }
};
export const sendTournamentAnnouncement = async (tournamentId: string, playerUids: string[], title: string, body: string) => {
    try {
        // 1. Fetch tokens for all players
        const tokens: string[] = [];
        for (const uid of playerUids) {
            if (uid.startsWith('manual_')) continue;

            const token = await getUserPushToken(uid);
            if (token) tokens.push(token);

            // 2. Add in-app notification
            await addNotification(uid, title, body, 'tournament', tournamentId);
        }

        // 3. Send batch push notifications
        if (tokens.length > 0) {
            await sendPushNotificationsBatch(tokens, title, body, { tournamentId });
        }

        return tokens.length;
    } catch (error) {
        console.error("Error sending tournament announcement:", error);
        throw error;
    }
};
