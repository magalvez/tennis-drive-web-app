import {
    ArrowLeft,
    Calendar,
    Camera,
    DollarSign,
    MapPin,
    Save,
    Trash2,
    Trophy,
    RefreshCw,
    X
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLanguage } from '../../../context/LanguageContext';
import { CATEGORY_ORDER, getTournamentById, updateTournament } from '../../../services/tournamentService';
import { uploadImage } from '../../../services/imageService';
import type { TournamentCategory, TournamentData } from '../../../services/types';

import imgHard from '../../../assets/tennis_court_hero.png';
import imgClay from '../../../assets/tennis_court_clay.png';
import imgGrass from '../../../assets/tennis_court_grass.png';

const defaultImages = {
    hard: imgHard,
    clay: imgClay,
    grass: imgGrass
};

const EditTournamentPage = () => {
    const { id } = useParams<{ id: string }>();
    const { t } = useLanguage();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState<Partial<TournamentData>>({
        courtType: 'hard',
        categories: []
    });

    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const displayImage = imagePreview || formData.image || (formData.courtType ? defaultImages[formData.courtType] : defaultImages.hard);

    useEffect(() => {
        const loadTournament = async () => {
            if (!id) return;
            try {
                const data = await getTournamentById(id);
                if (data) {
                    setFormData({
                        ...data,
                        courtType: data.courtType || 'hard',
                        categories: data.categories || []
                    });
                }
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };
        loadTournament();
    }, [id]);

    const toggleCategory = (category: TournamentCategory) => {
        const current = formData.categories || [];
        const updated = current.includes(category)
            ? current.filter(c => c !== category)
            : [...current, category];
        setFormData({ ...formData, categories: updated });
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id) return;

        if (!formData.categories || formData.categories.length === 0) {
            alert(t('admin.tournaments.selectCategory'));
            return;
        }

        setSaving(true);
        try {
            let finalImageUrl = formData.image;

            if (imageFile) {
                try {
                    const path = `tournament_images/${Date.now()}_${imageFile.name}`;
                    finalImageUrl = await uploadImage(imageFile, path);
                } catch (uploadErr) {
                    console.error("Upload failed:", uploadErr);
                    alert(t('admin.tournaments.uploadError') || "Failed to upload image. Please check your storage permissions.");
                    setSaving(false);
                    return;
                }
            }

            await updateTournament(id, {
                ...formData,
                image: finalImageUrl !== undefined ? finalImageUrl : null
            });
            navigate(`/admin/tournaments/${id}`);
        } catch (error) {
            console.error(error);
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
                    <h1 className="text-white text-3xl font-black uppercase tracking-tight">{t('admin.tournaments.edit.title')}</h1>
                    <p className="text-gray-500 font-bold uppercase text-xs tracking-widest mt-1">{t('admin.tournaments.edit.subtitle')}</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
                {/* Image Cover */}
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleImageChange}
                />
                <div
                    className="relative group cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                >
                    <div className="w-full h-64 rounded-[40px] overflow-hidden relative border border-white/10 shadow-2xl bg-black/20">
                        <img
                            src={displayImage}
                            alt="Cover"
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        />
                        <div className="absolute inset-0 bg-black/40 group-hover:bg-black/50 transition-colors flex flex-col items-center justify-center gap-4">
                            <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/20 group-hover:scale-110 transition-transform">
                                <Camera size={32} />
                            </div>
                            {(!imagePreview && !formData.image) && (
                                <div className="px-6 py-2 bg-tennis-dark/80 backdrop-blur-md rounded-full border border-white/10">
                                    <span className="text-white text-xs font-black uppercase tracking-[0.2em]">
                                        {t('admin.tournaments.defaultImage')}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Remove Image Button */}
                    {(imagePreview || formData.image) && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                setImageFile(null);
                                setImagePreview(null);
                                setFormData({ ...formData, image: null });
                                if (fileInputRef.current) fileInputRef.current.value = '';
                            }}
                            className="absolute top-4 right-4 w-10 h-10 bg-red-500 text-white rounded-full flex items-center justify-center shadow-xl hover:bg-red-600 transition-all z-10"
                        >
                            <X size={20} />
                        </button>
                    )}

                    <p className="text-center mt-4 text-gray-500 text-xs font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                        {t('admin.tournaments.tapToChange')}
                    </p>
                </div>

                <div className="glass p-10 rounded-[40px] border-white/5 space-y-8">
                    {/* Basic Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-3">
                            <label className="text-gray-500 text-[10px] font-black uppercase tracking-widest ml-1">{t('admin.tournaments.edit.name')}</label>
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
                            <label className="text-gray-500 text-[10px] font-black uppercase tracking-widest ml-1">{t('admin.tournaments.edit.location')}</label>
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
                            <label className="text-gray-500 text-[10px] font-black uppercase tracking-widest ml-1">{t('admin.tournaments.edit.date')}</label>
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
                            <label className="text-gray-500 text-[10px] font-black uppercase tracking-widest ml-1">{t('admin.tournaments.edit.fee')}</label>
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

                    {/* Surface & Status */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-3">
                            <label className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-3 block">{t('admin.tournaments.courtSurface')}</label>
                            <select
                                className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-5 text-white text-lg focus:outline-none focus:border-tennis-green/50 appearance-none cursor-pointer font-bold"
                                value={formData.courtType}
                                onChange={(e) => setFormData({ ...formData, courtType: e.target.value as any })}
                            >
                                <option value="hard">{t('admin.tournaments.surfaces.hard')}</option>
                                <option value="clay">{t('admin.tournaments.surfaces.clay')}</option>
                                <option value="grass">{t('admin.tournaments.surfaces.grass')}</option>
                            </select>
                        </div>
                        <div className="space-y-3">
                            <label className="text-gray-500 text-[10px] font-black uppercase tracking-widest ml-1">{t('admin.tournaments.edit.status')}</label>
                            <select
                                className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-5 text-white text-lg focus:outline-none focus:border-tennis-green/50 appearance-none cursor-pointer font-bold"
                                value={formData.status}
                                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                            >
                                {['upcoming', 'active', 'completed'].map(status => (
                                    <option key={status} value={status}>
                                        {t(`tournaments.status.${status}`)}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Categories */}
                    <div className="pt-4 space-y-6">
                        <div>
                            <h3 className="text-white text-xl font-bold uppercase tracking-tight">{t('admin.tournaments.categories.title')}</h3>
                            <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mt-1">{t('admin.tournaments.categories.subtitle')}</p>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            {CATEGORY_ORDER.map((category) => (
                                <button
                                    key={category}
                                    type="button"
                                    onClick={() => toggleCategory(category)}
                                    className={`px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all active:scale-[0.95] ${formData.categories?.includes(category)
                                        ? 'bg-tennis-green text-tennis-dark border-tennis-green shadow-lg shadow-tennis-green/20'
                                        : 'bg-white/5 text-gray-500 border-white/10 hover:border-white/20'
                                        }`}
                                >
                                    {t(`admin.tournaments.categories.${category}`)}
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
                        {t('admin.tournaments.edit.save')}
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



export default EditTournamentPage;
