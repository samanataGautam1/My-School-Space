import React from 'react';
import { X } from 'lucide-react';

export const Button = ({ children, variant = 'primary', size = 'md', className = '', loading = false, disabled = false, ...props }) => {
    const baseStyle = "rounded-xl transition-all duration-300 transform active:scale-95 shadow-lg flex items-center justify-center gap-2";

    const sizes = {
        sm: "px-4 py-2 text-sm",
        md: "px-6 py-3",
        lg: "px-8 py-4 text-lg"
    };

    const variants = {
        primary: "bg-green-950 text-white hover:bg-green-900 shadow-emerald-950/30 disabled:opacity-70 disabled:cursor-not-allowed",
        secondary: "bg-white text-slate-800 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50",
        outline: "border-2 border-white/20 text-white hover:bg-white/10 disabled:opacity-50",
        ghost: "text-slate-600 hover:bg-slate-100 disabled:opacity-50",
        danger: "bg-gradient-to-r from-red-600 to-pink-600 text-white shadow-red-500/30 disabled:opacity-50"
    };

    return (
        <button
            className={`${baseStyle} ${sizes[size] || sizes.md} ${variants[variant]} ${className}`}
            disabled={loading || disabled}
            {...props}
        >
            {loading && (
                <svg className="animate-spin h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            )}
            {children}
        </button>
    );
};

export const Input = ({ label, error, size = 'md', className = '', ...props }) => {
    const inputSizes = {
        sm: "px-3 py-2 text-sm",
        md: "px-4 py-3",
        lg: "px-5 py-4 text-lg"
    };

    return (
        <div className={`flex flex-col gap-1.5 ${className}`}>
            {label && <label className={`text-slate-700 ${size === 'sm' ? 'text-[10px]' : 'text-xs'}`}>{label}</label>}
            <input
                className={`${inputSizes[size] || inputSizes.md} rounded-xl border bg-slate-50 focus:bg-[#fffdfa] transition-all outline-none
          ${error
                        ? 'border-red-300 focus:border-red-500 focus:ring-4 focus:ring-red-500/10'
                        : 'border-slate-200 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10'
                    }`}
                {...props}
            />
            {error && <span className="text-xs text-red-500">{error}</span>}
        </div>
    );
};

export const Card = ({ children, className = '', hover = false, ...props }) => {
    return (
        <div
            className={`bg-[#fffdfa] rounded-2xl border border-slate-100 shadow-xl shadow-slate-200/50 p-6 
      ${hover ? 'hover:-translate-y-1 hover:shadow-2xl transition-all duration-300' : ''} 
      ${className}`}
            {...props}
        >
            {children}
        </div>
    );
};

export const Badge = ({ children, color = 'indigo' }) => {
    const colors = {
        indigo: 'bg-green-50 text-green-900 border-green-100', // Default mapped to green
        green: 'bg-emerald-50 text-emerald-700 border-emerald-100',
        purple: 'bg-purple-50 text-purple-700 border-purple-100',
        amber: 'bg-amber-50 text-amber-700 border-amber-100',
    };

    return (
        <span className={`px-2.5 py-0.5 rounded-full text-[10px] border border-none ${colors[color] || colors.green}`}>
            {children}
        </span>
    );
};

export const Modal = ({ isOpen, onClose, title, children, footer }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in duration-200">
            <Card className="w-full max-w-md p-8 animate-in slide-in-from-bottom-4 duration-300">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-base font-medium text-slate-900">{title}</h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500"
                    >
                        <X size={20} />
                    </button>
                </div>
                <div className="mb-6">
                    {children}
                </div>
                {footer && (
                    <div className="flex gap-3 pt-2">
                        {footer}
                    </div>
                )}
            </Card>
        </div>
    );
};
