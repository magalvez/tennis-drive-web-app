import { useEffect, useState } from 'react';
import { AlertTriangle, HardHat, CreditCard, Save } from 'lucide-react';
import { getAppConfig, updateAppConfig } from '../../services/appConfigService';
import type { AppConfig } from '../../services/appConfigService';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

const ManagerSettingsPage = () => {
    const { user } = useAuth();
    const { t } = useLanguage();
    const [config, setConfig] = useState<AppConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [epaycoKeys, setEpaycoKeys] = useState({
        publicKey: '',
        pcustid: ''
    });

    const fetchConfig = async () => {
        const data = await getAppConfig();
        if (data) {
            setConfig(data);
            setEpaycoKeys({
                publicKey: data.epaycoPublicKey || '',
                pcustid: data.epaycoPcustid || ''
            });
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchConfig();
    }, []);

    const handleToggle = async (key: keyof AppConfig, value: boolean) => {
        try {
            await updateAppConfig({ [key]: value }, user?.uid || '');
            setConfig(prev => prev ? { ...prev, [key]: value } : null);
        } catch (error) {
            alert(t('manager.settings.updateError') || 'Failed to update config');
        }
    };

    const handleSaveKeys = async () => {
        setSaving(true);
        try {
            await updateAppConfig({ 
                epaycoPublicKey: epaycoKeys.publicKey,
                epaycoPcustid: epaycoKeys.pcustid
            }, user?.uid || '');
            alert(t('manager.settings.saveSuccess'));
        } catch (error) {
            alert(t('manager.settings.saveError'));
        } finally {
            setSaving(false);
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-tennis-green"></div>
        </div>
    );

    return (
        <div className="max-w-4xl space-y-8 pb-10">
            <div>
                <h1 className="text-3xl font-black text-white tracking-tight">{t('manager.settings.title')}</h1>
                <p className="text-gray-400 mt-1">{t('manager.settings.subtitle')}</p>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {/* EPayco Config Section */}
                <div className="bg-[#1f1f1f] border border-white/5 rounded-[2rem] p-10 space-y-8">
                    <div className="flex items-center gap-4">
                        <CreditCard size={24} className="text-tennis-green" />
                        <h2 className="text-xl font-black text-white uppercase tracking-tight">{t('manager.settings.epaycoConfig')}</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-4">{t('manager.settings.publicKey')}</label>
                            <input 
                                type="text" 
                                placeholder={t('manager.settings.publicKeyPlaceholder')}
                                className="w-full bg-[#1a1a1a] border border-white/5 rounded-2xl py-5 px-6 text-white text-sm font-bold outline-none focus:border-tennis-green/50 transition-all placeholder:text-gray-700"
                                value={epaycoKeys.publicKey}
                                onChange={(e) => setEpaycoKeys(prev => ({ ...prev, publicKey: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-4">{t('manager.settings.pcustid')}</label>
                            <input 
                                type="text" 
                                placeholder={t('manager.settings.pcustidPlaceholder')}
                                className="w-full bg-[#1a1a1a] border border-white/5 rounded-2xl py-5 px-6 text-white text-sm font-bold outline-none focus:border-tennis-green/50 transition-all placeholder:text-gray-700"
                                value={epaycoKeys.pcustid}
                                onChange={(e) => setEpaycoKeys(prev => ({ ...prev, pcustid: e.target.value }))}
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-white/5 mt-4">
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-3">
                                <button 
                                    onClick={() => handleToggle('epaycoGlobalTestMode', !config?.epaycoGlobalTestMode)}
                                    className={`w-12 h-6 rounded-full transition-all relative ${config?.epaycoGlobalTestMode ? 'bg-tennis-green' : 'bg-gray-700'}`}
                                >
                                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all ${config?.epaycoGlobalTestMode ? 'right-0.5' : 'left-0.5'}`}></div>
                                </button>
                                <span className="text-white text-sm font-bold">{t('manager.settings.sandboxMode')}</span>
                            </div>
                        </div>
                        
                        <button 
                            onClick={handleSaveKeys}
                            disabled={saving}
                            className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-black text-sm transition-all ${
                                saving ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-tennis-green text-tennis-dark hover:scale-105 active:scale-95'
                            }`}
                        >
                            <Save size={18} />
                            {saving ? t('manager.settings.saving') || 'Saving...' : t('manager.settings.updateEpayco')}
                        </button>
                    </div>
                </div>

                <div className="bg-[#1f1f1f] border border-white/5 rounded-[2rem] p-10 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500">
                            <HardHat size={28} />
                        </div>
                        <div>
                            <h3 className="text-white font-bold text-lg leading-tight">{t('manager.settings.systemMaintenance')}</h3>
                            <p className="text-gray-500 text-sm mt-1">{t('manager.settings.maintenanceDesc')}</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => handleToggle('systemMaintenance', !config?.systemMaintenance)}
                        className={`w-14 h-8 rounded-full transition-all relative ${config?.systemMaintenance ? 'bg-red-500' : 'bg-gray-700'}`}
                    >
                        <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${config?.systemMaintenance ? 'right-1' : 'left-1'}`}></div>
                    </button>
                </div>
            </div>

            <div className="p-8 bg-amber-500/10 border border-amber-500/20 rounded-[2rem] flex gap-6 items-start">
                <AlertTriangle className="text-amber-500 shrink-0" size={32} />
                <div>
                    <h4 className="text-amber-500 font-bold uppercase tracking-widest text-xs mb-2">{t('manager.settings.highImpact')}</h4>
                    <p className="text-gray-400 text-sm leading-relaxed">
                        {t('manager.settings.highImpactDesc')}
                    </p>
                </div>
            </div>

            <div className="text-[10px] text-gray-600 font-black uppercase tracking-[0.2em] p-4 text-center">
                {t('manager.settings.lastUpdated', { 
                    date: config?.updatedAt?.toDate()?.toLocaleString(),
                    user: config?.updatedBy || 'System'
                })}
            </div>
        </div>
    );
};

export default ManagerSettingsPage;
