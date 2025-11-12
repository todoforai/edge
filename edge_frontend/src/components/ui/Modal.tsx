import React from 'react';
import { X } from 'lucide-react';
import { cva } from "class-variance-authority";

const overlay = cva([
  "fixed top-0 left-0 right-0 bottom-0 bg-black/50 flex items-center justify-center z-[1000]"
]);

const container = cva([
  "bg-background rounded-lg border border-border w-[90%] max-w-[1200px] max-h-[80vh] overflow-hidden flex flex-col"
]);

const header = cva([
  "flex items-center justify-between p-7 border-b border-border"
]);

const titleClass = cva([
  "text-xl font-semibold text-foreground m-0"
]);

const closeButton = cva([
  "bg-transparent border-none text-muted-foreground cursor-pointer p-2 rounded-sm flex items-center justify-center transition-colors hover:bg-black/10"
]);

const content = cva([
  "flex-1 overflow-y-auto p-6"
]);

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ title, onClose, children }) => {
  React.useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div className={overlay()} onClick={onClose}>
      <div className={container()} onClick={(e) => e.stopPropagation()}>
        <div className={header()}>
          <h2 className={titleClass()}>{title}</h2>
          <button className={closeButton()} onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className={content()}>{children}</div>
      </div>
    </div>
  );
};