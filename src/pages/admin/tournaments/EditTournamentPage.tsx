import {
    ArrowLeft,
    Calendar,
    Camera,
    DollarSign,
    MapPin,
    Save,
    Trash2,
    Trophy,
    X,
    AlertTriangle,
    Info,
    Banknote,
    Building2,
    CreditCard
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLanguage } from '../../../context/LanguageContext';
import { TENNIS_CATEGORY_ORDER, PADEL_CATEGORY_ORDER, getTournamentById, updateTournament, deleteTournament } from '../../../services/tournamentService';
import { uploadImage } from '../../../services/imageService';
import type { TournamentCategory, ModalityConfig } from '../../../services/types';

import imgHard from '../../../assets/tennis_court_hero.png';
import imgClay from '../../../assets/tennis_court_clay.png';
import imgGrass from '../../../assets/tennis_court_grass.png';
import imgPadelIndoor from '../../../assets/padel_indoor.png';
import imgPadelOutdoor from '../../../assets/padel_outdoor.png';
import imgPadelGlass from '../../../assets/padel_glass.png';
import imgPadelWall from '../../../assets/padel_wall.png';

const defaultImages = {
    hard: imgHard,
    clay: imgClay,
    grass: imgGrass,
    indoor: imgPadelIndoor,
    outdoor: imgPadelOutdoor,
    glass: imgPadelGlass,
    wall: imgPadelWall
};

const GATEWAY_METHODS = [
    { id: 'TDC', label: 'admin.tournaments.paymentMethods.creditDebit' },
    { id: 'PSE', label: 'admin.tournaments.paymentMethods.pse' },
    { id: 'DP', label: 'admin.tournaments.paymentMethods.daviplata' },
    { id: 'CASH', label: 'admin.tournaments.paymentMethods.cashPoints' },
    { id: 'SP', label: 'admin.tournaments.paymentMethods.safetypay' }
];

const EditTournamentPage = () => {
    const { id } = useParams<{ id: string }>();
    const { t } = useLanguage();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    // Form State
    const [name, setName] = useState('');
    const [sport, setSport] = useState<'tennis' | 'padel' | 'pickleball'>('tennis');
    const [date, setDate] = useState('');
    const [location, setLocation] = useState('');
    const [entryFee, setEntryFee] = useState('0');
    const [courtType, setCourtType] = useState<string>('hard');
    const [description, setDescription] = useState('');
    const [status, setStatus] = useState<'upcoming' | 'active' | 'completed'>('upcoming');
    const [isChatEnabled, setIsChatEnabled] = useState(true);
    const [scoringConfig, setScoringConfig] = useState({ win: 3, loss: 0, withdraw: 0 });

    // Modalities & Categories
    const [selectedModalities, setSelectedModalities] = useState<('singles' | 'doubles')[]>(['singles']);
    const [singlesCategories, setSinglesCategories] = useState<TournamentCategory[]>([]);
    const [doublesCategories, setDoublesCategories] = useState<TournamentCategory[]>([]);

    // Payment Config
    const [cashEnabled, setCashEnabled] = useState(true);
    const [wireTransferEnabled, setWireTransferEnabled] = useState(false);
    const [gatewayEnabled, setGatewayEnabled] = useState(true);
    const [disabledGatewayMethods, setDisabledGatewayMethods] = useState<string[]>([]);

    // Image State
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const displayImage = imagePreview || existingImageUrl || (courtType ? (defaultImages as any)[courtType] : defaultImages.hard);

    useEffect(() => {
        const loadTournament = async () => {
            if (!id) return;
            try {
                const data = await getTournamentById(id);
                if (data) {
                    setName(data.name || '');
                    setSport(data.sport || 'tennis');
                    setDate(data.date || '');
                    setLocation(data.location || '');
                    setEntryFee(String(data.entryFee || '0'));
                    setCourtType(data.courtType || 'hard');
                    setDescription(data.description || '');
                    setStatus(data.status || 'upcoming');
                    setExistingImageUrl(data.image || null);

                    // Modality Mapping
                    const mods: ('singles' | 'doubles')[] = [];
                    if (data.modalityConfig?.singles || data.modalities?.singles) {
                        mods.push('singles');
                        setSinglesCategories(data.modalityConfig?.singles?.categories || data.categories || []);
                    }
                    if (data.modalityConfig?.doubles || data.modalities?.doubles) {
                        mods.push('doubles');
                        setDoublesCategories(data.modalityConfig?.doubles?.categories || []);
                    }
                    setSelectedModalities(mods.length > 0 ? mods : ['singles']);

                    // Payment Mapping
                    if (data.paymentMethods) {
                        setCashEnabled(data.paymentMethods.cash !== false);
                        setWireTransferEnabled(!!data.paymentMethods.wireTransfer);
                        setGatewayEnabled(data.paymentMethods.gateway !== false);
                    }
                    if (data.gatewayConfig) setDisabledGatewayMethods(data.gatewayConfig.disabledMethods || []);
                    setIsChatEnabled(data.isChatEnabled !== false);
                    if (data.scoringConfig) {
                        setScoringConfig(data.scoringConfig);
                    }
                }
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };
        loadTournament();
    }, [id]);

    const toggleModality = (modality: 'singles' | 'doubles') => {
        setSelectedModalities(prev => {
            if (prev.includes(modality)) {
                if (prev.length === 1) return prev;
                return prev.filter(m => m !== modality);
            }
            return [...prev, modality];
        });
    };

    const toggleSinglesCategory = (category: TournamentCategory) => {
        setSinglesCategories(prev =>
            prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]
        );
    };

    const toggleDoublesCategory = (category: TournamentCategory) => {
        setDoublesCategories(prev =>
            prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]
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

    const handleDelete = async () => {
        if (!id) return;
        setDeleting(true);
        try {
            await deleteTournament(id);
            navigate('/admin/tournaments');
        } catch (error) {
            console.error('Error deleting tournament', error);
            alert(t('admin.tournaments.deleteError'));
        } finally {
            setDeleting(false);
            setShowDeleteModal(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id) return;

        if (selectedModalities.includes('singles') && singlesCategories.length === 0) {
            alert(t('admin.tournaments.selectSinglesCategory'));
            return;
        }
        if (selectedModalities.includes('doubles') && doublesCategories.length === 0) {
            alert(t('admin.tournaments.selectDoublesCategory'));
            return;
        }

        setSaving(true);
        try {
            let finalImageUrl = existingImageUrl;

            if (imageFile) {
                try {
                    const path = `tournament_images/${Date.now()}_${imageFile.name}`;
                    finalImageUrl = await uploadImage(imageFile, path);
                } catch (uploadErr) {
                    console.error("Upload failed:", uploadErr);
                    alert(t('admin.tournaments.uploadError') || "Failed to upload image.");
                    setSaving(false);
                    return;
                }
            }

            const modalityConfig: ModalityConfig = {};
            if (selectedModalities.includes('singles')) {
                modalityConfig.singles = { categories: singlesCategories };
            }
            if (selectedModalities.includes('doubles')) {
                modalityConfig.doubles = { categories: doublesCategories };
            }

            await updateTournament(id, {
                name,
                sport,
                date,
                location,
                entryFee: parseFloat(entryFee),
                courtType: courtType as any,
                description: description.trim() || undefined,
                status,
                modalityConfig,
                paymentMethods: {
                    cash: cashEnabled,
                    wireTransfer: wireTransferEnabled,
                    gateway: gatewayEnabled
                },
                gatewayConfig: gatewayEnabled ? {
                    disabledMethods: disabledGatewayMethods
                } : undefined,
                image: finalImageUrl !== undefined ? finalImageUrl : null,
                isChatEnabled,
                scoringConfig
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
        <div className="max-w-6xl mx-auto space-y-10 animate-fade-in pb-20">
            {/* Header */}
            <div className="flex items-center gap-6">
                <button
                    onClick={() => navigate(-1)}
                    className="w-14 h-14 bg-white/5 hover:bg-white/10 rounded-2xl flex items-center justify-center text-white transition-all group"
                >
                    <ArrowLeft size={24} className="group-hover:-translate-x-1 transition-transform" />
                </button>
                <div>
                    <h1 className="text-white text-4xl font-black uppercase tracking-tight">{t('admin.tournaments.edit.title')}</h1>
                    <p className="text-gray-500 font-bold uppercase text-xs tracking-widest mt-1">{t('admin.tournaments.edit.subtitle')}</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-10">

                {/* Left Column: Media & Primary Details */}
                <div className="lg:col-span-2 space-y-10">

                    {/* Image Cover */}
                    <div className="glass p-2 rounded-[40px] overflow-hidden border-white/5 relative group">
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept="image/*"
                            onChange={handleImageChange}
                        />
                        <div
                            className="w-full h-80 rounded-[38px] overflow-hidden relative cursor-pointer"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <img
                                src={displayImage}
                                alt="Cover"
                                className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-all flex flex-col items-center justify-center gap-4 opacity-0 group-hover:opacity-100">
                                <div className="w-20 h-20 bg-white/10 backdrop-blur-xl rounded-full flex items-center justify-center text-white border border-white/20 shadow-2xl">
                                    <Camera size={32} />
                                </div>
                                <span className="text-white text-xs font-black uppercase tracking-widest">{t('admin.tournaments.tapToChange')}</span>
                            </div>

                            {(!imagePreview && !existingImageUrl) && (
                                <div className="absolute bottom-8 left-8 px-6 py-2 bg-tennis-dark/80 backdrop-blur-md rounded-full border border-white/10">
                                    <span className="text-white text-[10px] font-black uppercase tracking-[0.2em]">{t('admin.tournaments.defaultImage')}</span>
                                </div>
                            )}
                        </div>

                        {(imagePreview || existingImageUrl) && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setImageFile(null);
                                    setImagePreview(null);
                                    setExistingImageUrl(null);
                                }}
                                className="absolute top-8 right-8 w-12 h-12 bg-red-500 text-white rounded-2xl flex items-center justify-center shadow-2xl hover:bg-red-600 transition-all z-10"
                            >
                                <X size={24} />
                            </button>
                        )}
                    </div>

                    {/* Main Settings Card */}
                    <div className="glass p-10 rounded-[40px] border-white/5 space-y-10">
                        <div className="flex items-center gap-4 border-b border-white/5 pb-8">
                            <div className="w-12 h-12 bg-tennis-green/10 rounded-2xl flex items-center justify-center text-tennis-green">
                                <Info size={24} />
                            </div>
                            <h2 className="text-white text-2xl font-black uppercase tracking-tight">{t('admin.tournaments.details')}</h2>
                        </div>

                        <div className="space-y-8">
                            {/* Sport Selection */}
                            <div className="space-y-4">
                                <label className="text-gray-500 text-[10px] font-black uppercase tracking-widest ml-1">{t('admin.tournaments.sport')}</label>
                                <div className="flex gap-4">
                                    {(['tennis', 'padel', 'pickleball'] as const).map((s) => (
                                        <button
                                            key={s}
                                            type="button"
                                            onClick={() => {
                                                setSport(s);
                                                setCourtType(s === 'tennis' ? 'hard' : 'indoor');
                                            }}
                                            className={`flex-1 py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] border transition-all ${sport === s ? 'bg-tennis-green text-tennis-dark border-tennis-green' : 'bg-white/5 text-gray-400 border-white/5 hover:border-white/10'}`}
                                        >
                                            {t(`admin.tournaments.sports.${s}`)}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4 md:col-span-2">
                                    <label className="text-gray-500 text-[10px] font-black uppercase tracking-widest ml-1">{t('admin.tournaments.edit.name')}</label>
                                    <div className="relative group">
                                        <Trophy className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-tennis-green transition-colors" size={20} />
                                        <input
                                            type="text"
                                            required
                                            className="w-full bg-white/5 border border-white/5 rounded-2xl pl-16 pr-6 py-5 text-white text-xl font-bold focus:outline-none focus:border-tennis-green/20 transition-all"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <label className="text-gray-500 text-[10px] font-black uppercase tracking-widest ml-1">{t('admin.tournaments.edit.date')}</label>
                                    <div className="relative group">
                                        <Calendar className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-tennis-green transition-colors" size={20} />
                                        <input
                                            type="date"
                                            required
                                            className="w-full bg-white/5 border border-white/5 rounded-2xl pl-16 pr-6 py-5 text-white font-bold focus:outline-none focus:border-tennis-green/20 transition-all"
                                            value={date}
                                            onChange={(e) => setDate(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <label className="text-gray-500 text-[10px] font-black uppercase tracking-widest ml-1">{t('admin.tournaments.edit.location')}</label>
                                    <div className="relative group">
                                        <MapPin className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-tennis-green transition-colors" size={20} />
                                        <input
                                            type="text"
                                            required
                                            className="w-full bg-white/5 border border-white/5 rounded-2xl pl-16 pr-6 py-5 text-white font-bold focus:outline-none focus:border-tennis-green/20 transition-all"
                                            value={location}
                                            onChange={(e) => setLocation(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <label className="text-gray-500 text-[10px] font-black uppercase tracking-widest ml-1">{t('admin.tournaments.edit.fee')}</label>
                                    <div className="relative group">
                                        <DollarSign className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-tennis-green transition-colors" size={20} />
                                        <input
                                            type="number"
                                            required
                                            className="w-full bg-white/5 border border-white/5 rounded-2xl pl-16 pr-6 py-5 text-white text-2xl font-black focus:outline-none focus:border-tennis-green/20 transition-all"
                                            value={entryFee}
                                            onChange={(e) => setEntryFee(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <label className="text-gray-500 text-[10px] font-black uppercase tracking-widest ml-1">{t('admin.tournaments.courtSurface')}</label>
                                    <select
                                        className="w-full bg-white/5 border border-white/5 rounded-2xl px-6 py-5 text-white font-bold focus:outline-none focus:border-tennis-green/20 transition-all appearance-none cursor-pointer"
                                        value={courtType}
                                        onChange={(e) => setCourtType(e.target.value)}
                                    >
                                        {sport === 'tennis' ? (
                                            <>
                                                <option value="hard">{t('admin.tournaments.courtTypes.hard')}</option>
                                                <option value="clay">{t('admin.tournaments.courtTypes.clay')}</option>
                                                <option value="grass">{t('admin.tournaments.courtTypes.grass')}</option>
                                            </>
                                        ) : sport === 'padel' ? (
                                            <>
                                                <option value="indoor">{t('admin.tournaments.surfaces.indoor')}</option>
                                                <option value="outdoor">{t('admin.tournaments.surfaces.outdoor')}</option>
                                                <option value="glass">{t('admin.tournaments.surfaces.glass')}</option>
                                                <option value="wall">{t('admin.tournaments.surfaces.wall')}</option>
                                            </>
                                        ) : (
                                            <>
                                                <option value="indoor">{t('admin.tournaments.surfaces.indoor')}</option>
                                                <option value="outdoor">{t('admin.tournaments.surfaces.outdoor')}</option>
                                            </>
                                        )}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <label className="text-gray-500 text-[10px] font-black uppercase tracking-widest ml-1">{t('admin.tournaments.edit.status')}</label>
                                    <select
                                        className="w-full bg-white/5 border border-white/5 rounded-2xl px-6 py-5 text-white font-bold focus:outline-none focus:border-tennis-green/20 transition-all appearance-none cursor-pointer"
                                        value={status}
                                        onChange={(e) => setStatus(e.target.value as any)}
                                    >
                                        {['upcoming', 'active', 'completed'].map(s => (
                                            <option key={s} value={s}>{t(`tournaments.status.${s}`)}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-4">
                                    <label className="text-gray-500 text-[10px] font-black uppercase tracking-widest ml-1">{t('admin.tournaments.chat.title')}</label>
                                    <button
                                        type="button"
                                        onClick={() => setIsChatEnabled(!isChatEnabled)}
                                        className={`w-full py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] border transition-all ${isChatEnabled ? 'bg-blue-500 text-white border-blue-500' : 'bg-white/5 text-gray-400 border-white/5'}`}
                                    >
                                        {isChatEnabled ? t('admin.tournaments.chat.enableLobby') : t('common.disabled')}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <label className="text-gray-500 text-[10px] font-black uppercase tracking-widest ml-1">{t('admin.tournaments.description')}</label>
                                <textarea
                                    className="w-full bg-white/5 border border-white/5 rounded-2xl px-6 py-5 text-white font-medium focus:outline-none focus:border-tennis-green/20 transition-all min-h-[160px] resize-none"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Scoring Settings Card */}
                    <div className="glass p-10 rounded-[40px] border-white/5 space-y-10">
                        <div className="flex items-center gap-4 border-b border-white/5 pb-8">
                            <div className="w-12 h-12 bg-yellow-500/10 rounded-2xl flex items-center justify-center text-yellow-500">
                                <Trophy size={24} />
                            </div>
                            <div>
                                <h2 className="text-white text-2xl font-black uppercase tracking-tight">{t('admin.tournaments.scoring.title')}</h2>
                                <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mt-1">{t('admin.tournaments.scoring.subtitle')}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            <div className="space-y-4">
                                <label className="text-gray-500 text-[10px] font-black uppercase tracking-widest ml-1">{t('admin.tournaments.scoring.win')}</label>
                                <input
                                    type="number"
                                    className="w-full bg-white/5 border border-white/5 rounded-2xl px-6 py-5 text-white text-xl font-bold focus:outline-none focus:border-tennis-green/20 transition-all"
                                    value={scoringConfig.win}
                                    onChange={(e) => setScoringConfig({ ...scoringConfig, win: parseInt(e.target.value) || 0 })}
                                />
                            </div>
                            <div className="space-y-4">
                                <label className="text-gray-500 text-[10px] font-black uppercase tracking-widest ml-1">{t('admin.tournaments.scoring.loss')}</label>
                                <input
                                    type="number"
                                    className="w-full bg-white/5 border border-white/5 rounded-2xl px-6 py-5 text-white text-xl font-bold focus:outline-none focus:border-tennis-green/20 transition-all"
                                    value={scoringConfig.loss}
                                    onChange={(e) => setScoringConfig({ ...scoringConfig, loss: parseInt(e.target.value) || 0 })}
                                />
                            </div>
                            <div className="space-y-4">
                                <label className="text-gray-500 text-[10px] font-black uppercase tracking-widest ml-1">{t('admin.tournaments.scoring.withdraw')}</label>
                                <input
                                    type="number"
                                    className="w-full bg-white/5 border border-white/5 rounded-2xl px-6 py-5 text-white text-xl font-bold focus:outline-none focus:border-tennis-green/20 transition-all"
                                    value={scoringConfig.withdraw}
                                    onChange={(e) => setScoringConfig({ ...scoringConfig, withdraw: parseInt(e.target.value) || 0 })}
                                />
                            </div>
                        </div>
                        <div className="flex items-start gap-4 p-6 bg-white/5 rounded-3xl border border-white/5">
                            <Info className="text-blue-400 shrink-0" size={20} />
                            <p className="text-gray-400 text-xs font-medium leading-relaxed">{t('admin.tournaments.scoring.info')}</p>
                        </div>
                    </div>
                </div>

                {/* Right Column: Modality & Payments */}
                <div className="space-y-10">

                    {/* Modality Card */}
                    <div className="glass p-10 rounded-[40px] border-white/5 space-y-10">
                        <div className="space-y-2">
                            <h3 className="text-white text-xl font-black uppercase tracking-tight">{t('admin.tournaments.modalities.title')}</h3>
                            <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">{t('admin.tournaments.modalities.subtitle')}</p>
                        </div>

                        <div className="space-y-8">
                            {/* Modality Toggles */}
                            <div className="flex gap-4">
                                {(['singles', 'doubles'] as const).map((m) => (
                                    <button
                                        key={m}
                                        type="button"
                                        onClick={() => toggleModality(m)}
                                        className={`flex-1 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] border transition-all ${selectedModalities.includes(m) ? 'bg-tennis-green text-tennis-dark border-tennis-green' : 'bg-white/5 text-gray-400 border-white/5 hover:border-white/10'}`}
                                    >
                                        {t(`admin.tournaments.modalities.types.${m}`)}
                                    </button>
                                ))}
                            </div>

                            {/* Singles Categories */}
                            {selectedModalities.includes('singles') && (
                                <div className="space-y-4">
                                    <label className="text-gray-500 text-[10px] font-black uppercase tracking-widest ml-1">{t('admin.tournaments.singlesCategories')}</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {(sport === 'tennis' ? TENNIS_CATEGORY_ORDER : PADEL_CATEGORY_ORDER).map((cat) => (
                                            <button
                                                key={cat}
                                                type="button"
                                                onClick={() => toggleSinglesCategory(cat)}
                                                className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${singlesCategories.includes(cat) ? 'bg-white text-tennis-dark border-white' : 'bg-white/5 text-gray-500 border-white/5'}`}
                                            >
                                                {t(`admin.tournaments.categories.${cat}`)}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Doubles Categories */}
                            {selectedModalities.includes('doubles') && (
                                <div className="space-y-4">
                                    <label className="text-gray-500 text-[10px] font-black uppercase tracking-widest ml-1">{t('admin.tournaments.doublesCategories')}</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {(sport === 'tennis' ? TENNIS_CATEGORY_ORDER : PADEL_CATEGORY_ORDER).map((cat) => (
                                            <button
                                                key={cat}
                                                type="button"
                                                onClick={() => toggleDoublesCategory(cat)}
                                                className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${doublesCategories.includes(cat) ? 'bg-white text-tennis-dark border-white' : 'bg-white/5 text-gray-500 border-white/5'}`}
                                            >
                                                {t(`admin.tournaments.categories.${cat}`)}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Payment Settings Card */}
                    <div className="glass p-10 rounded-[40px] border-white/5 space-y-10">
                        <div className="space-y-2">
                            <h3 className="text-white text-xl font-black uppercase tracking-tight">{t('admin.tournaments.paymentMethods.title')}</h3>
                            <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">{t('admin.tournaments.paymentMethods.subtitle')}</p>
                        </div>

                        <div className="space-y-4">
                            <button
                                type="button"
                                onClick={() => setCashEnabled(!cashEnabled)}
                                className={`w-full p-5 rounded-2xl border flex items-center justify-between transition-all ${cashEnabled ? 'bg-tennis-green/10 border-tennis-green' : 'bg-white/2 border-white/5'}`}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${cashEnabled ? 'bg-tennis-green text-tennis-dark' : 'bg-white/5 text-gray-500'}`}>
                                        <Banknote size={20} />
                                    </div>
                                    <span className={`font-black uppercase text-xs tracking-widest ${cashEnabled ? 'text-white' : 'text-gray-500'}`}>{t('admin.tournaments.paymentMethods.labels.cash')}</span>
                                </div>
                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${cashEnabled ? 'bg-tennis-green border-tennis-green' : 'border-white/10'}`}>
                                    {cashEnabled && <X size={14} className="text-tennis-dark rotate-45" />}
                                </div>
                            </button>

                            <button
                                type="button"
                                onClick={() => setWireTransferEnabled(!wireTransferEnabled)}
                                className={`w-full p-5 rounded-2xl border flex items-center justify-between transition-all ${wireTransferEnabled ? 'bg-tennis-green/10 border-tennis-green' : 'bg-white/2 border-white/5'}`}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${wireTransferEnabled ? 'bg-tennis-green text-tennis-dark' : 'bg-white/5 text-gray-500'}`}>
                                        <Building2 size={20} />
                                    </div>
                                    <span className={`font-black uppercase text-xs tracking-widest ${wireTransferEnabled ? 'text-white' : 'text-gray-500'}`}>{t('admin.tournaments.paymentMethods.labels.wireTransfer')}</span>
                                </div>
                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${wireTransferEnabled ? 'bg-tennis-green border-tennis-green' : 'border-white/10'}`}>
                                    {wireTransferEnabled && <X size={14} className="text-tennis-dark rotate-45" />}
                                </div>
                            </button>

                            <button
                                type="button"
                                onClick={() => setGatewayEnabled(!gatewayEnabled)}
                                className={`w-full p-5 rounded-2xl border flex items-center justify-between transition-all ${gatewayEnabled ? 'bg-tennis-green/10 border-tennis-green' : 'bg-white/2 border-white/5'}`}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${gatewayEnabled ? 'bg-tennis-green text-tennis-dark' : 'bg-white/5 text-gray-500'}`}>
                                        <CreditCard size={20} />
                                    </div>
                                    <span className={`font-black uppercase text-xs tracking-widest ${gatewayEnabled ? 'text-white' : 'text-gray-500'}`}>{t('admin.tournaments.paymentMethods.labels.gateway')}</span>
                                </div>
                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${gatewayEnabled ? 'bg-tennis-green border-tennis-green' : 'border-white/10'}`}>
                                    {gatewayEnabled && <X size={14} className="text-tennis-dark rotate-45" />}
                                </div>
                            </button>

                            {/* Gateway Details */}
                            {gatewayEnabled && (
                                <div className="p-8 bg-white/5 rounded-3xl space-y-6 mt-2 border border-white/5 animate-fade-in">
                                    <label className="text-gray-500 text-[10px] font-black uppercase tracking-widest">{t('admin.tournaments.paymentMethods.gatewayOptions')}</label>
                                    <div className="space-y-4">
                                        {GATEWAY_METHODS.map((method) => {
                                            const isEnabled = !disabledGatewayMethods.includes(method.id);
                                            return (
                                                <div
                                                    key={method.id}
                                                    onClick={() => {
                                                        setDisabledGatewayMethods(prev =>
                                                            prev.includes(method.id) ? prev.filter(m => m !== method.id) : [...prev, method.id]
                                                        );
                                                    }}
                                                    className="flex items-center justify-between cursor-pointer group"
                                                >
                                                    <span className={`text-xs font-bold ${isEnabled ? 'text-white' : 'text-gray-600'} transition-colors`}>{t(method.label)}</span>
                                                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${isEnabled ? 'bg-tennis-green border-tennis-green' : 'bg-white/5 border-white/10 group-hover:border-white/20'}`}>
                                                        {isEnabled && <X size={12} className="text-tennis-dark rotate-45" />}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <p className="text-[10px] text-gray-600 font-medium italic mt-4">{t('admin.tournaments.paymentMethods.disclaimer')}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex-1 bg-tennis-green hover:bg-tennis-green/90 text-tennis-dark py-6 rounded-3xl font-black uppercase tracking-widest shadow-2xl shadow-tennis-green/20 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-4"
                        >
                            {saving ? <RefreshCw className="animate-spin" /> : <Save size={24} />}
                            {t('admin.tournaments.edit.save')}
                        </button>
                        <button
                            type="button"
                            className="px-8 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-3xl border border-red-500/10 transition-all flex items-center justify-center"
                            onClick={() => setShowDeleteModal(true)}
                        >
                            <Trash2 size={24} />
                        </button>
                    </div>
                </div>
            </form>

            <ConfirmDeleteModal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                onConfirm={handleDelete}
                loading={deleting}
                t={t}
            />
        </div>
    );
};

const ConfirmDeleteModal = ({ isOpen, onClose, onConfirm, loading, t }: any) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-fade-in">
            <div className="glass max-w-md w-full p-8 rounded-[32px] border-white/10 text-center space-y-6 shadow-2xl transform scale-100 transition-all">
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto text-red-500 mb-2">
                    <AlertTriangle size={32} />
                </div>
                <div className="space-y-2">
                    <h3 className="text-white text-2xl font-bold">{t('admin.tournaments.delete')}</h3>
                    <p className="text-gray-400 leading-relaxed">{t('admin.tournaments.deleteConfirm')}</p>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-2">
                    <button onClick={onClose} className="py-4 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-bold transition-colors">{t('common.cancel')}</button>
                    <button onClick={onConfirm} disabled={loading} className="py-4 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-bold transition-colors flex items-center justify-center gap-2">
                        {loading ? <RefreshCw size={20} className="animate-spin" /> : t('admin.tournaments.delete')}
                    </button>
                </div>
            </div>
        </div>
    );
};

const RefreshCw = ({ className, size = 24 }: { className?: string, size?: number }) => (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.85.83 6.72 2.27L21 8" />
        <path d="M21 3v5h-5" />
    </svg>
);

export default EditTournamentPage;
