import { addDoc, collection, Timestamp, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { logManagerAction } from './managerService';

export interface ManagerNotification {
    id?: string;
    title: string;
    body: string;
    type: 'broadcast' | 'targeted' | 'billing' | 'system' | 'individual';
    targetClubId?: string; // Optional: for targeted notifications
    targetUserId?: string; // Optional: for individual notifications
    createdAt: Timestamp;
    createdBy: string;
    readBy: string[]; // List of user IDs who read it
}

/**
 * Send a notification to a specific user
 */
export const sendIndividualNotification = async (targetUserId: string, title: string, body: string, managerId: string) => {
    try {
        const notification: Omit<ManagerNotification, 'id'> = {
            title,
            body,
            type: 'individual',
            targetUserId: targetUserId,
            createdAt: Timestamp.now(),
            createdBy: managerId,
            readBy: []
        };

        const docRef = await addDoc(collection(db, "manager_notifications"), notification);

        await logManagerAction(
            'send_individual_notification',
            `Notification sent to user ${targetUserId}: ${title}`,
            { targetUserId, title, managerId, notificationId: docRef.id }
        );

        return docRef.id;
    } catch (error) {
        console.error("Error sending individual notification:", error);
        throw error;
    }
};

/**
 * Send a notification to all admins (Broadcast)
 */
export const sendBroadcastNotification = async (title: string, body: string, managerId: string) => {
    try {
        const notification: Omit<ManagerNotification, 'id'> = {
            title,
            body,
            type: 'broadcast',
            createdAt: Timestamp.now(),
            createdBy: managerId,
            readBy: []
        };

        const docRef = await addDoc(collection(db, "manager_notifications"), notification);
        
        await logManagerAction(
            'send_broadcast_notification',
            `Broadcast sent: ${title}`,
            { title, managerId, notificationId: docRef.id }
        );

        return docRef.id;
    } catch (error) {
        console.error("Error sending broadcast:", error);
        throw error;
    }
};

/**
 * Send a notification to a specific club
 */
export const sendTargetedNotification = async (clubId: string, title: string, body: string, type: ManagerNotification['type'], managerId: string) => {
    try {
        const notification: Omit<ManagerNotification, 'id'> = {
            title,
            body,
            type,
            targetClubId: clubId,
            createdAt: Timestamp.now(),
            createdBy: managerId,
            readBy: []
        };

        const docRef = await addDoc(collection(db, "manager_notifications"), notification);

        await logManagerAction(
            'send_targeted_notification',
            `Notification sent to club ${clubId}: ${title}`,
            { clubId, title, managerId, notificationId: docRef.id }
        );

        return docRef.id;
    } catch (error) {
        console.error("Error sending targeted notification:", error);
        throw error;
    }
};

/**
 * Get notifications for a specific club (Admin perspective)
 */
export const getAdminNotifications = async (clubId: string) => {
    try {
        // Get both broadcast and targeted ones
        const broadcastQ = query(
            collection(db, "manager_notifications"),
            where("type", "==", "broadcast"),
            orderBy("createdAt", "desc")
        );
        
        const targetedQ = query(
            collection(db, "manager_notifications"),
            where("targetClubId", "==", clubId),
            orderBy("createdAt", "desc")
        );

        const [broadcastSnap, targetedSnap] = await Promise.all([
            getDocs(broadcastQ),
            getDocs(targetedQ)
        ]);

        const notifications = [
            ...broadcastSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })),
            ...targetedSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        ] as ManagerNotification[];

        // Sort combined list
        return notifications.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
    } catch (error) {
        console.error("Error fetching admin notifications:", error);
        return [];
    }
};
