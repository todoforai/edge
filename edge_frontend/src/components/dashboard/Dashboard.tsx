import React from 'react';
import WSMessageViewer from './WSMessageViewer';
import WorkspacePathsList from './WorkspacePathsList';
import SyncedFilesList from './SyncedFilesList';
import { Typography, Grid } from '@mui/material';
import UserMenu from '../header/UserMenu';

export const Dashboard: React.FC = () => {
  return (
    <div>
      <UserMenu />
      
      <Typography variant="h4" gutterBottom>
        TODOforAI Edge Dashboard
      </Typography>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <WorkspacePathsList />
        </Grid>
        <Grid item xs={12}>
          <SyncedFilesList />
        </Grid>
        <Grid item xs={12}>
          <WSMessageViewer />
        </Grid>
      </Grid>
    </div>
  );
};

export default Dashboard;
