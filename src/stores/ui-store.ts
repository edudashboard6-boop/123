import { create } from 'zustand';
import type { ViewTab, DebateMode } from '@/lib/types';

// =============================================================================
// UI Store — global UI state that is NOT persisted to the server
// =============================================================================

interface UiStore {
  /** Currently active navigation tab */
  activeView: ViewTab;
  setActiveView: (view: ViewTab) => void;

  /** Whether the desktop sidebar is collapsed to icon-only mode */
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;

  /** Whether the mobile sidebar sheet is open */
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: (open: boolean) => void;

  /** Current debate orchestration mode */
  debateMode: DebateMode;
  setDebateMode: (mode: DebateMode) => void;

  /** True while the pipeline is processing a user message */
  isProcessing: boolean;
  setIsProcessing: (processing: boolean) => void;
}

export const useUiStore = create<UiStore>((set) => ({
  activeView: 'chat',
  setActiveView: (view) => set({ activeView: view }),

  sidebarCollapsed: false,
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  mobileSidebarOpen: false,
  setMobileSidebarOpen: (open) => set({ mobileSidebarOpen: open }),

  debateMode: 'fast',
  setDebateMode: (mode) => set({ debateMode: mode }),

  isProcessing: false,
  setIsProcessing: (processing) => set({ isProcessing: processing }),
}));
