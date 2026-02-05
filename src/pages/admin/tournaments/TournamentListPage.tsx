import { Calendar, ChevronRight, MapPin, Plus, Trophy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { useLanguage } from '../../../context/LanguageContext';
import { getTournamentsByClub } from '../../../services/tournamentService';
import type { TournamentData } from '../../../services/types';

const TournamentListPage = () => {
    const navigate = useNavigate();
    const { managedClubId } = useAuth();
    const { t } = useLanguage();
    const [tournaments, setTournaments] = useState<TournamentData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTournaments = async () => {
            if (!managedClubId) return;
            try {
                const data = await getTournamentsByClub(managedClubId);
                setTournaments(data);
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };
        fetchTournaments();
    }, [managedClubId]);

    const getStatusStyles = (status: string) => {
        switch (status) {
            case 'completed': return 'bg-white/5 text-gray-500 border-white/5';
            case 'active': return 'bg-tennis-green/10 text-tennis-green border-tennis-green/20';
            case 'upcoming': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
            default: return 'bg-white/5 text-white border-white/10';
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-tennis-green"></div>
        </div>
    );

    return (
        <div className="space-y-10 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-white text-4xl font-extrabold uppercase tracking-tight">{t('tournaments.title')}</h1>
                    <p className="text-gray-500 font-bold uppercase text-[10px] tracking-widest mt-1">{t('tournaments.subtitle')}</p>
                </div>
                <button
                    onClick={() => navigate('/admin/tournaments/create')}
                    className="bg-tennis-green hover:bg-tennis-green/90 text-tennis-dark px-10 py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-tennis-green/20 transition-all flex items-center gap-2"
                >
                    <Plus size={20} />
                    {t('tournaments.createButton')}
                </button>
            </div>

            {/* List */}
            <div className="grid grid-cols-1 gap-4">
                {tournaments.length === 0 ? (
                    <div className="glass p-20 rounded-[40px] border-dashed border-2 border-white/10 flex flex-col items-center justify-center text-center">
                        <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center text-gray-600 mb-6">
                            <Trophy size={40} />
                        </div>
                        <h3 className="text-white text-2xl font-bold mb-2">{t('tournaments.noTournaments')}</h3>
                        <p className="text-gray-500 max-w-md">{t('tournaments.noTournamentsDesc')}</p>
                    </div>
                ) : (
                    tournaments.map((tournament) => (
                        <div
                            key={tournament.id}
                            onClick={() => navigate(`/admin/tournaments/${tournament.id}`)}
                            className="glass p-8 rounded-[32px] border-white/5 hover:border-white/20 transition-all cursor-pointer group relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8"
                        >
                            <div className="flex items-center gap-8 w-full md:w-auto">
                                <div className="w-20 h-20 bg-white/5 rounded-[24px] flex items-center justify-center text-white shrink-0 group-hover:bg-tennis-green transition-all group-hover:text-tennis-dark group-hover:scale-110 duration-500">
                                    <Trophy size={32} />
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-3">
                                        <h3 className="text-white text-2xl font-black uppercase tracking-tight">{tournament.name}</h3>
                                        <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${getStatusStyles(tournament.status)}`}>
                                            {t(`tournaments.status.${tournament.status}`)}
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-6">
                                        <div className="flex items-center gap-2 text-gray-500">
                                            <MapPin size={16} className="text-tennis-green" />
                                            <span className="text-sm font-bold">{tournament.location}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-gray-500">
                                            <Calendar size={16} className="text-tennis-green" />
                                            <span className="text-sm font-bold">{tournament.date}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-10 w-full md:w-auto justify-between md:justify-end">
                                <div className="text-right space-y-1">
                                    <p className="text-gray-600 font-bold uppercase text-[9px] tracking-widest">{t('tournaments.entryFee')}</p>
                                    <p className="text-white font-black text-2xl">${tournament.entryFee}</p>
                                </div>
                                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-gray-500 group-hover:bg-white/10 group-hover:text-white transition-all">
                                    <ChevronRight size={24} />
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default TournamentListPage;
