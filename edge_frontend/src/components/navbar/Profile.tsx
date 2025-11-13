import React from 'react';
import { cva } from 'class-variance-authority';
import { useAuthStore } from '../../store/authStore';
import { ProfileDropdown } from './ProfileDropdown';
import { EdgeInfo } from './EdgeInfo';

const headerContainer = cva(['flex justify-between items-center p-4']);

const leftSection = cva(['flex items-center gap-4']);

export const Profile: React.FC = () => {
  const { user } = useAuthStore();

  if (!user) return null;

  return (
    <div className={headerContainer()}>
      <div className={leftSection()}>
        <ProfileDropdown />
        <EdgeInfo />
      </div>
    </div>
  );
};

export default Profile;
