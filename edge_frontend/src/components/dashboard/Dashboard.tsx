import React from 'react';
import WSMessageViewer from './WSMessageViewer';
import WorkspacePathsList from './WorkspacePathsList';
import SyncedFilesList from './SyncedFilesList';
import { Typography } from '@mui/material';
import Grid from '@mui/material/Grid'; // Grid v2
import UserMenu from '../header/UserMenu';
import styled from 'styled-components';

export const Dashboard: React.FC = () => {
  return (
    <DashboardContainer>
      <UserMenu />

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <WorkspacePathsList />
        </Grid>
        <Grid size={{ xs: 12, lg: 6 }}>
          <SyncedFilesList />
        </Grid>
        <Grid size={12}>
          <WSMessageViewer />
        </Grid>
      </Grid>
    </DashboardContainer>
  );
};

const DashboardContainer = styled.div`
  padding: 0px 1rem 1rem 1rem;
`;

export default Dashboard;
