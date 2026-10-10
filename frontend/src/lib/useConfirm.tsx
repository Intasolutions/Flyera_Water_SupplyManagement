import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}

type ConfirmFunction = (options: string | ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFunction>(() => Promise.resolve(false));

export const useConfirm = () => useContext(ConfirmContext);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({ message: '' });
  const [resolver, setResolver] = useState<(value: boolean) => void>();

  const confirm: ConfirmFunction = useCallback((opts) => {
    return new Promise((resolve) => {
      setOptions(typeof opts === 'string' ? { message: opts } : opts);
      setResolver(() => resolve);
      setIsOpen(true);
    });
  }, []);

  const handleConfirm = () => {
    if (resolver) resolver(true);
    setIsOpen(false);
  };

  const handleCancel = () => {
    if (resolver) resolver(false);
    setIsOpen(false);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        isOpen={isOpen}
        onClose={handleCancel}
        title={options.title || "Please Confirm"}
        width="md"
        actions={
          <>
            <Button variant="secondary" onClick={handleCancel}>
              {options.cancelText || "Cancel"}
            </Button>
            <Button variant="danger" onClick={handleConfirm}>
              {options.confirmText || "Confirm"}
            </Button>
          </>
        }
      >
        <div className="text-slate-700 font-medium">
          {options.message}
        </div>
      </Modal>
    </ConfirmContext.Provider>
  );
}
