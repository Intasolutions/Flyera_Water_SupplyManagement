import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  width?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl';
  actions?: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, subtitle, children, width = '2xl', actions }: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const widthMap = {
    'sm': 'max-w-sm',
    'md': 'max-w-md',
    'lg': 'max-w-lg',
    'xl': 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
      <div 
        className={`bg-white rounded-3xl w-full ${widthMap[width]} shadow-2xl animate-in zoom-in-95 duration-300 overflow-hidden border border-slate-100 flex flex-col max-h-[90vh] mx-auto`}
      >
        {/* Header */}
        <div className="px-8 py-6 md:px-10 md:py-8 border-b border-slate-100 flex justify-between items-start bg-white">
          <div className="pr-4">
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">{title}</h2>
            {subtitle && <div className="text-sm font-medium text-slate-500 mt-2">{subtitle}</div>}
          </div>
          <button 
            onClick={onClose} 
            className="p-2.5 bg-slate-50 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors shrink-0"
          >
            <X className="w-5 h-5"/>
          </button>
        </div>
        
        {/* Body */}
        <div className="p-8 md:p-10 overflow-y-auto bg-slate-50/30 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {children}
        </div>

        {/* Actions */}
        {actions && (
          <div className="px-8 py-6 md:px-10 md:py-6 border-t border-slate-100 bg-white flex flex-col sm:flex-row gap-4 sm:justify-end mt-auto">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
