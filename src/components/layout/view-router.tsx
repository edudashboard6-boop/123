'use client';

import React from 'react';
import { useUiStore } from '@/stores/ui-store';
import { ChatPanel } from '@/components/chat/chat-panel';
import { AgentRoster } from '@/components/agents/agent-roster';
import { ProviderManager } from '@/components/providers/provider-manager';
import { KnowledgeBase } from '@/components/knowledge/knowledge-base';
import { WorkspacePanel } from '@/components/workspace/workspace-panel';
import { ToolsPanel } from '@/components/tools/tools-panel';
import { SettingsPanel } from '@/components/settings/settings-panel';

export function ViewRouter() {
  const { activeView } = useUiStore();

  switch (activeView) {
    case 'chat':
      return <ChatPanel />;
    case 'agents':
      return <AgentRoster />;
    case 'providers':
      return <ProviderManager />;
    case 'knowledge':
      return <KnowledgeBase />;
    case 'workspace':
      return <WorkspacePanel />;
    case 'tools':
      return <ToolsPanel />;
    case 'settings':
      return <SettingsPanel />;
    default:
      return <ChatPanel />;
  }
}
