'use client';

import React from 'react';
import { useTheme } from 'next-themes';
import {
  PanelLeft,
  MessageSquare,
  Users,
  Server,
  Database,
  Wrench,
  Settings,
  FolderOpen,
  Zap,
  Shield,
  Eye,
  Circle,
  Moon,
  Sun,
} from 'lucide-react';
import type { ViewTab, DebateMode } from '@/lib/types';
import { useUiStore } from '@/stores/ui-store';
import { useChatStore } from '@/stores/chat-store';
import { useAgentStore } from '@/stores/agent-store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

const VIEW_META: Record<ViewTab, { label: string; icon: React.ElementType }> = {
  chat: { label: 'Chat', icon: MessageSquare },
  agents: { label: 'Agents', icon: Users },
  providers: { label: 'Providers', icon: Server },
  knowledge: { label: 'Knowledge Base', icon: Database },
  workspace: { label: 'Workspace', icon: FolderOpen },
  tools: { label: 'Tools & MCP', icon: Wrench },
  settings: { label: 'Settings', icon: Settings },
};

const DEBATE_MODES: { mode: DebateMode; label: string; icon: React.ElementType; desc: string }[] = [
  { mode: 'fast', label: 'Fast', icon: Zap, desc: 'Single agent, quick response' },
  { mode: 'council', label: 'Council', icon: Shield, desc: 'Multi-agent debate & consensus' },
  { mode: 'redteam', label: 'Red Team', icon: Eye, desc: 'Adversarial review with Sentinel' },
];

const AGENT_DOT_COLORS = [
  'bg-violet-500',
  'bg-blue-500',
  'bg-red-500',
  'bg-amber-500',
  'bg-emerald-500',
];

function formatCost(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  if (cost < 1) return `$${cost.toFixed(2)}`;
  return `$${cost.toFixed(2)}`;
}

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
  return String(tokens);
}

export function AppHeader() {
  const { theme, setTheme } = useTheme();
  const { activeView, debateMode, setDebateMode, toggleSidebar, setMobileSidebarOpen } = useUiStore();
  const { totalCost, totalTokens } = useChatStore();
  const { agents } = useAgentStore();

  const meta = VIEW_META[activeView];
  const TitleIcon = meta.icon;
  const isChat = activeView === 'chat';

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card/80 px-4 backdrop-blur-md">
      {/* Sidebar toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
        onClick={() => {
          if (window.innerWidth < 768) {
            setMobileSidebarOpen(true);
          } else {
            toggleSidebar();
          }
        }}
      >
        <PanelLeft className="h-4 w-4" />
        <span className="sr-only">Toggle sidebar</span>
      </Button>

      {/* Current view title */}
      <div className="flex items-center gap-2 min-w-0">
        <TitleIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <h1 className="text-sm font-semibold text-foreground truncate">
          {meta.label}
        </h1>
      </div>

      {/* Debate mode selector — only on chat view */}
      {isChat && (
        <>
          {/* Desktop debate mode */}
          <div className="hidden sm:flex items-center ml-4">
            <div className="flex items-center rounded-lg border border-border bg-background/50 p-0.5">
              {DEBATE_MODES.map((dm) => {
                const ModeIcon = dm.icon;
                const isActive = debateMode === dm.mode;
                return (
                  <button
                    key={dm.mode}
                    onClick={() => setDebateMode(dm.mode)}
                    title={dm.desc}
                    className={cn(
                      'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50',
                      isActive
                        ? 'bg-violet-600/20 text-violet-300 shadow-sm'
                        : 'text-muted-foreground/70 hover:text-secondary-foreground hover:bg-muted/50',
                    )}
                  >
                    <ModeIcon className="h-3 w-3" />
                    <span>{dm.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mobile debate mode — icons only */}
          <div className="flex sm:hidden items-center ml-2">
            <div className="flex items-center rounded-lg border border-border bg-background/50 p-0.5">
              {DEBATE_MODES.map((dm) => {
                const ModeIcon = dm.icon;
                const isActive = debateMode === dm.mode;
                return (
                  <button
                    key={dm.mode}
                    onClick={() => setDebateMode(dm.mode)}
                    title={dm.label}
                    className={cn(
                      'flex items-center justify-center rounded-md p-1.5 transition-all',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50',
                      isActive
                        ? 'bg-violet-600/20 text-violet-300'
                        : 'text-muted-foreground/70 hover:text-secondary-foreground',
                    )}
                  >
                    <ModeIcon className="h-3.5 w-3.5" />
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Session metrics */}
      <div className="hidden sm:flex items-center gap-3">
        {isChat && (totalTokens > 0 || totalCost > 0) && (
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="h-6 gap-1.5 border-input bg-muted/50 text-muted-foreground text-[11px] font-mono px-2"
            >
              <span>{formatTokens(totalTokens)}</span>
              <span className="text-muted-foreground/50">tokens</span>
            </Badge>
            <Badge
              variant="outline"
              className="h-6 gap-1.5 border-input bg-muted/50 text-muted-foreground text-[11px] font-mono px-2"
            >
              <span>{formatCost(totalCost)}</span>
            </Badge>
          </div>
        )}
      </div>

      <Separator orientation="vertical" className="hidden sm:block h-5" />

      {/* Theme toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        <span className="sr-only">Toggle theme</span>
      </Button>

      {/* Active agent indicator dots */}
      <div className="flex items-center gap-1.5" title="Active agents">
        {agents.length > 0
          ? AGENT_DOT_COLORS.map((color, i) => {
              const active = agents[i]?.is_active ?? false;
              return (
                <Circle
                  key={i}
                  className={cn(
                    'h-2 w-2 transition-all duration-300',
                    color,
                    active ? 'opacity-100 scale-100' : 'opacity-20 scale-75',
                  )}
                  fill={active ? undefined : 'none'}
                />
              );
            })
          : AGENT_DOT_COLORS.map((color, i) => (
              <Circle
                key={i}
                className={cn('h-2 w-2 opacity-20 scale-75', color)}
                fill="none"
              />
            ))}
      </div>
    </header>
  );
}
