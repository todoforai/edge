import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import * as Dialog from '@radix-ui/react-dialog';

const modalOverlayVariants = cva(
  "fixed inset-0 bg-black/50 z-[1000] backdrop-blur-sm animate-in fade-in-0"
);

interface ModalOverlayProps {
  className?: string;
  children?: React.ReactNode;
}

export const ModalOverlay: React.FC<ModalOverlayProps> = ({ className, children, ...props }) => {
  return (
    <Dialog.Overlay className={cn(modalOverlayVariants(), className)} {...props}>
      {children}
    </Dialog.Overlay>
  );
};