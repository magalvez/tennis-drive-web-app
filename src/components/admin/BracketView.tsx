import { Check, User } from 'lucide-react';
import React from 'react';
import type { BracketMatch } from '../../services/bracketService';

interface BracketViewProps {
    matches: BracketMatch[];
    bracketSize: number;
    onMatchPress: (match: BracketMatch) => void;
}

const BracketView: React.FC<BracketViewProps> = ({ matches, bracketSize, onMatchPress }) => {
    const roundsCount = Math.log2(bracketSize);

    // Group matches by round number
    const matchesByRound: { [key: number]: BracketMatch[] } = {};
    for (let i = 1; i <= roundsCount; i++) {
        matchesByRound[i] = [];
    }

    matches.forEach(match => {
        if (match.roundNumber && matchesByRound[match.roundNumber]) {
            matchesByRound[match.roundNumber].push(match);
        }
    });

    Object.keys(matchesByRound).forEach(key => {
        const roundNum = parseInt(key);
        matchesByRound[roundNum].sort((a, b) => (a.bracketPosition || 0) - (b.bracketPosition || 0));
    });

    const getRoundTitle = (round: number) => {
        if (round === roundsCount) return "Final";
        if (round === roundsCount - 1) return "Semi Finals";
        if (round === roundsCount - 2) return "Quarter Finals";
        return `Round ${round}`;
    };

    return (
        <div className="flex gap-12 overflow-x-auto pb-8 min-h-[600px] px-4">
            {Object.keys(matchesByRound).map((key) => {
                const roundNumber = parseInt(key);
                const roundMatches = matchesByRound[roundNumber];

                return (
                    <div key={key} className="flex flex-col min-w-[280px]">
                        <div className="sticky top-0 z-10 bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/10 mb-8 text-center">
                            <h4 className="text-white font-black uppercase tracking-widest text-xs">
                                {getRoundTitle(roundNumber)}
                            </h4>
                        </div>

                        <div className="flex-1 flex flex-col justify-around gap-6">
                            {roundMatches.map((match) => {
                                const isCompleted = match.status === 'completed';
                                const canPress = !match.isBye && !!match.player1Uid && !!match.player2Uid;

                                return (
                                    <div
                                        key={match.id}
                                        onClick={() => canPress && onMatchPress(match)}
                                        className={`glass group relative overflow-hidden transition-all duration-300 ${canPress ? 'cursor-pointer hover:border-tennis-green/30 hover:scale-[1.02]' : 'opacity-80'
                                            }`}
                                    >
                                        <div className="flex flex-col">
                                            {/* Player 1 */}
                                            <div className={`flex items-center justify-between p-4 border-b border-white/5 ${match.winnerId === match.player1Uid ? 'bg-tennis-green/5' : ''}`}>
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${match.winnerId === match.player1Uid ? 'bg-tennis-green/20 text-tennis-green' : 'bg-white/5 text-gray-500'}`}>
                                                        <span className="text-[10px] font-black">{match.player1Seed || <User size={14} />}</span>
                                                    </div>
                                                    <span className={`font-bold text-sm ${match.winnerId === match.player1Uid ? 'text-tennis-green' : !match.player1Name ? 'text-gray-600 italic' : 'text-white'
                                                        }`}>
                                                        {match.player1Name || (match.isBye ? 'BYE' : 'TBD')}
                                                    </span>
                                                </div>
                                                {match.winnerId === match.player1Uid && <Check size={14} className="text-tennis-green" />}
                                            </div>

                                            {/* Player 2 */}
                                            <div className={`flex items-center justify-between p-4 ${match.winnerId === match.player2Uid ? 'bg-tennis-green/5' : ''}`}>
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${match.winnerId === match.player2Uid ? 'bg-tennis-green/20 text-tennis-green' : 'bg-white/5 text-gray-500'}`}>
                                                        <span className="text-[10px] font-black">{match.player2Seed || <User size={14} />}</span>
                                                    </div>
                                                    <span className={`font-bold text-sm ${match.winnerId === match.player2Uid ? 'text-tennis-green' : !match.player2Name ? 'text-gray-600 italic' : 'text-white'
                                                        }`}>
                                                        {match.player2Name || (match.isBye ? 'BYE' : 'TBD')}
                                                    </span>
                                                </div>
                                                {match.winnerId === match.player2Uid && <Check size={14} className="text-tennis-green" />}
                                            </div>
                                        </div>

                                        {isCompleted && (
                                            <div className="absolute top-0 right-0 p-1">
                                                <div className="bg-tennis-green/20 text-tennis-green text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter shadow-lg backdrop-blur-sm">Done</div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default BracketView;
