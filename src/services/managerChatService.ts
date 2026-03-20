import { addDoc, collection, doc, getDocs, onSnapshot, orderBy, query, Timestamp, where, limit, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

export interface ManagerChatMessage {
    id?: string;
    senderId: string;
    senderRole: 'manager' | 'admin';
    content: string;
    timestamp: Timestamp;
    chatId: string;
}

export interface ManagerChat {
    id: string;
    managerId: string;
    adminId: string;
    clubId: string;
    lastMessage?: string;
    lastMessageAt?: Timestamp;
    unreadCountAdmin: number;
    unreadCountManager: number;
}

/**
 * Get or Create a chat between a manager and an admin
 */
export const getOrCreateManagerChat = async (managerId: string, adminId: string, clubId: string, clubName: string): Promise<string> => {
    try {
        const q = query(
            collection(db, "manager_chats"),
            where("managerId", "==", managerId),
            where("adminId", "==", adminId)
        );
        
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            return snapshot.docs[0].id;
        }

        const newChat = {
            managerId,
            adminId,
            clubId,
            clubName, // Pre-store name for easier listing
            unreadCountAdmin: 0,
            unreadCountManager: 0,
            lastMessageAt: Timestamp.now()
        };

        const docRef = await addDoc(collection(db, "manager_chats"), newChat);
        return docRef.id;
    } catch (error) {
        console.error("Error get/create manager chat:", error);
        throw error;
    }
};

/**
 * Send a message in a manager-admin chat
 */
export const sendManagerMessage = async (chatId: string, senderId: string, role: 'manager' | 'admin', content: string) => {
    try {
        const message: Omit<ManagerChatMessage, 'id'> = {
            chatId,
            senderId,
            senderRole: role,
            content,
            timestamp: Timestamp.now()
        };

        await addDoc(collection(db, "manager_chats", chatId, "messages"), message);

        // Update chat head
        const chatRef = doc(db, "manager_chats", chatId);
        await updateDoc(chatRef, {
            lastMessage: content,
            lastMessageAt: Timestamp.now()
        });
    } catch (error) {
        console.error("Error sending manager message:", error);
        throw error;
    }
};

/**
 * Subscribe to messages in a chat
 */
export const subscribeToManagerMessages = (chatId: string, callback: (messages: ManagerChatMessage[]) => void) => {
    const q = query(
        collection(db, "manager_chats", chatId, "messages"),
        orderBy("timestamp", "desc"),
        limit(50)
    );

    return onSnapshot(q, (snapshot) => {
        const messages = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as ManagerChatMessage));
        callback(messages.reverse());
    });
};
