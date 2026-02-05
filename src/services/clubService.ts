import { addDoc, collection, doc, getDoc, getDocs, query, Timestamp, updateDoc, where } from 'firebase/firestore';
import { db } from '../config/firebase';

export interface ScoringConfig {
    win: number;
    loss: number;
    withdraw: number;
}

export interface ClubData {
    name: string;
    location: string;
    description?: string;
    adminUid: string;
    createdAt: Timestamp;
    logoUrl?: string;
    scoringConfig?: ScoringConfig;
}

export const createClub = async (data: Omit<ClubData, 'createdAt'>) => {
    try {
        const clubData: any = {
            ...data,
            createdAt: Timestamp.now(),
        };

        Object.keys(clubData).forEach(key => {
            if (clubData[key] === undefined) {
                delete clubData[key];
            }
        });

        const docRef = await addDoc(collection(db, "clubs"), clubData);

        const userRef = doc(db, "users", data.adminUid);
        await updateDoc(userRef, {
            managedClubId: docRef.id
        });

        return docRef.id;
    } catch (error) {
        console.error("Error creating club: ", error);
        throw error;
    }
};

export const getClubByAdmin = async (adminUid: string) => {
    try {
        const q = query(collection(db, "clubs"), where("adminUid", "==", adminUid));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            const docData = snapshot.docs[0];
            return { id: docData.id, ...docData.data() } as ClubData & { id: string };
        }
        return null;
    } catch (error) {
        console.error("Error fetching club by admin:", error);
        return null;
    }
};

export const getClubById = async (id: string) => {
    try {
        const docRef = doc(db, "clubs", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() } as ClubData & { id: string };
        }
        return null;
    } catch (error) {
        console.error("Error fetching club:", error);
        throw error;
    }
};

export const updateClub = async (id: string, data: Partial<ClubData>) => {
    try {
        const docRef = doc(db, "clubs", id);
        await updateDoc(docRef, data);
    } catch (error) {
        console.error("Error updating club:", error);
        throw error;
    }
};

export const getAllClubs = async () => {
    try {
        const snapshot = await getDocs(collection(db, "clubs"));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClubData & { id: string }));
    } catch (error) {
        console.error("Error fetching all clubs:", error);
        throw error;
    }
};
