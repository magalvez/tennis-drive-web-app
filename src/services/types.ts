import { Timestamp } from 'firebase/firestore';

export type TournamentCategory = 'open' | 'first' | 'second' | 'third' | 'fourth' | 'fifth' | 'sixth' | 'rookie';

export interface ScoringConfig {
    win: number;
    loss: number;
    withdraw: number;
}

export interface SetScore {
    player1: number;
    player2: number;
    tiebreak?: {
        player1: number;
        player2: number;
    };
}

export interface ModalityConfig {
    singles?: { categories: TournamentCategory[] };
    doubles?: { categories: TournamentCategory[] };
}

export interface PaymentMethods {
    cash: boolean;
    wireTransfer: boolean;
    gateway: boolean;
}

export interface GatewayConfig {
    disabledMethods: string[];
}

export interface TournamentData {
    id?: string;
    name: string;
    date: string;
    location: string;
    entryFee: number;
    status: 'upcoming' | 'active' | 'completed';
    createdAt: Timestamp;
    clubId?: string;
    winnerId?: string;
    courtType?: 'hard' | 'clay' | 'grass' | 'indoor' | 'outdoor' | 'glass' | 'wall';
    image?: string | null;
    scoringConfig?: ScoringConfig;
    categories?: TournamentCategory[];
    isChatEnabled?: boolean;
    isChatReadOnly?: boolean;
    sport?: 'tennis' | 'padel' | 'pickleball';
    description?: string;
    modalities?: {
        singles?: boolean;
        doubles?: boolean;
    };
    modalityConfig?: ModalityConfig;
    paymentMethods?: PaymentMethods;
    gatewayConfig?: GatewayConfig;
    champions?: { [key: string]: string };
    subchampions?: { [key: string]: string };
    removedBy?: string;
    isBlocked?: boolean;
}

export interface TournamentPlayer {
    id: string;
    name: string;
    email?: string;
    uid: string;
    status: 'pending' | 'confirmed';
    paymentStatus?: 'paid' | 'unpaid';
    paidAt?: any;
    transactionId?: string;
    addedAt: Timestamp;
    isWildcard?: boolean;
    group?: string;
    seed?: number;
    isManual?: boolean;
    category?: TournamentCategory;
    playerProfileCategory?: TournamentCategory;
    registrationStatus?: 'approved' | 'pending' | 'rejected';
    clubId?: string;
    tournamentName?: string;
    isCheckedIn?: boolean;
    checkInTime?: Timestamp;
}

export interface Match {
    id: string;
    player1Name: string;
    player1Uid: string;
    player2Name: string;
    player2Uid: string;
    sets?: SetScore[];
    score?: string;
    winnerId?: string;
    status: 'scheduled' | 'completed' | 'pending' | 'rejected' | 'waiting_for_confirmation';
    round?: number;
    tournamentId?: string;
    type?: 'tournament' | 'challenge';
    group?: string;
    category?: TournamentCategory;
    bracketRound?: string;
    roundNumber?: number;
    bracketPosition?: number;
    isBye?: boolean;
    player1Seed?: number;
    player2Seed?: number;
    isWithdrawal?: boolean;
    nextMatchId?: string;
    nextMatchSlot?: 1 | 2;
    tournamentName?: string;
    isDoubles?: boolean;
    team1Id?: string;
    team1Name?: string;
    team2Id?: string;
    team2Name?: string;
    winnerTeamId?: string;
    team1Seed?: number;
    team2Seed?: number;
    sport?: 'tennis' | 'padel' | 'pickleball';
}

export interface GroupStanding {
    position: number;
    playerId: string;
    playerName: string;
    uid: string;
    points: number;
    wins: number;
    losses: number;
    played: number;
    group: string;
    isQualifier: boolean;
}

export interface TournamentGroup {
    id: string;
    name: string;
    playerIds: string[];
    status: 'in_progress' | 'completed';
    qualifiersCount: number;
    finalStandings?: GroupStanding[];
    category?: TournamentCategory;
    isDoubles?: boolean;
}

export interface Transaction {
    id: string;
    userId: string;
    userName: string;
    amount: number;
    currency: string;
    status: 'pending' | 'completed' | 'failed' | 'refunded';
    type: 'entry_fee' | 'other';
    referenceId?: string;
    referenceName?: string;
    gatewayRef?: string;
    paymentMethod?: string;
    tournamentPlayerId?: string;
    clubId?: string;
    createdAt: any;
    completedAt?: any;
    failedAt?: any;
    failureReason?: string;
    refundedAt?: any;
}
