import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from '../config/firebase';
import type { TournamentData } from '../services/types';

export interface Tournament extends TournamentData {
    id: string;
}

export const useTournaments = (clubId?: string) => {
    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let q;
        if (clubId) {
            q = query(
                collection(db, "tournaments"),
                where("clubId", "==", clubId),
                orderBy("createdAt", "desc")
            );
        } else {
            q = query(collection(db, "tournaments"), orderBy("createdAt", "desc"));
        }

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const t: Tournament[] = [];
            querySnapshot.forEach((doc) => {
                t.push({ id: doc.id, ...doc.data() } as Tournament);
            });
            setTournaments(t);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching tournaments:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [clubId]);

    return { tournaments, loading };
};
