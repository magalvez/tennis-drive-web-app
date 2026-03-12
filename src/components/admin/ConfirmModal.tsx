import React from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw, X } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    type?: 'success' | 'danger' | 'warning' | 'info';
    processing?: boolean;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    type = 'warning',
    processing = false
}) => {
    const { t } = useLanguage();

    if (!isOpen) return null;

    const typeConfig = {
        success: {
            icon: <CheckCircle2 size={40} />,
            bg: 'bg-tennis-green/10',
            text: 'text-tennis-green',
            btn: 'bg-tennis-green text-tennis-dark'
        },
        danger: {
            icon: <AlertTriangle size={40} />,
            bg: 'bg-red-500/10',
            text: 'text-red-500',
            btn: 'bg-red-500 text-white'
        },
        warning: {
            icon: <AlertTriangle size={40} />,
            bg: 'bg-yellow-500/10',
            text: 'text-yellow-500',
            btn: 'bg-yellow-500 text-black'
        },
        info: {
            icon: <AlertTriangle size={40} />,
            bg: 'bg-blue-500/10',
            text: 'text-blue-400',
            btn: 'bg-blue-500 text-white'
        }
    };

    const config = typeConfig[type];

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="glass max-w-md w-full p-12 rounded-[40px] text-center space-y-6 shadow-2xl animate-in zoom-in-95 duration-200 relative">
                <button onClick={onClose} disabled={processing} className="absolute right-8 top-8 text-gray-500 hover:text-white transition-colors">
                    <X size={24} />
                </button>

                <div className={`w-20 h-20 ${config.bg} ${config.text} rounded-3xl flex items-center justify-center mx-auto`}>
                    {config.icon}
                </div>
                
                <h2 className="text-white text-2xl font-black uppercase tracking-tight leading-tight">{title}</h2>
                <p className="text-gray-400 font-bold leading-relaxed">{message}</p>
                
                <div className="flex gap-4 pt-4">
                    <button 
                        onClick={onClose} 
                        disabled={processing}
                        className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-gray-400 font-black rounded-2xl transition-all uppercase tracking-widest border border-white/10"
                    >
                        {t('common.cancel')}
                    </button>
                    <button 
                        onClick={onConfirm} 
                        disabled={processing}
                        className={`flex-1 py-4 ${config.btn} font-black rounded-2xl transition-all uppercase tracking-widest shadow-lg flex items-center justify-center gap-2`}
                    >
                        {processing && <RefreshCw size={20} className="animate-spin" />}
                        {t('common.confirm')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;
