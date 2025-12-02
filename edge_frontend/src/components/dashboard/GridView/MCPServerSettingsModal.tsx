import React, { useState } from 'react';
import { AlertCircle, Plus, X } from 'lucide-react';
import type { MCPEdgeExecutable } from '../../../types/mcp.types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const settingsContent = "flex flex-col gap-6";
const formGroup = "flex flex-col gap-2";
const helpText = "text-xs text-muted-foreground";
const errorMessage = "text-destructive text-xs flex items-center gap-1";
const argumentsList = "flex flex-col gap-2";
const argumentRow = "flex gap-2 items-center";
const envList = "flex flex-col gap-2";
const envRow = "flex gap-2 items-center";

interface MCPServerSettingsModalProps {
  instance: MCPEdgeExecutable;
  isOpen: boolean;
  onClose: () => void;
  onSave: (instance: MCPEdgeExecutable) => void;
}

export const MCPServerSettingsModal: React.FC<MCPServerSettingsModalProps> = ({
  instance,
  isOpen,
  onClose,
  onSave
}) => {
  const [editingInstance, setEditingInstance] = useState<MCPEdgeExecutable>(() => {
    // Pre-fill environment variables from registry if this is a new installation
    const isNewInstallation = (instance.id || '').startsWith('temp-');
    if (isNewInstallation && instance.env) {
      // Convert array of env var names to key-value pairs with empty values
      const envObject: Record<string, string> = {};
      if (Array.isArray(instance.env)) {
        instance.env.forEach(envVar => {
          envObject[envVar] = '';
        });
      } else {
        // If it's already an object, use it as-is
        Object.assign(envObject, instance.env);
      }
      return { ...instance, env: envObject };
    }
    return { ...instance };
  });

  const isNewInstallation = (instance.id || '').startsWith('temp-');
  const hasServerIdError = editingInstance.serverId.includes('_');

  const handleSave = () => {
    if (hasServerIdError) return;
    onSave(editingInstance);
    onClose();
  };

  const handleEnvChange = (key: string, value: string) => {
    const newEnv = { ...editingInstance.env };
    newEnv[key] = value;
    setEditingInstance({ ...editingInstance, env: newEnv });
  };

  const handleEnvKeyChange = (oldKey: string, newKey: string) => {
    const newEnv = { ...editingInstance.env };
    const value = newEnv[oldKey];
    delete newEnv[oldKey];
    if (newKey) newEnv[newKey] = value;
    setEditingInstance({ ...editingInstance, env: newEnv });
  };

  const handleArgsChange = (index: number, value: string) => {
    const newArgs = [...(editingInstance.args || [])];
    newArgs[index] = value;
    setEditingInstance({ ...editingInstance, args: newArgs });
  };

  const addEnvVariable = () => {
    setEditingInstance({ 
      ...editingInstance, 
      env: { ...editingInstance.env, '': '' }
    });
  };

  const addArgument = () => {
    setEditingInstance({ 
      ...editingInstance, 
      args: [...(editingInstance.args || []), '']
    });
  };

  const removeArgument = (index: number) => {
    const newArgs = [...(editingInstance.args || [])];
    newArgs.splice(index, 1);
    setEditingInstance({ ...editingInstance, args: newArgs });
  };

  const removeEnvVariable = (key: string) => {
    const newEnv = { ...editingInstance.env };
    delete newEnv[key];
    setEditingInstance({ ...editingInstance, env: newEnv });
  };

  const title = `${isNewInstallation ? 'Install' : 'Settings'} - ${instance.serverId}`;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Configure MCP server settings
          </DialogDescription>
        </DialogHeader>

        <div className={settingsContent}>
          <div className={formGroup}>
            <Label htmlFor="serverId">Server ID</Label>
            <Input
              id="serverId"
              type="text"
              value={editingInstance.serverId}
              onChange={(e) => setEditingInstance({ ...editingInstance, serverId: e.target.value })}
              placeholder="Server identifier"
              className={hasServerIdError ? "border-destructive focus-visible:ring-destructive" : ""}
            />
            {hasServerIdError && (
              <div className={errorMessage}>
                <AlertCircle size={14} />
                Underscore (_) characters are not allowed in Server ID
              </div>
            )}
            {isNewInstallation && !hasServerIdError && (
              <div className={helpText}>
                Customize the server ID to install multiple instances
              </div>
            )}
          </div>

          <div className={formGroup}>
            <Label htmlFor="command">Command</Label>
            <Input
              id="command"
              type="text"
              value={editingInstance.command || ''}
              onChange={(e) => setEditingInstance({ ...editingInstance, command: e.target.value })}
              placeholder="e.g., node, python, npx"
            />
          </div>

          <div className={formGroup}>
            <Label>Arguments</Label>
            <div className={argumentsList}>
              {(editingInstance.args || []).map((arg, index) => (
                <div key={index} className={argumentRow}>
                  <Input
                    type="text"
                    value={arg}
                    onChange={(e) => handleArgsChange(index, e.target.value)}
                    placeholder={`Argument ${index + 1}`}
                  />
                  <Button variant="outline" size="icon" onClick={() => removeArgument(index)}>
                    <X size={16} />
                  </Button>
                </div>
              ))}
              <Button variant="outline" className="border-dashed" onClick={addArgument}>
                <Plus size={16} />
                Add Argument
              </Button>
            </div>
          </div>

          <div className={formGroup}>
            <Label>Environment Variables</Label>
            <div className={envList}>
              {Object.entries(editingInstance.env || {}).map(([key, value]) => (
                <div key={key} className={envRow}>
                  <Input
                    type="text"
                    value={key}
                    onChange={(e) => handleEnvKeyChange(key, e.target.value)}
                    placeholder="Variable name"
                  />
                  <Input
                    type="text"
                    value={String(value)}
                    onChange={(e) => handleEnvChange(key, e.target.value)}
                    placeholder="Variable value"
                  />
                  <Button variant="outline" size="icon" onClick={() => removeEnvVariable(key)}>
                    <X size={16} />
                  </Button>
                </div>
              ))}
              <Button variant="outline" className="border-dashed" onClick={addEnvVariable}>
                <Plus size={16} />
                Add Environment Variable
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={hasServerIdError}>
            {isNewInstallation ? 'Install Server' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};