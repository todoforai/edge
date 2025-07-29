import pythonService from './python-service';

export interface EdgeUpdateData {
  name?: string;
  workspacepaths?: string[];
  isShellEnabled?: boolean;
  isFileSystemEnabled?: boolean;
}

export const renameEdge = async (name: string) => {
    await pythonService.callPython('update_edge_config', { name });
};