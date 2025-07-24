import { useAuthStore } from '../store/authStore';
import { getApiUrlWithProtocol } from '../config/api-config';

export interface EdgeUpdateData {
  name?: string;
  workspacepaths?: string[];
  isShellEnabled?: boolean;
  isFileSystemEnabled?: boolean;
}

export const updateEdge = async (edgeId: string, updateData: EdgeUpdateData) => {
  const { user, apiUrl: storeApiUrl } = useAuthStore.getState();
  const apiUrl = user?.apiUrl || storeApiUrl;
  
  if (!apiUrl || !user?.apiKey) {
    throw new Error('Missing API URL or authentication');
  }

  // Convert API URL to proper format with protocol
  const fullApiUrl = getApiUrlWithProtocol(apiUrl);

  const response = await fetch(`${fullApiUrl}/edge/${edgeId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': user.apiKey,
    },
    body: JSON.stringify(updateData),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to update edge: ${response.status} ${response.statusText} - ${errorText}`);
  }

  return await response.json();
};

export const renameEdge = async (edgeId: string, name: string) => {
  return updateEdge(edgeId, { name });
};