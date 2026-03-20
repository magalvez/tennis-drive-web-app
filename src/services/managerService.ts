import { addDoc, collection, doc, getDoc, getDocs, query, Timestamp, updateDoc, where, deleteField, orderBy } from 'firebase/firestore';
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
    status: 'active' | 'inactive';
    subscriptionPlan: 'monthly' | 'pay_per_tournament';
    planFees: {
        monthlyFee: number;
        playerFeeSingles: number;
        playerFeeDoubles: number;
    };
    scoringConfig?: ScoringConfig;
    epaycoConfig?: {
        publicKey: string;
        testMode: boolean;
    };
}

export const createClub = async (data: Omit<ClubData, 'createdAt'>) => {
    try {
        const clubData: any = {
            ...data,
            createdAt: Timestamp.now(),
        };

        // Remove undefined fields
        Object.keys(clubData).forEach(key => {
            if (clubData[key] === undefined) {
                delete clubData[key];
            }
        });

        const docRef = await addDoc(collection(db, "clubs"), clubData);

        // Set managedClubId on the user
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
            const club = { id: docData.id, ...docData.data() } as ClubData & { id: string };
            return club;
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
            const club = { id: docSnap.id, ...docSnap.data() } as ClubData & { id: string };
            return club;
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

export const deleteClubEpaycoConfig = async (id: string) => {
    try {
        const docRef = doc(db, "clubs", id);
        await updateDoc(docRef, { epaycoConfig: deleteField() });
    } catch (error) {
        console.error("Error deleting epayco config:", error);
        throw error;
    }
};

export const getAllClubs = async () => {
    try {
        const snapshot = await getDocs(collection(db, "clubs"));
        const clubs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClubData & { id: string }));
        return clubs;
    } catch (error) {
        console.error("Error fetching all clubs:", error);
        throw error;
    }
};

/**
 * Log a manager action to the audit logs
 */
export const logManagerAction = async (action: string, details: string, metadata: any = {}) => {
    try {
        await addDoc(collection(db, "audit_logs"), {
            action,
            details,
            metadata,
            timestamp: Timestamp.now(),
            managerId: metadata.managerId || 'system'
        });
    } catch (error) {
        console.error("Error logging manager action:", error);
    }
};

/**
 * Toggle club status (Active/Inactive)
 */
export const toggleClubStatus = async (clubId: string, status: 'active' | 'inactive', managerId: string) => {
    try {
        const docRef = doc(db, "clubs", clubId);
        await updateDoc(docRef, { status });
        
        await logManagerAction(
            'toggle_club_status',
            `Club status changed to ${status}`,
            { clubId, status, managerId }
        );
    } catch (error) {
        console.error("Error toggling club status:", error);
        throw error;
    }
};

/**
 * Update club subscription configuration
 */
export const updateClubSubscription = async (clubId: string, data: any, managerId: string) => {
    try {
        const docRef = doc(db, "clubs", clubId);
        const updates: any = {};
        
        if (data.subscriptionPlan) updates.subscriptionPlan = data.subscriptionPlan;
        
        // Handle planFees nested update
        if (data.monthlyFee !== undefined || data.playerFeeSingles !== undefined || data.playerFeeDoubles !== undefined) {
            const club = await getClubById(clubId);
            const { subscriptionPlan, ...feeData } = data;
            
            updates.planFees = {
                ...(club?.planFees || { monthlyFee: 0, playerFeeSingles: 0, playerFeeDoubles: 0 }),
                ...feeData
            };
        }

        await updateDoc(docRef, updates);
        
        await logManagerAction(
            'update_club_subscription',
            `Subscription updated for club ${clubId}`,
            { clubId, updates, managerId }
        );
    } catch (error) {
        console.error("Error updating club subscription:", error);
        throw error;
    }
};
/**
 * Calculate and record fees for a tournament (Pay Per Tournament Plan)
 */
export const calculateTournamentFees = async (tournamentId: string, managerId: string = 'system') => {
    try {
        const tournamentResponse = await getDoc(doc(db, "tournaments", tournamentId));
        if (!tournamentResponse.exists()) return null;
        const tournament = tournamentResponse.data();
        const clubId = tournament.clubId;
        if (!clubId) return null;

        const club = await getClubById(clubId);
        if (!club || club.subscriptionPlan !== 'pay_per_tournament') return null;

        // Fetch players and teams
        const playersSnap = await getDocs(collection(db, "tournaments", tournamentId, "players"));
        const teamsSnap = await getDocs(collection(db, "tournaments", tournamentId, "doublesTeams"));

        const singlesCount = playersSnap.size;
        const doublesCount = teamsSnap.size;

        const singlesFee = (club.planFees?.playerFeeSingles || 0) * singlesCount;
        const doublesFee = (club.planFees?.playerFeeDoubles || 0) * doublesCount;
        const totalFee = singlesFee + doublesFee;

        const billingRecord = {
            tournamentId,
            tournamentName: tournament.name,
            clubId,
            singlesCount,
            doublesCount,
            singlesFee,
            doublesFee,
            totalFee,
            calculatedAt: Timestamp.now(),
            status: 'pending',
            triggeredBy: managerId
        };

        const docRef = await addDoc(collection(db, "club_billings"), billingRecord);

        await logManagerAction(
            'calculate_tournament_fees',
            `Fees calculated for tournament ${tournament.name}: ${totalFee} COP`,
            { tournamentId, totalFee, clubId, managerId }
        );

        return { id: docRef.id, ...billingRecord };
    } catch (error) {
        console.error("Error calculating tournament fees:", error);
        throw error;
    }
};
/**
 * Calculate and record monthly fees for all clubs on the 'monthly' plan
 */
export const calculateMonthlyFees = async (managerId: string = 'system') => {
    try {
        const clubs = await getAllClubs();
        const monthlyClubs = clubs.filter(c => c.subscriptionPlan === 'monthly');
        const results = [];

        const now = Timestamp.now();
        const monthYear = `${now.toDate().getMonth() + 1}-${now.toDate().getFullYear()}`;

        for (const club of monthlyClubs) {
            const monthlyFee = club.planFees?.monthlyFee || 0;
            
            const billingRecord = {
                clubId: club.id,
                clubName: club.name,
                monthlyFee,
                totalFee: monthlyFee,
                calculatedAt: now,
                billingPeriod: monthYear,
                status: 'pending',
                triggeredBy: managerId,
                type: 'monthly'
            };

            const docRef = await addDoc(collection(db, "club_billings"), billingRecord);
            
            await logManagerAction(
                'calculate_monthly_fee',
                `Monthly fee processed for ${club.name}: ${monthlyFee} COP`,
                { clubId: club.id, totalFee: monthlyFee, managerId }
            );

            results.push({ id: docRef.id, ...billingRecord });
        }

        return results;
    } catch (error) {
        console.error("Error calculating monthly fees:", error);
        throw error;
    }
};

/**
 * Manually trigger fee calculation for a club for the current month
 */
export const triggerManualMonthlyBilling = async (clubId: string, managerId: string) => {
    try {
        const club = await getClubById(clubId);
        if (!club) throw new Error("Club not found");

        const now = Timestamp.now();
        const monthYear = `${now.toDate().getMonth() + 1}-${now.toDate().getFullYear()}`;
        const monthlyFee = club.planFees?.monthlyFee || 0;

        const billingRecord = {
            clubId: club.id,
            clubName: club.name,
            monthlyFee,
            totalFee: monthlyFee,
            calculatedAt: now,
            billingPeriod: monthYear,
            status: 'pending',
            triggeredBy: managerId,
            type: 'monthly_manual'
        };

        const docRef = await addDoc(collection(db, "club_billings"), billingRecord);
        
        await logManagerAction(
            'trigger_manual_billing',
            `Manual monthly billing triggered for ${club.name}: ${monthlyFee} COP`,
            { clubId, totalFee: monthlyFee, managerId }
        );

        return { id: docRef.id, ...billingRecord };
    } catch (error) {
        console.error("Error triggering manual billing:", error);
        throw error;
    }
};
/**
 * Block or Unblock a tournament
 */
export const toggleTournamentBlock = async (tournamentId: string, isBlocked: boolean, managerId: string) => {
    try {
        const docRef = doc(db, "tournaments", tournamentId);
        await updateDoc(docRef, { isBlocked });
        
        await logManagerAction(
            isBlocked ? 'block_tournament' : 'unblock_tournament',
            `Tournament ${tournamentId} ${isBlocked ? 'blocked' : 'unblocked'}`,
            { tournamentId, isBlocked, managerId }
        );
    } catch (error) {
        console.error("Error toggling tournament block:", error);
        throw error;
    }
};

/**
 * Remove a tournament (Manager only)
 */
export const removeTournament = async (tournamentId: string, managerId: string) => {
    try {
        const docRef = doc(db, "tournaments", tournamentId);
        await updateDoc(docRef, { 
            status: 'removed',
            removedAt: Timestamp.now(),
            removedBy: managerId
        });
        
        await logManagerAction(
            'remove_tournament',
            `Tournament ${tournamentId} marked as removed`,
            { tournamentId, managerId }
        );
    } catch (error) {
        console.error("Error removing tournament:", error);
        throw error;
    }
};

/**
 * Get revenue analytics summary
 */
export const getRevenueAnalytics = async () => {
    try {
        const billingSnap = await getDocs(collection(db, "club_billings"));
        const billings = billingSnap.docs.map(doc => doc.data());

        const totalRevenue = billings.reduce((sum, b) => sum + (b.totalFee || 0), 0);
        const pendingRevenue = billings
            .filter(b => b.status === 'pending')
            .reduce((sum, b) => sum + (b.totalFee || 0), 0);
        
        // Group by month
        const revenueByMonth: { [key: string]: number } = {};
        billings.forEach(b => {
            const date = b.calculatedAt?.toDate() || new Date();
            const monthYear = `${date.getMonth() + 1}/${date.getFullYear()}`;
            revenueByMonth[monthYear] = (revenueByMonth[monthYear] || 0) + (b.totalFee || 0);
        });

        return {
            totalRevenue,
            pendingRevenue,
            paidRevenue: totalRevenue - pendingRevenue,
            revenueByMonth,
            billingCount: billings.length
        };
    } catch (error) {
        console.error("Error fetching revenue analytics:", error);
        throw error;
    }
};

export const getAllBillings = async () => {
    try {
        const q = query(collection(db, "club_billings"), orderBy("calculatedAt", "desc"));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
    } catch (error) {
        console.error("Error fetching billings:", error);
        throw error;
    }
};

export const updateBillingStatus = async (billingId: string, status: 'paid' | 'pending', managerId: string) => {
    try {
        const docRef = doc(db, "club_billings", billingId);
        await updateDoc(docRef, { 
            status,
            updatedAt: Timestamp.now(),
            updatedBy: managerId
        });
        
        await logManagerAction(
            'update_billing_status',
            `Billing ${billingId} status changed to ${status}`,
            { billingId, status, managerId }
        );
    } catch (error) {
        console.error("Error updating billing status:", error);
        throw error;
    }
};
