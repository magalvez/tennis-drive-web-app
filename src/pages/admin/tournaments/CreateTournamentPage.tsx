import { ArrowLeft, Calendar, DollarSign, MapPin, Save, Type } from 'lucide-react';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { useLanguage } from '../../../context/LanguageContext';
import { createTournament } from '../../../services/tournamentService';

const CreateTournamentPage = () => {
    const navigate = useNavigate();
    const { managedClubId } = useAuth();
    const { t } = useLanguage();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        date: '',
        location: '',
        entryFee: '0',
        courtType: 'hard' as 'hard' | 'clay' | 'grass',
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await createTournament({
                ...formData,
                entryFee: parseFloat(formData.entryFee),
                clubId: managedClubId || undefined,
            });
            navigate('/admin/tournaments');
        } catch (error) {
            console.error(error);
            alert(t('common.error'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-10 animate-fade-in max-w-4xl mx-auto">
            <div className="flex items-center gap-4">
                <button
                    onClick={() => navigate('/admin/tournaments')}
                    className="w-12 h-12 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center text-white transition-all"
                >
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-white text-4xl font-extrabold uppercase tracking-tight">{t('admin.tournaments.create')}</h1>
                    <p className="text-gray-400 font-medium">Define the core parameters for your new event.</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
                <div className="glass p-10 rounded-3xl space-y-8">
                    {/* Basic Info */}
                    <div className="space-y-6">
                        <div>
                            <label className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-3 block">{t('admin.tournaments.name')}</label>
                            <div className="relative">
                                <Type className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                                <input
                                    type="text"
                                    required
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl pl-16 pr-6 py-5 text-white text-xl font-bold focus:outline-none focus:border-tennis-green/50 transition-colors"
                                    placeholder="e.g. Grand Slam Winter 2026"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-3 block">{t('admin.tournaments.date')}</label>
                                <div className="relative">
                                    <Calendar className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                                    <input
                                        type="date"
                                        required
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl pl-16 pr-6 py-5 text-white text-lg focus:outline-none focus:border-tennis-green/50 transition-colors"
                                        value={formData.date}
                                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-3 block">{t('admin.tournaments.location')}</label>
                                <div className="relative">
                                    <MapPin className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                                    <input
                                        type="text"
                                        required
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl pl-16 pr-6 py-5 text-white text-lg focus:outline-none focus:border-tennis-green/50 transition-colors"
                                        placeholder="Court / Club Name"
                                        value={formData.location}
                                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-3 block">Entry Fee ($)</label>
                                <div className="relative">
                                    <DollarSign className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                                    <input
                                        type="number"
                                        required
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl pl-16 pr-6 py-5 text-white text-lg font-bold focus:outline-none focus:border-tennis-green/50 transition-colors"
                                        value={formData.entryFee}
                                        onChange={(e) => setFormData({ ...formData, entryFee: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-3 block">Court Surface</label>
                                <select
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-5 text-white text-lg focus:outline-none focus:border-tennis-green/50 transition-colors appearance-none cursor-pointer"
                                    value={formData.courtType}
                                    onChange={(e) => setFormData({ ...formData, courtType: e.target.value as any })}
                                >
                                    <option value="hard">Hard Court</option>
                                    <option value="clay">Clay Court</option>
                                    <option value="grass">Grass Court</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end pt-4">
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex items-center gap-3 bg-tennis-green hover:bg-tennis-green/90 text-tennis-dark px-10 py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-tennis-green/20 transition-all active:scale-[0.98] disabled:opacity-50"
                    >
                        {loading ? <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-tennis-dark"></div> : (
                            <>
                                <Save size={20} />
                                Launch Tournament
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default CreateTournamentPage;
