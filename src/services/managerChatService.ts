import { addDoc, collection, doc, getDoc, getDocs, onSnapshot, orderBy, query, Timestamp, where, limit, updateDoc, increment } from 'firebase/firestore';
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
export const getOrCreateManagerChat = async (managerId: string, adminId: string, clubId: string, clubName: string, managerName?: string): Promise<string> => {
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
            managerName: managerName || 'Platform Manager',
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

export const resetUnreadCount = async (chatId: string, role: 'manager' | 'admin') => {
    try {
        const chatRef = doc(db, "manager_chats", chatId);
        if (role === 'manager') {
            await updateDoc(chatRef, { unreadCountManager: 0 });
        } else {
            await updateDoc(chatRef, { unreadCountAdmin: 0 });
        }
    } catch (error) {
        console.error("Error resetting unread count:", error);
    }
};

export const getChatData = async (chatId: string): Promise<ManagerChat> => {
    const docSnap = await getDoc(doc(db, "manager_chats", chatId));
    if (!docSnap.exists()) throw new Error("Chat not found");
    return { id: docSnap.id, ...docSnap.data() } as ManagerChat;
};

/**
 * Send a message in a manager-admin chat
 */
export const sendManagerMessage = async (chatId: string, senderId: string, role: 'manager' | 'admin', content: string) => {
    try {
        const message = {
            chatId,
            senderId,
            senderRole: role,
            content,
            timestamp: Timestamp.now()
        };

        await addDoc(collection(db, "manager_chats", chatId, "messages"), message);

        // Update chat head
        const chatRef = doc(db, "manager_chats", chatId);
        const updates: any = {
            lastMessage: content,
            lastMessageAt: Timestamp.now()
        };

        if (role === 'manager') {
            updates.unreadCountAdmin = increment(1);
        } else {
            updates.unreadCountManager = increment(1);
        }

        await updateDoc(chatRef, updates);
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

/**
 * Get the first available Platform Manager to start a support chat
 */
export const getSupportManager = async (): Promise<{ uid: string, name: string } | null> => {
    try {
        const managersRef = collection(db, 'users');
        const q = query(managersRef, where('role', '==', 'manager'), limit(1));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) return null;
        
        const managerDoc = snapshot.docs[0];
        const data = managerDoc.data();
        
        return {
            uid: managerDoc.id,
            name: data.displayName || data.name || 'Platform Manager'
        };
    } catch (error) {
        console.error("Error getting support manager:", error);
        return null;
    }
};

/**
 * Get all platform managers
 */
export const getAllManagers = async (): Promise<{ uid: string, name: string }[]> => {
    try {
        const q = query(collection(db, "users"), where("role", "==", "manager"));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            uid: doc.id,
            name: doc.data().displayName || doc.data().name || 'Platform Manager'
        }));
    } catch (error) {
        console.error("Error getting all managers:", error);
        return [];
    }
};
