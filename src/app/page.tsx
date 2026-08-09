'use client';

import React, { useEffect } from 'react';
import { useUiStore } from '@/stores/ui-store';
import { useChatStore } from '@/stores/chat-store';
import { useProviderStore } from '@/stores/provider-store';
import { useAgentStore } from '@/stores/agent-store';
import { useIsMobile } from '@/hooks/use-mobile';
import { AppSidebar, SidebarContent } from '@/components/layout/app-sidebar';
import { AppHeader } from '@/components/layout/app-header';
import { ViewRouter } from '@/components/layout/view-router';
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from '@/components/ui/sheet';
import { Toaster } from '@/components/ui/sonner';

export default function Page() {
  const { mobileSidebarOpen, setMobileSidebarOpen } = useUiStore();
  const isMobile = useIsMobile();

  const fetchSessions = useChatStore((s) => s.fetchSessions);
  const fetchProviders = useProviderStore((s) => s.fetchProviders);
  const fetchAgents = useAgentStore((s) => s.fetchAgents);

  useEffect(() => {
    fetchSessions();
    fetchProviders();
    fetchAgents();
  }, [fetchSessions, fetchProviders, fetchAgents]);

  useEffect(() => {
    if (!isMobile && mobileSidebarOpen) {
      setMobileSidebarOpen(false);
    }
  }, [isMobile, mobileSidebarOpen, setMobileSidebarOpen]);

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background text-foreground">
      {/* Desktop Sidebar — always rendered, collapses to icons */}
      {!isMobile && <AppSidebar />}

      {/* Mobile Sidebar (Sheet/Drawer) */}
      {isMobile && (
        <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
          <SheetContent
            side="left"
            className="w-72 p-0 bg-card border-border"
          >
            <SheetTitle className="sr-only">NEXUS Navigation</SheetTitle>
            <SidebarContent />
          </SheetContent>
        </Sheet>
      )}

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col min-w-0">
        <AppHeader />
        <main className="flex-1 overflow-hidden">
          <ViewRouter />
        </main>
      </div>

      {/* Toast Notifications */}
      <Toaster position="bottom-right" />
    </div>
  );
}
