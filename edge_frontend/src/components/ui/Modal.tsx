import React from 'react';
import { styled } from '../../../styled-system/jsx';
import { X } from 'lucide-react';

const Overlay = styled('div', {
  base: {
    position: 'fixed',
    top: '0',
    left: '0',
    right: '0',
    bottom: '0',
    background: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: '1000',
  },
});

const Container = styled('div', {
  base: {
    background: 'token(colors.background)',
    borderRadius: 'token(radii.lg)',
    border: '1px solid token(colors.borderColor)',
    width: '90%',
    maxWidth: '1200px',
    maxHeight: '80vh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
});

const Header = styled('div', {
  base: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '28px',
    borderBottom: '1px solid token(colors.borderColor)',
  },
});

const Title = styled('h2', {
  base: {
    fontSize: '20px',
    fontWeight: '600',
    color: 'token(colors.foreground)',
    margin: '0',
  },
});

const CloseButton = styled('button', {
  base: {
    background: 'transparent',
    border: 'none',
    color: 'token(colors.mutedForeground)',
    cursor: 'pointer',
    padding: '8px',
    borderRadius: 'token(radii.sm)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',

    '&:hover': {
      background: 'rgba(0, 0, 0, 0.1)',
    },
  },
});

const Content = styled('div', {
  base: {
    flex: '1',
    overflowY: 'auto',
    padding: '24px',
  },
});

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
    <Overlay onClick={onClose}>
      <Container onClick={(e) => e.stopPropagation()}>
        <Header>
          <Title>{title}</Title>
          <CloseButton onClick={onClose}>
            <X size={20} />
          </CloseButton>
        </Header>
        <Content>{children}</Content>
      </Container>
    </Overlay>
  );
};