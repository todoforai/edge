import * as Dialog from '@radix-ui/react-dialog'
import { cn } from "@/lib/utils"

interface ModalOverlayProps extends React.ComponentProps<typeof Dialog.Overlay> {}

export const ModalOverlay: React.FC<ModalOverlayProps> = ({ 
  className, 
  ...props 
}) => {
  return (
    <Dialog.Overlay 
      className={cn(
        "fixed inset-0 z-[1000] bg-black/50 backdrop-blur-sm animate-in fade-in-0",
        className
      )}
      {...props}
    />
  )
}