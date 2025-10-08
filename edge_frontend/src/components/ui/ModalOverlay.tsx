import { styled } from '@/../styled-system/jsx';
import * as Dialog from '@radix-ui/react-dialog';

export const ModalOverlay = styled(Dialog.Overlay, {
  base: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    position: 'fixed',
    inset: 0,
    animation: 'overlayShow 150ms cubic-bezier(0.16, 1, 0.3, 1)',
    zIndex: 1000,
    backdropFilter: 'blur(2px)',
  },
});