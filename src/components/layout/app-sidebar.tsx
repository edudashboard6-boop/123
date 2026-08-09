'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  MessageSquare,
  Users,
  Server,
  Database,
  Wrench,
  Settings,
  FolderOpen,
  Hexagon,
  Plus,
  MoreVertical,
  Trash2,
} from 'lucide-react';
import type { ViewTab } from '@/lib/types';
import { useUiStore } from '@/stores/ui-store';
import { useChatStore } from '@/stores/chat-store';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

// -----------------------------------------------------------------------------
// Navigation item definition
// -----------------------------------------------------------------------------

interface NavItem {
  view: ViewTab;
  label: string;
  icon: React.ElementType;
}

const NAV_ITEMS: NavItem[] = [
  { view: 'chat', label: 'Chat', icon: MessageSquare },
  { view: 'agents', label: 'Agents', icon: Users },
  { view: 'providers', label: 'Providers', icon: Server },
  { view: 'knowledge', label: 'Knowledge', icon: Database },
  { view: 'workspace', label: 'Workspace', icon: FolderOpen },
  { view: 'tools', label: 'Tools', icon: Wrench },
  { view: 'settings', label: 'Settings', icon: Settings },
];

// -----------------------------------------------------------------------------
// SidebarContent — shared inner content for desktop & mobile sheet
// -----------------------------------------------------------------------------

export function SidebarContent() {
  const { activeView, setActiveView } = useUiStore();
  const { sessions, createSession, deleteSession, activeSessionId, setActiveSessionId, loadSessionMessages } =
    useChatStore();

  const recentSessions = sessions.slice(0, 5);

  const handleNewChat = async () => {
    try {
      const id = await createSession('New Session');
      setActiveSessionId(id);
      setActiveView('chat');
    } catch {
      // error handled by store
    }
  };

  const handleSelectSession = async (id: string) => {
    setActiveSessionId(id);
    setActiveView('chat');
    await loadSessionMessages(id);
  };

  const handleDeleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteSession(id);
  };

  return (
    <div className="flex h-full w-full flex-col bg-card">
      {/* ------------------------------------------------------------------ */}
      {/* Branding */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-center gap-3 px-4 py-5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-600/20">
          <Hexagon className="h-5 w-5 text-violet-400" strokeWidth={2.5} />
        </div>
        <span className="text-lg font-bold tracking-wider text-violet-400">
          NEXUS
        </span>
      </div>

      <Separator  />

      {/* ------------------------------------------------------------------ */}
      {/* Navigation */}
      {/* ------------------------------------------------------------------ */}
      <nav className="flex flex-col gap-1 px-3 pt-3 pb-2">
        {NAV_ITEMS.map((item) => {
          const isActive = activeView === item.view;
          const Icon = item.icon;

          return (
            <Tooltip key={item.view}>
              <TooltipTrigger asChild>
                <motion.button
                  whileHover={{ x: 2 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  onClick={() => setActiveView(item.view)}
                  className={cn(
                    'relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50',
                    isActive
                      ? 'bg-violet-600/15 text-violet-300'
                      : 'text-muted-foreground hover:bg-muted/70 hover:text-secondary-foreground',
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="nexus-active-nav"
                      className="absolute inset-0 rounded-lg bg-violet-600/15"
                      transition={{
                        type: 'spring',
                        stiffness: 350,
                        damping: 30,
                      }}
                    />
                  )}
                  <Icon className={cn('relative z-10 h-4 w-4', isActive ? 'text-violet-400' : '')} />
                  <span className="relative z-10">{item.label}</span>
                </motion.button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                {item.label}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </nav>

      <Separator  />

      {/* ------------------------------------------------------------------ */}
      {/* Sessions */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col flex-1 min-h-0">
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
            Sessions
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground/70 hover:text-violet-400 hover:text-secondary-foreground"
            onClick={handleNewChat}
          >
            <Plus className="h-4 w-4" />
            <span className="sr-only">New Chat</span>
          </Button>
        </div>

        <ScrollArea className="flex-1 px-2">
          <div className="flex flex-col gap-0.5 pb-4">
            {recentSessions.length === 0 && (
              <p className="px-3 py-4 text-xs text-muted-foreground/50 text-center">
                No sessions yet
              </p>
            )}
            {recentSessions.map((session) => {
              const isActive = activeSessionId === session.id;
              return (
                <div
                  key={session.id}
                  onClick={() => handleSelectSession(session.id)}
                  className={cn(
                    'group relative flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors cursor-pointer',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50',
                    isActive
                      ? 'bg-muted text-foreground'
                      : 'text-muted-foreground/70 hover:bg-muted/50 hover:text-secondary-foreground',
                  )}
                >
                  <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-60" />
                  <span className="flex-1 truncate text-xs">{session.title}</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          'inline-flex items-center justify-center h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity rounded-md',
                          'text-muted-foreground/70 hover:text-red-400 hover:bg-accent',
                        )}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical className="h-3 w-3" />
                        <span className="sr-only">Session actions</span>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="w-36 bg-popover border-border"
                    >
                      <DropdownMenuItem
                        className="text-muted-foreground focus:text-red-400 focus:bg-accent"
                        onClick={(e) => handleDeleteSession(session.id, e)}
                      >
                        <Trash2 className="mr-2 h-3.5 w-3.5" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Footer badge */}
      {/* ------------------------------------------------------------------ */}
      <Separator  />
      <div className="flex items-center gap-2 px-4 py-3">
        <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-[11px] text-muted-foreground/70 font-medium">System Online</span>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// NavIconOnly — icons shown when sidebar is collapsed
// -----------------------------------------------------------------------------

function NavIconOnly() {
  const { activeView, setActiveView } = useUiStore();

  return (
    <div className="flex h-full w-full flex-col items-center bg-card py-3">
      {/* Brand icon */}
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-600/20 mb-4">
        <Hexagon className="h-5 w-5 text-violet-400" strokeWidth={2.5} />
      </div>

      <Separator className="w-8" />

      {/* Nav icons */}
      <nav className="flex flex-col items-center gap-1">
        {NAV_ITEMS.map((item) => {
          const isActive = activeView === item.view;
          const Icon = item.icon;
          return (
            <Tooltip key={item.view}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setActiveView(item.view)}
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50',
                    isActive
                      ? 'bg-violet-600/15 text-violet-400'
                      : 'text-muted-foreground/70 hover:bg-muted/70 hover:text-secondary-foreground',
                  )}
                >
                  <Icon className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                {item.label}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </nav>

      {/* Spacer + online indicator */}
      <div className="flex-1" />
      <div className="flex items-center justify-center py-3">
        <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// AppSidebar — desktop sidebar (w-64 expanded, w-16 collapsed)
// -----------------------------------------------------------------------------

export function AppSidebar() {
  const { sidebarCollapsed } = useUiStore();

  return (
    <motion.aside
      animate={{ width: sidebarCollapsed ? 64 : 256 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="hidden md:block h-full shrink-0 border-r border-border/80"
    >
      {sidebarCollapsed ? <NavIconOnly /> : <SidebarContent />}
    </motion.aside>
  );
}
