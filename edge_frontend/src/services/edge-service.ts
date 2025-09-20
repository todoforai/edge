import pythonService from './python-service';

export const renameEdge = async (name: string) => {
    await pythonService.callPython('update_edge_config', { name });
};