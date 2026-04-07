import { addDoc, collection, doc, getDoc, getDocs, onSnapshot, orderBy, query, Timestamp, where, limit, updateDoc, increment } from 'firebase/firestore';
import { db } from '../config/firebase';
import { col } from '../config/environment';


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
    status: 'active' | 'closed';
    clubName?: string;
    managerName?: string;
}

/**
 * Get or Create a chat between a manager and an admin
 */
export const getOrCreateManagerChat = async (managerId: string, adminId: string, clubId: string, clubName: string, managerName?: string): Promise<string> => {
    try {
        const q = query(
            collection(db, col('manager_chats')),
            where("managerId", "==", managerId),
            where("adminId", "==", adminId),
            where("status", "==", "active")
        );
        
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            return snapshot.docs[0].id;
        }

        const newChat: any = {
            managerId,
            adminId,
            clubId,
            clubName, // Pre-store name for easier listing
            managerName: managerName || 'Platform Manager',
            unreadCountAdmin: 0,
            unreadCountManager: 0,
            lastMessageAt: Timestamp.now(),
            status: 'active'
        };

        const docRef = await addDoc(collection(db, col('manager_chats')), newChat);
        return docRef.id;
    } catch (error) {
        console.error("Error get/create manager chat:", error);
        throw error;
    }
};

export const resetUnreadCount = async (chatId: string, role: 'manager' | 'admin') => {
    try {
        const chatRef = doc(db, col('manager_chats'), chatId);
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
    const docSnap = await getDoc(doc(db, col('manager_chats'), chatId));
    if (!docSnap.exists()) throw new Error("Chat not found");
    return { id: docSnap.id, ...docSnap.data() } as ManagerChat;
};

/**
 * Send a message in a manager-admin chat
 */
export const sendManagerMessage = async (chatId: string, senderId: string, role: 'manager' | 'admin', content: string) => {
    try {
        const chatRef = doc(db, col('manager_chats'), chatId);
        const chatSnap = await getDoc(chatRef);
        if (!chatSnap.exists()) throw new Error("Chat not found");
        const chatData = chatSnap.data() as ManagerChat;

        if (chatData.status === 'closed') {
            throw new Error("Cannot send messages to a closed chat");
        }

        const message = {
            chatId,
            senderId,
            senderRole: role,
            content,
            timestamp: Timestamp.now()
        };

        await addDoc(collection(db, col('manager_chats'), chatId, "messages"), message);

        // Update chat head
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
        collection(db, col('manager_chats'), chatId, "messages"),
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
 * Close a support chat
 */
export const closeManagerChat = async (chatId: string) => {
    try {
        const chatRef = doc(db, col('manager_chats'), chatId);
        await updateDoc(chatRef, { 
            status: 'closed',
            lastMessage: 'Chat closed',
            lastMessageAt: Timestamp.now()
        });
    } catch (error) {
        console.error("Error closing manager chat:", error);
        throw error;
    }
};

/**
 * Subscribe to chat head data
 */
export const subscribeToChatHead = (chatId: string, callback: (chat: ManagerChat) => void) => {
    const chatRef = doc(db, col('manager_chats'), chatId);
    return onSnapshot(chatRef, (snapshot) => {
        if (snapshot.exists()) {
            callback({ id: snapshot.id, ...snapshot.data() } as ManagerChat);
        }
    });
};

/**
 * Get the first available Platform Manager to start a support chat
 */
export const getSupportManager = async (): Promise<{ uid: string, name: string } | null> => {
    try {
        const managersRef = collection(db, col('users'));
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
        const q = query(collection(db, col('users')), where("role", "==", "manager"));
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
