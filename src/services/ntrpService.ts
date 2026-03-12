
/**
 * NTRP Service
 * Handles dynamic calculation of NTRP points based on category and XP.
 */

export interface NtrpWindow {
    min: number;
    max: number;
}

// Windows defined in the implementation plan
export const CATEGORY_NTRP_WINDOWS: Record<string, NtrpWindow> = {
    'rookie': { min: 1.0, max: 1.7 },
    'principiante': { min: 1.0, max: 1.7 },
    'fifth': { min: 1.8, max: 2.5 },
    'quinta': { min: 1.8, max: 2.5 },
    'fourth': { min: 3.0, max: 3.4 },
    'cuarta': { min: 3.0, max: 3.4 },
    'third': { min: 3.5, max: 4.0 },
    'tercera': { min: 3.5, max: 4.0 },
    'second': { min: 4.5, max: 5.4 },
    'segunda': { min: 4.5, max: 5.4 },
    'first': { min: 5.5, max: 6.4 },
    'primera': { min: 5.5, max: 6.4 },
    'open': { min: 6.5, max: 7.5 },
    'abierta': { min: 6.5, max: 7.5 }
};

export const CATEGORY_PADEL_WINDOWS: Record<string, NtrpWindow> = {
    'sixth': { min: 1.0, max: 2.0 },
    'sexta': { min: 1.0, max: 2.0 },
    'fifth': { min: 2.1, max: 3.0 },
    'quinta': { min: 2.1, max: 3.0 },
    'fourth': { min: 3.1, max: 4.0 },
    'cuarta': { min: 3.1, max: 4.0 },
    'third': { min: 4.1, max: 5.0 },
    'tercera': { min: 4.1, max: 5.0 },
    'second': { min: 5.1, max: 6.0 },
    'segunda': { min: 5.1, max: 6.0 },
    'first': { min: 6.1, max: 7.0 },
    'primera': { min: 6.1, max: 7.0 },
    'open': { min: 7.1, max: 8.0 },
    'abierta': { min: 7.1, max: 8.0 }
};

export const CATEGORY_PICKLEBALL_WINDOWS: Record<string, NtrpWindow> = {
    'rookie': { min: 2.0, max: 3.0 },
    'principiante': { min: 2.0, max: 3.0 },
    'open': { min: 3.1, max: 7.0 },
    'abierta': { min: 3.1, max: 7.0 }
};

const MAX_XP_THRESHOLD = 5000;

/**
 * Calculates current NTRP points based on category and XP.
 * Formula: min + (max - min) * (currentXP / MAX_XP_THRESHOLD)
 */
export const calculateNtrpPoints = (category: string, xp: number): number => {
    return calculateSportPoints(category, xp, 'tennis');
};

/**
 * Generic sport points calculation
 */
export const calculateSportPoints = (category: string, xp: number, sport: 'tennis' | 'padel' | 'pickleball'): number => {
    let windows = CATEGORY_NTRP_WINDOWS;
    let defaultMin = 1.0;

    if (sport === 'padel') {
        windows = CATEGORY_PADEL_WINDOWS;
    } else if (sport === 'pickleball') {
        windows = CATEGORY_PICKLEBALL_WINDOWS;
        defaultMin = 2.0;
    }

    const window = windows[category.toLowerCase()];

    // Default to a beginner range if category is unknown
    if (!window) {
        return defaultMin;
    }

    const clampedXP = Math.min(Math.max(0, xp), MAX_XP_THRESHOLD);
    const progress = clampedXP / MAX_XP_THRESHOLD;

    const points = window.min + (window.max - window.min) * progress;

    // Round to 2 decimal places
    return Math.round(points * 100) / 100;
};
