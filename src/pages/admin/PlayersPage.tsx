import { deleteField } from 'firebase/firestore';
import {
    MessageCircle,
    RefreshCw,
    Save,
    Search,
    ShieldAlert,
    User,
    UserX,
    X
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { getClubPlayers, recalculateClubPoints, updateUser } from '../../services/userService';
import ConfirmModal from '../../components/admin/ConfirmModal';

const PlayersPage = () => {
    const { managedClubId } = useAuth();
    const { t } = useLanguage();
    const [players, setPlayers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [recalculating, setRecalculating] = useState(false);
    const [selectedPlayer, setSelectedPlayer] = useState<any | null>(null);
    const [pointsToAdd, setPointsToAdd] = useState('');
    const [padelPointsToAdd, setPadelPointsToAdd] = useState('');
    const [pickleballPointsToAdd, setPickleballPointsToAdd] = useState('');
    const [activeSportTab, setActiveSportTab] = useState<'tennis' | 'padel' | 'pickleball'>('tennis');
    const [isSuspended, setIsSuspended] = useState(false);
    const [adminNotes, setAdminNotes] = useState('');
    const [saving, setSaving] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);

    const loadPlayers = useCallback(async () => {
        if (!managedClubId) return;
        setLoading(true);
        try {
            const data = await getClubPlayers(managedClubId);
            setPlayers(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [managedClubId]);

    useEffect(() => {
        loadPlayers();
    }, [loadPlayers]);

    const handleOpenPlayer = (player: any) => {
        setSelectedPlayer(player);
        setIsSuspended(player.isSuspended || false);
        setAdminNotes(player.adminNotes || '');
        setPointsToAdd(player.points?.toString() || '');
        setPadelPointsToAdd(player.padelPoints?.toString() || '');
        setPickleballPointsToAdd(player.pickleballPoints?.toString() || '');
        setActiveSportTab('tennis');
    };

    const handleSaveActions = async () => {
        if (!selectedPlayer?.uid || !managedClubId) return;
        setSaving(true);
        try {
            const updates: any = {
                [`clubs.${managedClubId}.isSuspended`]: isSuspended,
                [`clubs.${managedClubId}.adminNotes`]: adminNotes
            };

            const tennisVal = Number(pointsToAdd);
            if (pointsToAdd.trim() !== '' && !isNaN(tennisVal)) {
                if (tennisVal === 0) updates[`clubs.${managedClubId}.points`] = deleteField();
                else updates[`clubs.${managedClubId}.points`] = tennisVal;
            }

            const padelVal = Number(padelPointsToAdd);
            if (padelPointsToAdd.trim() !== '' && !isNaN(padelVal)) {
                if (padelVal === 0) updates[`clubs.${managedClubId}.padelPoints`] = deleteField();
                else updates[`clubs.${managedClubId}.padelPoints`] = padelVal;
            }

            const pickleVal = Number(pickleballPointsToAdd);
            if (pickleballPointsToAdd.trim() !== '' && !isNaN(pickleVal)) {
                if (pickleVal === 0) updates[`clubs.${managedClubId}.pickleballPoints`] = deleteField();
                else updates[`clubs.${managedClubId}.pickleballPoints`] = pickleVal;
            }

            await updateUser(selectedPlayer.uid, updates);
            setSelectedPlayer(null);
            loadPlayers();
        } catch (error) {
            alert(t('common.error'));
        } finally {
            setSaving(false);
        }
    };

    const handleRecalculate = async () => {
        setShowConfirmModal(false);
        setRecalculating(true);
        try {
            await recalculateClubPoints(managedClubId!);
            await loadPlayers();
        } catch (error) {
            console.error(error);
        } finally {
            setRecalculating(false);
        }
    };

    const filteredPlayers = players.filter(p =>
        (p.displayName || p.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.email || '').toLowerCase().includes(search.toLowerCase())
    ).sort((a, b) => {
        const pointsA = a.points ?? 0;
        const pointsB = b.points ?? 0;
        if (pointsB !== pointsA) return pointsB - pointsA;
        return (a.displayName || a.name || '').localeCompare(b.displayName || b.name || '');
    });

    return (
        <div className="space-y-8 animate-fade-in relative min-h-[80vh]">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-white text-4xl font-extrabold uppercase tracking-widest">{t('adminTabs.players')}</h1>
                    <p className="text-gray-400 mt-2 font-medium">{t('admin.players.subtitle')}</p>
                </div>
                <button
                    onClick={() => setShowConfirmModal(true)}
                    disabled={recalculating}
                    className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-tennis-green px-6 py-4 rounded-2xl font-black uppercase tracking-widest border border-white/5 transition-all disabled:opacity-50"
                >
                    {recalculating ? <RefreshCw size={20} className="animate-spin" /> : <RefreshCw size={20} />}
                    {t('admin.tournaments.players.management.recalculateAction')}
                </button>
            </div>

            <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-3xl px-8 py-5 focus-within:border-tennis-green/30 transition-all">
                <Search className="text-gray-500" size={24} />
                <input
                    type="text"
                    placeholder={t('admin.tournaments.players.management.search')}
                    className="bg-transparent border-none outline-none text-white text-xl w-full"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-tennis-green"></div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredPlayers.map((player) => (
                        <div
                            key={player.uid || player.id}
                            onClick={() => handleOpenPlayer(player)}
                            className="glass p-8 rounded-[32px] group cursor-pointer hover:border-white/20 transition-all space-y-6"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${player.isSuspended ? 'bg-red-500/10 text-red-500' : 'bg-tennis-green/10 text-tennis-green'}`}>
                                        {player.isSuspended ? <UserX size={28} /> : <User size={28} />}
                                    </div>
                                    <div>
                                        <h3 className="text-white font-bold text-lg leading-tight group-hover:text-white transition-colors">
                                            {player.displayName || player.name}
                                        </h3>
                                        <p className="text-gray-500 text-xs mt-1 truncate max-w-[150px]">{player.email || 'Tournament Guest'}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-tennis-green font-black text-2xl leading-none">{player.points ?? 0}</p>
                                    <div className="flex flex-col gap-1 mt-1">
                                        <p className="text-gray-600 text-[10px] font-bold uppercase tracking-widest leading-none">TENNIS PTS</p>
                                        {player.padelPoints > 0 && <p className="text-blue-400 text-[10px] font-bold uppercase tracking-widest leading-none">PADEL: {player.padelPoints}</p>}
                                        {player.pickleballPoints > 0 && <p className="text-purple-400 text-[10px] font-bold uppercase tracking-widest leading-none">PICKLE: {player.pickleballPoints}</p>}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-4 border-t border-white/5">
                                <div className="flex gap-2">
                                    {player.isManual && <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 bg-white/5 text-gray-400 rounded-md">{t('admin.players.status.manual')}</span>}
                                    {player.isSuspended && <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 bg-red-500/10 text-red-500 rounded-md">{t('admin.players.status.suspended')}</span>}
                                </div>
                                {player.adminNotes && <MessageCircle size={16} className="text-gray-600" />}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Sidebar Edit Panel (Modern alternative to Modal) */}
            {selectedPlayer && (
                <>
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity" onClick={() => setSelectedPlayer(null)}></div>
                    <div className="fixed right-0 top-0 h-full w-full max-w-md bg-gray-950 border-l border-white/10 z-50 p-10 transform transition-transform duration-300 animate-slide-in-right">
                        <div className="flex justify-between items-center mb-10">
                            <h2 className="text-white text-3xl font-black uppercase tracking-tight">{t('admin.players.profile.title')}</h2>
                            <button onClick={() => setSelectedPlayer(null)} className="w-10 h-10 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center text-gray-500 hover:text-white transition-all">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-10">
                            <div className="flex items-center gap-6">
                                <div className="w-20 h-20 bg-tennis-green/10 rounded-3xl flex items-center justify-center text-tennis-green">
                                    <User size={40} />
                                </div>
                                <div>
                                    <h3 className="text-white text-2xl font-bold">{selectedPlayer.displayName || selectedPlayer.name}</h3>
                                    <p className="text-gray-500">{selectedPlayer.email || 'Registered via tournament'}</p>
                                </div>
                            </div>

                            <div className="space-y-6">
                                {/* Sport Tabs */}
                                <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5">
                                    <button
                                        onClick={() => setActiveSportTab('tennis')}
                                        className={`flex-1 py-3 rounded-xl font-bold text-xs transition-all ${activeSportTab === 'tennis' ? 'bg-white/10 text-white shadow-xl' : 'text-gray-500'}`}
                                    >
                                        Tennis
                                    </button>
                                    <button
                                        onClick={() => setActiveSportTab('padel')}
                                        className={`flex-1 py-3 rounded-xl font-bold text-xs transition-all ${activeSportTab === 'padel' ? 'bg-blue-500/20 text-blue-400 shadow-xl' : 'text-gray-500'}`}
                                    >
                                        Padel
                                    </button>
                                    <button
                                        onClick={() => setActiveSportTab('pickleball')}
                                        className={`flex-1 py-3 rounded-xl font-bold text-xs transition-all ${activeSportTab === 'pickleball' ? 'bg-purple-500/20 text-purple-400 shadow-xl' : 'text-gray-500'}`}
                                    >
                                        Pickleball
                                    </button>
                                </div>

                                <div>
                                    <label className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-3 block">
                                        {t('admin.players.profile.adjustPoints')}
                                        <span className="text-tennis-green ml-1">({activeSportTab.toUpperCase()})</span>
                                    </label>
                                    <div className="flex items-center gap-4">
                                        <div className="flex-1 bg-white/5 border border-white/10 rounded-2xl flex items-center px-6 py-4">
                                            <input
                                                type="text"
                                                className="bg-transparent border-none outline-none text-white text-xl font-bold w-full"
                                                placeholder="0"
                                                value={
                                                    activeSportTab === 'tennis' ? pointsToAdd :
                                                        activeSportTab === 'padel' ? padelPointsToAdd :
                                                            pickleballPointsToAdd
                                                }
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    if (activeSportTab === 'tennis') setPointsToAdd(val);
                                                    else if (activeSportTab === 'padel') setPadelPointsToAdd(val);
                                                    else setPickleballPointsToAdd(val);
                                                }}
                                            />
                                            <span className="text-gray-600 font-bold ml-2">PTS</span>
                                        </div>
                                    </div>
                                    <p className="text-gray-600 text-[10px] mt-2 italic">* This sets the exact point value (0 removes them)</p>
                                </div>

                                <div className="p-6 bg-red-500/5 border border-red-500/10 rounded-3xl flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <ShieldAlert className={isSuspended ? 'text-red-500' : 'text-gray-600'} size={24} />
                                        <div>
                                            <p className="text-white font-bold text-sm">{t('admin.players.profile.suspend')}</p>
                                            <p className="text-gray-600 text-[10px] uppercase font-bold mt-0.5">{t('admin.players.profile.restrictionMode')}</p>
                                        </div>
                                    </div>
                                    <div
                                        onClick={() => setIsSuspended(!isSuspended)}
                                        className={`w-14 h-8 rounded-full p-1 cursor-pointer transition-all duration-300 ${isSuspended ? 'bg-red-500' : 'bg-gray-800'}`}
                                    >
                                        <div className={`w-6 h-6 bg-white rounded-full shadow-lg transform transition-transform duration-300 ${isSuspended ? 'translate-x-6' : 'translate-x-0'}`}></div>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-3 block">{t('admin.players.profile.adminNotes')}</label>
                                    <textarea
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white resize-none h-32 focus:outline-none focus:border-tennis-green/30 transition-all text-sm"
                                        placeholder={t('admin.players.profile.phNotes')}
                                        value={adminNotes}
                                        onChange={(e) => setAdminNotes(e.target.value)}
                                    ></textarea>
                                </div>

                                <button
                                    onClick={handleSaveActions}
                                    disabled={saving}
                                    className="w-full bg-tennis-green hover:bg-tennis-green/90 text-tennis-dark py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-tennis-green/20 transition-all flex items-center justify-center gap-3 disabled:opacity-50 mt-4 active:scale-95"
                                >
                                    {saving ? <RefreshCw size={24} className="animate-spin" /> : (
                                        <>
                                            <Save size={20} />
                                            {t('admin.players.profile.updateButton')}
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}

            <ConfirmModal
                isOpen={showConfirmModal}
                onClose={() => setShowConfirmModal(false)}
                onConfirm={handleRecalculate}
                title={t('admin.tournaments.players.management.recalculateAction')}
                message={t('admin.tournaments.players.management.recalculateConfirm')}
                processing={recalculating}
            />
        </div>
    );
};

export default PlayersPage;
