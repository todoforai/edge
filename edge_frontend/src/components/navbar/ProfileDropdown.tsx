import React from 'react';
import styled from '@emotion/styled';
import { User, Mail, LogOut } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

const ProfileButton = styled.button`
  background: ${(props) => props.theme.colors.cardBackground};
  border: 1px solid ${(props) => props.theme.colors.borderColor};
  padding: 0;
  width: 2.5rem;
  height: 2.5rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${(props) => props.theme.colors.foreground};
  border-radius: 50%;
  transition: all 0.3s ease;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);

  &:hover {
    background: rgba(255, 255, 255, 0.15);
    transform: translateY(-2px);
    box-shadow: 0px 0px 10px rgba(255, 165, 0, 0.1);
  }
`;

const ProfileImage = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  background: transparent;
`;

const UserContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
`;

const DropdownContainer = styled.div`
  position: relative;
  display: inline-block;
`;

const DropdownContent = styled.div`
  display: none;
  position: absolute;
  left: 0;
  min-width: 220px;
  background: ${(props) => props.theme.colors.cardBackground};
  border-radius: ${(props) => props.theme.radius.lg};
  padding: 0.5rem;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  border: 1px solid ${(props) => props.theme.colors.borderColor};
  z-index: 100;

  ${DropdownContainer}:hover & {
    display: block;
  }
`;

const EmailHeader = styled.div`
  padding: 0.75rem 1rem;
  color: ${(props) => props.theme.colors.foreground};
  font-size: 0.9rem;
  border-bottom: 1px solid ${(props) => props.theme.colors.borderColor};
  margin-bottom: 0.5rem;
  opacity: 0.8;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const DropdownItem = styled.div`
  padding: 0.5rem 1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: ${(props) => props.theme.colors.foreground};
  border-radius: ${(props) => props.theme.radius.md};

  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }
`;

export const ProfileDropdown: React.FC = () => {
  const { user, logout } = useAuthStore();

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
        <DropdownItem onClick={handleLogout}>
          <LogOut size={16} />
          <span>Logout</span>
        </DropdownItem>
      </DropdownContent>
    </DropdownContainer>
  );
};