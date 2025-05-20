import React from 'react';
import WSMessageViewer from './WSMessageViewer';
import WorkspacePathsList from './WorkspacePathsList';
import SyncedFilesList from './SyncedFilesList';
import { Typography } from '@mui/material';
import Grid from '@mui/material/Grid';  // Grid v2
import UserMenu from '../header/UserMenu';

export const Dashboard: React.FC = () => {
  return (
    <div>
      <UserMenu />
      
      <Typography variant="h4" gutterBottom>
        TODOforAI Edge Dashboard
      </Typography>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <WorkspacePathsList />
        </Grid>
        <Grid size={12}>
          <SyncedFilesList />
        </Grid>
        <Grid size={12}>
          <WSMessageViewer />
        </Grid>
      </Grid>
    </div>
  );
};

export default Dashboard;
