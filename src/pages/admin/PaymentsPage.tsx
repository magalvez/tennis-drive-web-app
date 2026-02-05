import {
    Clock,
    DollarSign,
    RefreshCw,
    Repeat,
    TrendingUp,
    RotateCcw
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { getAllTransactions, revertTransaction } from '../../services/paymentService';
import type { Transaction } from '../../services/types';

const PaymentsPage = () => {
    const { managedClubId } = useAuth();
    const { t } = useLanguage();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState<string | null>(null);
    const [filterStatus, setFilterStatus] = useState<'all' | 'completed' | 'pending' | 'refunded' | 'failed'>('all');

    const loadData = useCallback(async () => {
        if (!managedClubId) return;
        setLoading(true);
        try {
            const data = await getAllTransactions(managedClubId);
            setTransactions(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [managedClubId]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleRevert = async (txId: string) => {
        if (!window.confirm(t('admin.payments.revertConfirm') || "Are you sure you want to refund/revert this transaction?")) return;
        setProcessing(txId);
        try {
            await revertTransaction(txId);
            await loadData();
        } catch (error) {
            alert(t('common.error'));
        } finally {
            setProcessing(null);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed': return 'bg-tennis-green';
            case 'pending': return 'bg-yellow-500';
            case 'refunded':
            case 'failed': return 'bg-red-500';
            default: return 'bg-gray-500';
        }
    };

    const filteredTransactions = transactions.filter(tx =>
        filterStatus === 'all' ? true : tx.status === filterStatus
    );

    const stats = {
        total: transactions.filter(tx => tx.status === 'completed').reduce((acc, tx) => acc + tx.amount, 0),
        pending: transactions.filter(tx => tx.status === 'pending').reduce((acc, tx) => acc + tx.amount, 0),
        refunded: transactions.filter(tx => tx.status === 'refunded').reduce((acc, tx) => acc + tx.amount, 0)
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-tennis-green"></div>
        </div>
    );

    return (
        <div className="space-y-10 animate-fade-in pb-20">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-white text-4xl font-extrabold uppercase tracking-tight">{t('admin.payments.title')}</h1>
                    <p className="text-gray-500 font-bold uppercase text-[10px] tracking-widest mt-1">{t('admin.payments.subtitle')}</p>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass p-8 rounded-[32px] border-tennis-green/10 space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-tennis-green/10 flex items-center justify-center text-tennis-green">
                        <TrendingUp size={24} />
                    </div>
                    <div>
                        <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">{t('admin.payments.stats.total')}</p>
                        <p className="text-white text-3xl font-black">${stats.total.toLocaleString()}</p>
                    </div>
                </div>
                <div className="glass p-8 rounded-[32px] border-yellow-500/10 space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-yellow-500/10 flex items-center justify-center text-yellow-500">
                        <Clock size={24} />
                    </div>
                    <div>
                        <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">{t('admin.payments.stats.pending')}</p>
                        <p className="text-white text-3xl font-black">${stats.pending.toLocaleString()}</p>
                    </div>
                </div>
                <div className="glass p-8 rounded-[32px] border-red-500/10 space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500">
                        <Repeat size={24} />
                    </div>
                    <div>
                        <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">{t('admin.payments.stats.refunded')}</p>
                        <p className="text-white text-3xl font-black">${stats.refunded.toLocaleString()}</p>
                    </div>
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-2">
                <button
                    onClick={() => setFilterStatus('all')}
                    className={`px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${filterStatus === 'all' ? 'bg-white text-tennis-dark' : 'bg-white/5 text-gray-500 hover:text-white'}`}
                >
                    {t('admin.payments.filters.all')}
                </button>
                <button
                    onClick={() => setFilterStatus('completed')}
                    className={`px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${filterStatus === 'completed' ? 'bg-tennis-green text-tennis-dark' : 'bg-white/5 text-gray-500 hover:text-white'}`}
                >
                    {t('admin.payments.filters.successful')}
                </button>
                <button
                    onClick={() => setFilterStatus('pending')}
                    className={`px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${filterStatus === 'pending' ? 'bg-yellow-500 text-tennis-dark' : 'bg-white/5 text-gray-500 hover:text-white'}`}
                >
                    {t('admin.payments.filters.pending')}
                </button>
                <button
                    onClick={() => setFilterStatus('refunded')}
                    className={`px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${filterStatus === 'refunded' ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : 'bg-white/5 text-gray-500 hover:text-white'}`}
                >
                    {t('admin.payments.filters.refunded')}
                </button>
                <button
                    onClick={() => setFilterStatus('failed')}
                    className={`px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${filterStatus === 'failed' ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : 'bg-white/5 text-gray-500 hover:text-white'}`}
                >
                    {t('admin.payments.filters.failed')}
                </button>
            </div>

            {/* Transaction List */}
            <div className="space-y-4">
                {filteredTransactions.length === 0 ? (
                    <div className="glass p-20 rounded-[40px] border-dashed border-2 border-white/5 flex flex-col items-center justify-center text-center opacity-40">
                        <DollarSign size={48} className="text-gray-500 mb-4" />
                        <h3 className="text-white text-xl font-bold uppercase tracking-tight">{t('admin.payments.noTransactions')}</h3>
                    </div>
                ) : (
                    filteredTransactions.map(tx => (
                        <div key={tx.id} className="glass p-6 rounded-[32px] border-white/5 flex flex-col md:flex-row items-center justify-between gap-6 hover:bg-white/[0.02] transition-colors">
                            <div className="flex items-center gap-6">
                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${getStatusColor(tx.status)}/10 ${getStatusColor(tx.status).replace('bg-', 'text-')}`}>
                                    <DollarSign size={24} />
                                </div>
                                <div className="space-y-1">
                                    <h3 className="text-white font-bold text-lg leading-tight">{tx.userName}</h3>
                                    <p className="text-gray-500 text-xs font-medium">{tx.referenceName || t('admin.payments.methods.manual')}</p>
                                    <div className="flex items-center gap-3 mt-1">
                                        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${getStatusColor(tx.status).replace('bg-', 'bg-')}/5 ${getStatusColor(tx.status).replace('bg-', 'text-')} border border-white/5`}>
                                            {t(`admin.payments.status.${tx.status}`)}
                                        </span>
                                        <span className="text-gray-700 text-[10px] font-bold uppercase">
                                            {tx.createdAt?.seconds ? new Date(tx.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-8">
                                <div className="text-right">
                                    <p className="text-white text-2xl font-black tracking-tight">${tx.amount}</p>
                                    <p className="text-gray-600 text-[8px] font-bold uppercase tracking-widest">{tx.paymentMethod === 'manual_admin' ? t('admin.payments.methods.manual') : tx.paymentMethod || 'Standard'}</p>
                                </div>
                                {tx.status === 'completed' && (
                                    <button
                                        onClick={() => handleRevert(tx.id)}
                                        disabled={!!processing}
                                        className="w-12 h-12 bg-white/5 border border-white/10 hover:bg-red-500/[0.02] hover:border-red-500/30 text-gray-700 hover:text-red-500 rounded-2xl flex items-center justify-center transition-all disabled:opacity-50"
                                        title={t('admin.payments.revertButtonTitle')}
                                    >
                                        {processing === tx.id ? <RefreshCw className="animate-spin" size={20} /> : <RotateCcw size={20} />}
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default PaymentsPage;
