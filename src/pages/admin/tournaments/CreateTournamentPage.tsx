import { ArrowLeft, Calendar, Camera, DollarSign, MapPin, Save, Type, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { useLanguage } from '../../../context/LanguageContext';
import { CATEGORY_ORDER, createTournament } from '../../../services/tournamentService';
import { uploadImage } from '../../../services/imageService';
import type { TournamentCategory } from '../../../services/types';

import imgHard from '../../../assets/tennis_court_hero.png';
import imgClay from '../../../assets/tennis_court_clay.png';
import imgGrass from '../../../assets/tennis_court_grass.png';

const defaultImages = {
    hard: imgHard,
    clay: imgClay,
    grass: imgGrass
};

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
    const [selectedCategories, setSelectedCategories] = useState<TournamentCategory[]>([]);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const displayImage = imagePreview || defaultImages[formData.courtType];

    const toggleCategory = (category: TournamentCategory) => {
        setSelectedCategories(prev =>
            prev.includes(category)
                ? prev.filter(c => c !== category)
                : [...prev, category]
        );
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
        setLoading(true);

        if (selectedCategories.length === 0) {
            alert(t('admin.tournaments.selectCategory'));
            setLoading(false);
            return;
        }

        try {
            let finalImageUrl = null;

            if (imageFile) {
                try {
                    const path = `tournament_images/${Date.now()}_${imageFile.name}`;
                    finalImageUrl = await uploadImage(imageFile, path);
                } catch (uploadErr) {
                    console.error("Upload failed:", uploadErr);
                    alert(t('admin.tournaments.uploadError') || "Failed to upload image. Please check your storage permissions.");
                    setLoading(false);
                    return;
                }
            }

            await createTournament({
                ...formData,
                entryFee: parseFloat(formData.entryFee),
                clubId: managedClubId || undefined,
                categories: selectedCategories,
                image: finalImageUrl || undefined,
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
                    <p className="text-gray-400 font-medium">{t('admin.tournaments.createSubtitle')}</p>
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
                            {!imagePreview && (
                                <div className="px-6 py-2 bg-tennis-dark/80 backdrop-blur-md rounded-full border border-white/10">
                                    <span className="text-white text-xs font-black uppercase tracking-[0.2em]">
                                        {t('admin.tournaments.defaultImage')}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Remove Image Button */}
                    {imagePreview && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                setImageFile(null);
                                setImagePreview(null);
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
                                    placeholder={t('admin.tournaments.phName')}
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
                                        placeholder={t('admin.tournaments.phLocation')}
                                        value={formData.location}
                                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-3 block">{t('admin.tournaments.entryFeeLabel')}</label>
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
                                <label className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-3 block">{t('admin.tournaments.courtSurface')}</label>
                                <select
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-5 text-white text-lg focus:outline-none focus:border-tennis-green/50 appearance-none cursor-pointer"
                                    value={formData.courtType}
                                    onChange={(e) => setFormData({ ...formData, courtType: e.target.value as any })}
                                >
                                    <option value="hard">{t('admin.tournaments.surfaces.hard')}</option>
                                    <option value="clay">{t('admin.tournaments.surfaces.clay')}</option>
                                    <option value="grass">{t('admin.tournaments.surfaces.grass')}</option>
                                </select>
                            </div>
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
                                    className={`px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-widest border transition-all active:scale-[0.95] ${selectedCategories.includes(category)
                                        ? 'bg-tennis-green text-tennis-dark border-tennis-green shadow-lg shadow-tennis-green/20'
                                        : 'bg-white/5 text-gray-400 border-white/10 hover:border-white/20'
                                        }`}
                                >
                                    {t(`admin.tournaments.categories.${category}`)}
                                </button>
                            ))}
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
                                {t('admin.tournaments.launchButton')}
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default CreateTournamentPage;
