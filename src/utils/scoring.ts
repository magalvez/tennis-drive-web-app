export interface SetScore {
    player1: number;
    player2: number;
    tiebreak?: {
        player1: number;
        player2: number;
    };
}

export const formatMatchScore = (sets: SetScore[] = []): string => {
    if (!sets || sets.length === 0) return '';

    return sets
        .filter(set => set.player1 > 0 || set.player2 > 0 || (set.tiebreak && (set.tiebreak.player1 > 0 || set.tiebreak.player2 > 0)))
        .map(set => {
            let score = `${set.player1}-${set.player2}`;
            if (set.tiebreak) {
                const maxPoints = Math.max(set.tiebreak.player1, set.tiebreak.player2);
                const minPoints = Math.min(set.tiebreak.player1, set.tiebreak.player2);

                const pointsToShow = maxPoints >= 7 ? minPoints : maxPoints;
                score += `(${pointsToShow})`;
            }
            return score;
        }).join(' ');
};

export const calculateWinner = (sets: SetScore[], p1Id: string, p2Id: string): string | null => {
    let p1Sets = 0;
    let p2Sets = 0;

    sets.forEach(set => {
        let p1WinsSet = false;
        let p2WinsSet = false;

        if (set.tiebreak) {
            if (set.tiebreak.player1 > set.tiebreak.player2) p1WinsSet = true;
            else p2WinsSet = true;
        } else {
            if (set.player1 > set.player2) p1WinsSet = true;
            else if (set.player2 > set.player1) p2WinsSet = true;
        }

        if (p1WinsSet) p1Sets++;
        if (p2WinsSet) p2Sets++;
    });

    if (p1Sets > p2Sets) return p1Id;
    if (p2Sets > p1Sets) return p2Id;

    return null;
};
