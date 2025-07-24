import React from 'react';
import styled from 'styled-components';
import { useAuthStore } from '../../store/authStore';
import { ProfileDropdown } from './ProfileDropdown';
import { EdgeInfo } from './EdgeInfo';

const HeaderContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1rem;
  /* background: ${(props) => props.theme.colors.cardBackground}; */
`;

const LeftSection = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
`;

export const UserMenu: React.FC = () => {
  const { user } = useAuthStore();

  if (!user) return null;

  return (
    <HeaderContainer>
      <LeftSection>
        <ProfileDropdown />
        <EdgeInfo />
      </LeftSection>
    </HeaderContainer>
  );
};

export default UserMenu;
