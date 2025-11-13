import React from 'react';
import { User, LogOut, Info } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { getAppVersion } from '../../lib/tauri-api';
import { cva } from 'class-variance-authority';

const profileButton = cva([
  'bg-card border border-border p-0 w-10 h-10 cursor-pointer flex items-center justify-center text-foreground rounded-full transition-all overflow-hidden shadow-md hover:bg-white/15 hover:translate-y-[-2px] hover:shadow-orange-100/10',
]);

const profileImage = cva(['w-full h-full flex items-center justify-center relative bg-transparent']);

const userContainer = cva(['flex items-center gap-3']);

const dropdownContainer = cva(['relative inline-block hover:[&_.dropdown-content]:block']);

const dropdownContent = cva([
  'hidden absolute left-0 min-w-[220px] bg-card rounded-lg p-2 shadow-lg border border-border z-[100] dropdown-content',
]);

const dropdownItem = cva(['p-2 px-4 cursor-pointer flex items-center gap-2 text-foreground rounded-md hover:bg-white/10']);

const versionItem = cva(['p-2 px-4 text-muted-foreground text-sm flex items-center gap-2']);

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
    <div className={dropdownContainer()}>
      <div className={userContainer()}>
        <button className={profileButton()}>
          <div className={profileImage()}>
            <User size={24} />
          </div>
        </button>
      </div>
      <div className={dropdownContent()}>
        {appVersion && (
          <div className={versionItem()}>
            <Info size={16} />
            <span>Version {appVersion}</span>
          </div>
        )}
        <div className={dropdownItem()} onClick={handleLogout}>
          <LogOut size={16} />
          <span>Logout</span>
        </div>
      </div>
    </div>
  );
};
