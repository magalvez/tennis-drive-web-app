import {
    ArrowLeft,
    Calendar,
    DollarSign,
    MapPin,
    Save,
    Trash2,
    Trophy
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLanguage } from '../../../context/LanguageContext';
import { getTournamentById, updateTournament } from '../../../services/tournamentService';
import type { TournamentData } from '../../../services/types';

const EditTournamentPage = () => {
    const { id } = useParams<{ id: string }>();
    const { t } = useLanguage();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState<Partial<TournamentData>>({});

    useEffect(() => {
        const loadTournament = async () => {
            if (!id) return;
            try {
                const data = await getTournamentById(id);
                if (data) setFormData(data);
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };
        loadTournament();
    }, [id]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id) return;
        setSaving(true);
        try {
            await updateTournament(id, formData);
            navigate(`/admin/tournaments/${id}`);
        } catch (error) {
            alert(t('common.error'));
        } finally {
            setSaving(false);
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-tennis-green"></div>
        </div>
    );

    return (
        <div className="max-w-4xl mx-auto space-y-10 animate-fade-in pb-20">
            <div className="flex items-center gap-4">
                <button
                    onClick={() => navigate(-1)}
                    className="w-12 h-12 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center text-white transition-all underline-none"
                >
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-white text-3xl font-black uppercase tracking-tight">Edit Tournament</h1>
                    <p className="text-gray-500 font-bold uppercase text-xs tracking-widest mt-1">Refine Event Details</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
                <div className="glass p-10 rounded-[40px] border-white/5 space-y-8">
                    {/* Basic Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-3">
                            <label className="text-gray-500 text-[10px] font-black uppercase tracking-widest ml-1">Tournament Name</label>
                            <div className="relative">
                                <Trophy className="absolute left-5 top-5 text-gray-600" size={20} />
                                <input
                                    required
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 pl-14 text-white font-bold focus:outline-none focus:border-tennis-green/30 transition-all"
                                    value={formData.name || ''}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="space-y-3">
                            <label className="text-gray-500 text-[10px] font-black uppercase tracking-widest ml-1">Location</label>
                            <div className="relative">
                                <MapPin className="absolute left-5 top-5 text-gray-600" size={20} />
                                <input
                                    required
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 pl-14 text-white font-bold focus:outline-none focus:border-tennis-green/30 transition-all"
                                    value={formData.location || ''}
                                    onChange={e => setFormData({ ...formData, location: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Dates & Entry */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-3">
                            <label className="text-gray-500 text-[10px] font-black uppercase tracking-widest ml-1">Start Date</label>
                            <div className="relative">
                                <Calendar className="absolute left-5 top-5 text-gray-600" size={20} />
                                <input
                                    type="date"
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 pl-14 text-white font-bold focus:outline-none focus:border-tennis-green/30 transition-all"
                                    value={formData.date || ''}
                                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="space-y-3">
                            <label className="text-gray-500 text-[10px] font-black uppercase tracking-widest ml-1">Entry Fee ($)</label>
                            <div className="relative">
                                <DollarSign className="absolute left-5 top-5 text-gray-600" size={20} />
                                <input
                                    type="number"
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 pl-14 text-white font-bold focus:outline-none focus:border-tennis-green/30 transition-all"
                                    value={formData.entryFee || ''}
                                    onChange={e => setFormData({ ...formData, entryFee: Number(e.target.value) })}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Status */}
                    <div className="space-y-3">
                        <label className="text-gray-500 text-[10px] font-black uppercase tracking-widest ml-1">Event Status</label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            {['upcoming', 'active', 'completed', 'cancelled'].map(status => (
                                <button
                                    key={status}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, status: status as any })}
                                    className={`py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${formData.status === status ? 'bg-tennis-green text-tennis-dark border-tennis-green' : 'bg-white/5 text-gray-500 border-white/10 hover:border-white/20'}`}
                                >
                                    {status}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex gap-4">
                    <button
                        type="submit"
                        disabled={saving}
                        className="flex-1 bg-tennis-green hover:bg-tennis-green/90 text-tennis-dark py-6 rounded-3xl font-black uppercase tracking-widest shadow-2xl shadow-tennis-green/20 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                    >
                        {saving ? <RefreshCw className="animate-spin" /> : <Save size={24} />}
                        Save Changes
                    </button>
                    {/* Placeholder for Delete */}
                    <button
                        type="button"
                        className="px-8 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-3xl border border-red-500/10 transition-all flex items-center justify-center"
                        onClick={() => alert("Deletion is a restricted operation. Please contact system owner.")}
                    >
                        <Trash2 size={24} />
                    </button>
                </div>
            </form>
        </div>
    );
};

const RefreshCw = ({ className }: { className?: string }) => (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
    </svg>
);

export default EditTournamentPage;
