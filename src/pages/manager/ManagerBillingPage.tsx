import React, { useEffect, useState } from 'react';
import { 
  getAllBillings, 
  updateBillingStatus
} from '../../services/managerService';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { 
  Search, 
  Filter, 
  CheckCircle, 
  Clock, 
  DollarSign,
  Calendar,
  Building2
} from 'lucide-react';

interface BillingRecord {
  id: string;
  clubId: string;
  clubName: string;
  totalFee: number;
  status: 'paid' | 'pending';
  calculatedAt: any;
  type: string;
  billingPeriod?: string;
  tournamentName?: string;
}

const ManagerBillingPage: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [billings, setBillings] = useState<BillingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'paid' | 'pending'>('all');

  const fetchBillings = async () => {
    try {
      setLoading(true);
      const data = await getAllBillings();
      setBillings(data);
    } catch (error) {
      console.error('Error fetching billings:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBillings();
  }, []);

  const handleToggleStatus = async (billingId: string, currentStatus: string) => {
    if (!confirm(t('manager.billing.confirmStatusChange'))) return;
    
    try {
      const newStatus = currentStatus === 'paid' ? 'pending' : 'paid';
      await updateBillingStatus(billingId, newStatus, user?.uid || 'system');
      fetchBillings();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const filteredBillings = billings.filter(b => {
    const matchesSearch = b.clubName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         (b.tournamentName?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || b.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">{t('manager.billing.title')}</h1>
          <p className="text-gray-400 mt-1">{t('manager.billing.subtitle')}</p>
        </div>
      </header>

      {/* Filters & Actions */}
      <div className="flex flex-col md:flex-row gap-4 items-center bg-zinc-900/50 p-4 rounded-xl border border-white/5 backdrop-blur-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder={t('manager.billing.searchPlaceholder')}
            className="w-full bg-black/40 border border-white/10 rounded-lg py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#dcfc03]/50 transition-all font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="w-4 h-4 text-gray-500" />
          <select
            className="bg-black/40 border border-white/10 rounded-lg py-2 px-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#dcfc03]/50 transition-all font-medium"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
          >
            <option value="all">{t('manager.billing.allStatus')}</option>
            <option value="paid">{t('manager.billing.paid')}</option>
            <option value="pending">{t('manager.billing.pending')}</option>
          </select>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="bg-zinc-900/40 rounded-2xl border border-white/5 overflow-hidden backdrop-blur-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5">
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">{t('manager.billing.club')}</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">{t('manager.billing.date')}</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">{t('manager.billing.type')}</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">{t('manager.billing.amount')}</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">{t('manager.billing.status')}</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest text-right">{t('manager.billing.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-2 border-[#dcfc03] border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm font-medium">{t('common.loading')}</span>
                    </div>
                  </td>
                </tr>
              ) : filteredBillings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-3">
                      <DollarSign className="w-10 h-10 text-gray-700" />
                      <span className="text-sm font-medium">{t('manager.billing.noInvoices')}</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredBillings.map((billing) => (
                  <tr key={billing.id} className="group hover:bg-white/5 transition-all">
                    <td className="px-6 py-5 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/5 flex items-center justify-center text-[#dcfc03]">
                          <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white leading-none capitalize">{billing.clubName}</p>
                          <p className="text-[10px] text-gray-500 font-medium tracking-tight mt-1">ID: #{billing.id.slice(-6).toUpperCase()}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-sm text-gray-300 font-medium">
                        <Calendar className="w-3.5 h-3.5 text-gray-500" />
                        {formatDate(billing.calculatedAt)}
                      </div>
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap">
                       <span className="text-xs font-bold text-gray-400 uppercase tracking-widest bg-white/5 px-2 py-1 rounded">
                          {billing.type === 'monthly' || billing.type === 'monthly_manual' 
                              ? t('manager.billing.period') + ': ' + (billing.billingPeriod || 'N/A')
                              : billing.tournamentName || t('manager.billing.tournament')}
                       </span>
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap font-mono text-sm">
                      <span className="text-[#dcfc03] font-bold">${billing.totalFee.toLocaleString()}</span>
                      <span className="text-gray-500 text-[10px] ml-1 uppercase">cop</span>
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                        billing.status === 'paid' 
                          ? 'bg-[#dcfc03]/20 text-[#dcfc03] border border-[#dcfc03]/20' 
                          : 'bg-orange-500/20 text-orange-400 border border-orange-500/20'
                      }`}>
                        {billing.status === 'paid' ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                        {t(`manager.billing.${billing.status}`)}
                      </span>
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap text-right">
                      <button
                        onClick={() => handleToggleStatus(billing.id, billing.status)}
                        className="p-2 hover:bg-[#dcfc03] hover:text-black rounded-lg transition-all text-gray-400"
                        title={billing.status === 'paid' ? t('manager.billing.markPending') : t('manager.billing.markPaid')}
                      >
                        {billing.status === 'paid' ? <Clock className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ManagerBillingPage;
