import React from 'react';
import { styled } from '../../../styled-system/jsx';
import { User, Mail, LogOut, Info } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { getAppVersion } from '../../lib/tauri-api';

const ProfileButton = styled('button', {
  base: {
    background: 'token(colors.cardBackground)',
    border: '1px solid token(colors.borderColor)',
    padding: '0',
    width: '2.5rem',
    height: '2.5rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'token(colors.foreground)',
    borderRadius: '50%',
    transition: 'all 0.3s ease',
    overflow: 'hidden',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',

    '&:hover': {
      background: 'rgba(255, 255, 255, 0.15)',
      transform: 'translateY(-2px)',
      boxShadow: '0px 0px 10px rgba(255, 165, 0, 0.1)',
    },
  },
});

const ProfileImage = styled('div', {
  base: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    background: 'transparent',
  },
});

const UserContainer = styled('div', {
  base: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
});

const DropdownContainer = styled('div', {
  base: {
    position: 'relative',
    display: 'inline-block',
  },
});

const DropdownContent = styled('div', {
  base: {
    display: 'none',
    position: 'absolute',
    left: '0',
    minWidth: '220px',
    background: 'token(colors.cardBackground)',
    borderRadius: 'token(radii.lg)',
    padding: '0.5rem',
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)',
    border: '1px solid token(colors.borderColor)',
    zIndex: '100',

    [`${DropdownContainer}:hover &`]: {
      display: 'block',
    },
  },
});

const EmailHeader = styled('div', {
  base: {
    padding: '0.75rem 1rem',
    color: 'token(colors.foreground)',
    fontSize: '0.9rem',
    borderBottom: '1px solid token(colors.borderColor)',
    marginBottom: '0.5rem',
    opacity: '0.8',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
});

const DropdownItem = styled('div', {
  base: {
    padding: '0.5rem 1rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    color: 'token(colors.foreground)',
    borderRadius: 'token(radii.md)',

    '&:hover': {
      background: 'rgba(255, 255, 255, 0.1)',
    },
  },
});

const VersionItem = styled('div', {
  base: {
    padding: '0.5rem 1rem',
    color: 'token(colors.muted)',
    fontSize: '0.8rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
});

export const ProfileDropdown: React.FC = () => {
  const { user, logout } = useAuthStore();
  const [appVersion, setAppVersion] = React.useState<string>('');

  React.useEffect(() => {
    getAppVersion().then(setAppVersion);
  }, []);

  const handleLogout = () => {
    logout();
  };

  if (!user) return null;

  return (
    <DropdownContainer>
      <UserContainer>
        <ProfileButton>
          <ProfileImage>
            <User size={24} />
          </ProfileImage>
        </ProfileButton>
      </UserContainer>
      <DropdownContent>
        <EmailHeader>
          <Mail size={16} />
          {user.email || 'User'}
        </EmailHeader>
        {appVersion && (
          <VersionItem>
            <Info size={16} />
            <span>Version {appVersion}</span>
          </VersionItem>
        )}
        <DropdownItem onClick={handleLogout}>
          <LogOut size={16} />
          <span>Logout</span>
        </DropdownItem>
      </DropdownContent>
    </DropdownContainer>
  );
};