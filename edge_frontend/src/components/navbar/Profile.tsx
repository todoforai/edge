import React from 'react';
import { styled } from '../../../styled-system/jsx';
import { useAuthStore } from '../../store/authStore';
import { ProfileDropdown } from './ProfileDropdown';
import { EdgeInfo } from './EdgeInfo';

const HeaderContainer = styled('div', {
  base: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 1rem',
    /* background: token(colors.cardBackground); */
  },
});

const LeftSection = styled('div', {
  base: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
});

export const Profile: React.FC = () => {
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

export default Profile;
