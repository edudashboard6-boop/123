'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Wrench,
  Plus,
  Server,
  Terminal,
  Globe,
  GitBranch,
  Search,
  Shield,
  Eye,
  Mic,
  Database,
  FileText,
  FileCode,
  Trash2,
  Edit,
  Check,
  X,
  ChevronRight,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Skeleton } from '@/components/ui/skeleton';

import { BUILT_IN_TOOLS } from '@/lib/constants';
import type { McpServer, TransportType } from '@/lib/types';

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const TOOL_ICONS: Record<string, React.ElementType> = {
  web_search: Search,
  filesystem_read: FileText,
  filesystem_write: FileCode,
  git_operations: GitBranch,
  terminal_exec: Terminal,
  code_lint: Shield,
  code_test: Check,
  ocr_extract: Eye,
  vision_analyze: Eye,
  audio_transcribe: Mic,
  database_query: Database,
  rag_search: Database,
};

const CATEGORY_LABELS: Record<string, string> = {
  information: 'Information',
  filesystem: 'Filesystem',
  devops: 'DevOps',
  system: 'System',
  quality: 'Quality',
  perception: 'Perception',
  data: 'Data',
  knowledge: 'Knowledge',
};

const CATEGORY_COLORS: Record<string, string> = {
  information: 'bg-blue-900/25 text-blue-400 border-blue-700/30',
  filesystem: 'bg-emerald-900/25 text-emerald-400 border-emerald-700/30',
  devops: 'bg-orange-900/25 text-orange-400 border-orange-700/30',
  system: 'bg-red-900/25 text-red-400 border-red-700/30',
  quality: 'bg-cyan-900/25 text-cyan-400 border-cyan-700/30',
  perception: 'bg-amber-900/25 text-amber-400 border-amber-700/30',
  data: 'bg-purple-900/25 text-purple-400 border-purple-700/30',
  knowledge: 'bg-violet-900/25 text-violet-400 border-violet-700/30',
};

const TRANSPORT_COLORS: Record<string, string> = {
  stdio: 'bg-accent/50 text-secondary-foreground border-border/50',
  sse: 'bg-emerald-900/25 text-emerald-400 border-emerald-700/30',
  'streamable-http': 'bg-amber-900/25 text-amber-400 border-amber-700/30',
};

function toolIconForId(id: string): React.ElementType {
  return TOOL_ICONS[id] ?? Wrench;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function ToolsPanel() {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [toolToggles, setToolToggles] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    BUILT_IN_TOOLS.forEach((t) => { init[t.id] = true; });
    return init;
  });

  // Add/Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<McpServer | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    transport: 'stdio' as TransportType,
    command: '',
    args: '',
    url: '',
    envVars: [{ key: '', value: '' }],
    isActive: true,
  });

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<McpServer | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ---------------------------------------------------------------------------
  // Fetch MCP servers
  // ---------------------------------------------------------------------------

  const fetchServers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/mcp-servers');
      if (!res.ok) throw new Error('Failed to fetch servers');
      const data: McpServer[] = await res.json();
      setServers(data);
    } catch {
      setServers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  // ---------------------------------------------------------------------------
  // Group built-in tools by category
  // ---------------------------------------------------------------------------

  const toolsByCategory = useMemo(() => {
    const map = new Map<string, typeof BUILT_IN_TOOLS>();
    BUILT_IN_TOOLS.forEach((tool) => {
      const cat = tool.category;
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(tool);
    });
    return map;
  }, []);

  // ---------------------------------------------------------------------------
  // Dialog helpers
  // ---------------------------------------------------------------------------

  const openAddDialog = useCallback(() => {
    setEditingServer(null);
    setForm({
      name: '',
      description: '',
      transport: 'stdio',
      command: '',
      args: '',
      url: '',
      envVars: [{ key: '', value: '' }],
      isActive: true,
    });
    setDialogOpen(true);
  }, []);

  const openEditDialog = useCallback((server: McpServer) => {
    setEditingServer(server);
    setForm({
      name: server.name,
      description: server.description,
      transport: server.transport,
      command: server.command,
      args: server.args.join(', '),
      url: server.url,
      envVars: Object.entries(server.envVars).map(([key, value]) => ({ key, value })),
      isActive: server.isActive,
    });
    setDialogOpen(true);
  }, []);

  const updateForm = useCallback(<K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  // ---------------------------------------------------------------------------
  // Save (create or update)
  // ---------------------------------------------------------------------------

  const handleSave = useCallback(async () => {
    if (!form.name.trim()) {
      toast.error('Server name is required');
      return;
    }

    const envObj: Record<string, string> = {};
    form.envVars.forEach(({ key, value }) => {
      if (key.trim()) envObj[key.trim()] = value;
    });

    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      transport: form.transport,
      command: form.command.trim(),
      args: form.args.split(',').map((a) => a.trim()).filter(Boolean),
      url: form.url.trim(),
      envVars: envObj,
      isActive: form.isActive,
    };

    setSaving(true);
    try {
      const isEdit = !!editingServer;
      const url = isEdit
        ? `/api/mcp-servers/${editingServer.id}`
        : '/api/mcp-servers';
      const method = isEdit ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Failed to ${isEdit ? 'update' : 'create'} server`);
      }

      const saved: McpServer = await res.json();
      if (isEdit) {
        setServers((prev) => prev.map((s) => (s.id === saved.id ? saved : s)));
        toast.success(`Updated ${saved.name}`);
      } else {
        setServers((prev) => [...prev, saved]);
        toast.success(`Added ${saved.name}`);
      }
      setDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [form, editingServer]);

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/mcp-servers/${deleteTarget.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setServers((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      toast.success(`Deleted ${deleteTarget.name}`);
    } catch {
      toast.error('Failed to delete server');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }, [deleteTarget]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <TooltipProvider>
      <div className="flex h-full flex-col min-h-0">
        {/* Header */}
        <div className="flex flex-col gap-1 border-b border-border/60 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-600/15 border border-violet-500/20">
                <Wrench className="h-4.5 w-4.5 text-violet-400" />
              </div>
              <div>
                <h1 className="text-base font-semibold text-foreground">Tools & Integrations</h1>
                <p className="text-xs text-muted-foreground/70">Configure MCP servers and tool permissions</p>
              </div>
            </div>
            <Button
              size="sm"
              className="bg-violet-600 hover:bg-violet-500 text-white gap-1.5"
              onClick={openAddDialog}
            >
              <Plus className="h-3.5 w-3.5" />
              Add Server
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <div className="mx-auto w-full max-w-5xl space-y-6 p-6">

            {/* Built-in Tools */}
            <Card className="bg-card/80 border-border/60">
              <CardHeader className="pb-3">
                <div>
                  <CardTitle className="text-sm font-semibold text-secondary-foreground">Built-in Tools</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground/70 mt-0.5">
                    {BUILT_IN_TOOLS.length} tools available to agents. Toggle to enable or disable.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <Accordion type="multiple" defaultValue={Object.keys(toolsByCategory)} className="w-full">
                  {Array.from(toolsByCategory.entries()).map(([category, tools]) => (
                    <AccordionItem key={category} value={category} className="border-border/40">
                      <AccordionTrigger className="py-2.5 hover:no-underline">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={`text-[10px] h-4 px-1.5 border ${CATEGORY_COLORS[category] ?? CATEGORY_COLORS.system}`}
                          >
                            {CATEGORY_LABELS[category] ?? category}
                          </Badge>
                          <span className="text-xs text-muted-foreground/70">{tools.length} tools</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-1">
                          {tools.map((tool) => {
                            const Icon = toolIconForId(tool.id);
                            return (
                              <div
                                key={tool.id}
                                className="group flex items-center justify-between gap-3 rounded-lg px-3 py-2 hover:"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md">
                                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-medium text-secondary-foreground">{tool.name}</p>
                                    <p className="text-[11px] text-muted-foreground/50 truncate max-w-md">{tool.description}</p>
                                  </div>
                                </div>
                                <Switch
                                  checked={toolToggles[tool.id] ?? true}
                                  onCheckedChange={(checked) =>
                                    setToolToggles((prev) => ({ ...prev, [tool.id]: checked }))
                                  }
                                  className="data-[state=checked]:bg-violet-600"
                                />
                              </div>
                            );
                          })}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>

            {/* MCP Servers */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-secondary-foreground">MCP Servers</h2>
                <span className="text-xs text-muted-foreground/70">{servers.length} configured</span>
              </div>

              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <Skeleton key={i} className="h-40 rounded-xl bg-card/60" />
                  ))}
                </div>
              ) : servers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl">
                    <Server className="h-6 w-6 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">No MCP servers configured</p>
                  <p className="mt-1 text-xs text-muted-foreground/50 max-w-xs text-center">
                    Add MCP servers to extend agent capabilities with external tools and services.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {servers.map((server) => (
                    <Card
                      key={server.id}
                      className="group relative bg-card/80 border-border/60 hover:border-violet-500/30 hover:shadow-[0_0_20px_rgba(139,92,246,0.06)] transition-all duration-200 overflow-hidden"
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                              <Server className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-secondary-foreground truncate" title={server.name}>
                                {server.name}
                              </p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span
                                  className={`inline-block h-1.5 w-1.5 rounded-full ${
                                    server.isActive ? 'bg-emerald-500' : 'bg-red-500'
                                  }`}
                                />
                                <span className="text-[11px] text-muted-foreground/70">
                                  {server.isActive ? 'Active' : 'Inactive'}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground/70 hover:text-secondary-foreground hover:bg-muted"
                                  onClick={() => openEditDialog(server)}
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="left" >
                                Edit server
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground/70 hover:text-red-400 hover:bg-red-500/10"
                                  onClick={() => setDeleteTarget(server)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="left" >
                                Delete server
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </div>

                        {server.description && (
                          <p className="text-[11px] text-muted-foreground/70 mb-3 line-clamp-2 leading-relaxed">
                            {server.description}
                          </p>
                        )}

                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            variant="outline"
                            className={`text-[10px] h-4 px-1.5 border ${TRANSPORT_COLORS[server.transport] ?? TRANSPORT_COLORS.stdio}`}
                          >
                            {server.transport}
                          </Badge>
                          {server.tools.length > 0 && (
                            <Badge
                              variant="outline"
                              className="text-[10px] h-4 px-1.5 border-input/40"
                            >
                              {server.tools.length} tools
                            </Badge>
                          )}
                        </div>

                        <div className="mt-3 rounded-md">
                          <p className="text-[10px] font-mono text-muted-foreground/70 truncate">
                            {server.transport === 'stdio'
                              ? `$ ${server.command} ${server.args.join(' ')}`
                              : server.url}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

          </div>
        </ScrollArea>

        {/* Add/Edit Server Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="bg-popover border-border max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-popover-foreground">
                {editingServer ? 'Edit MCP Server' : 'Add MCP Server'}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {editingServer
                  ? 'Update the MCP server configuration.'
                  : 'Connect a new MCP server to extend agent capabilities.'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Name */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => updateForm('name', e.target.value)}
                  placeholder="e.g., github-mcp"
                  className="h-8"
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Description</Label>
                <Input
                  value={form.description}
                  onChange={(e) => updateForm('description', e.target.value)}
                  placeholder="What does this server do?"
                  className="h-8"
                />
              </div>

              {/* Transport Type */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Transport Type</Label>
                <Select
                  value={form.transport}
                  onValueChange={(v) => updateForm('transport', v as TransportType)}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="stdio" className="text-secondary-foreground">
                      <div className="flex items-center gap-2">
                        <Terminal className="h-3 w-3" /> stdio
                      </div>
                    </SelectItem>
                    <SelectItem value="sse" className="text-secondary-foreground">
                      <div className="flex items-center gap-2">
                        <Globe className="h-3 w-3" /> SSE
                      </div>
                    </SelectItem>
                    <SelectItem value="streamable-http" className="text-secondary-foreground">
                      <div className="flex items-center gap-2">
                        <Globe className="h-3 w-3" /> Streamable HTTP
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Command (stdio) */}
              {form.transport === 'stdio' && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Command</Label>
                  <Input
                    value={form.command}
                    onChange={(e) => updateForm('command', e.target.value)}
                    placeholder="npx, python, uvx, ..."
                    className="h-8"
                  />
                </div>
              )}

              {/* Args (stdio) */}
              {form.transport === 'stdio' && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Arguments (comma-separated)</Label>
                  <Input
                    value={form.args}
                    onChange={(e) => updateForm('args', e.target.value)}
                    placeholder="-y, @modelcontextprotocol/server-filesystem, /path"
                    className="h-8"
                  />
                </div>
              )}

              {/* URL (sse / streamable-http) */}
              {form.transport !== 'stdio' && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Server URL</Label>
                  <Input
                    value={form.url}
                    onChange={(e) => updateForm('url', e.target.value)}
                    placeholder="http://localhost:8080/mcp"
                    className="h-8"
                  />
                </div>
              )}

              <Separator  />

              {/* Environment Variables */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Environment Variables</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px] text-violet-400 hover:text-violet-300 hover:bg-violet-500/10 gap-1"
                    onClick={() => setForm((prev) => ({ ...prev, envVars: [...prev.envVars, { key: '', value: '' }] }))}
                  >
                    <Plus className="h-2.5 w-2.5" />
                    Add
                  </Button>
                </div>
                <div className="space-y-2">
                  {form.envVars.map((env, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        value={env.key}
                        onChange={(e) => {
                          const updated = [...form.envVars];
                          updated[i] = { ...updated[i], key: e.target.value };
                          setForm((prev) => ({ ...prev, envVars: updated }));
                        }}
                        placeholder="KEY"
                        className="h-7"
                      />
                      <span className="text-muted-foreground/50 text-xs">=</span>
                      <Input
                        value={env.value}
                        onChange={(e) => {
                          const updated = [...form.envVars];
                          updated[i] = { ...updated[i], value: e.target.value };
                          setForm((prev) => ({ ...prev, envVars: updated }));
                        }}
                        placeholder="value"
                        className="h-7"
                      />
                      {form.envVars.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground/50 hover:text-red-400 hover:bg-red-500/10 shrink-0"
                          onClick={() => {
                            const updated = form.envVars.filter((_, idx) => idx !== i);
                            setForm((prev) => ({ ...prev, envVars: updated }));
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <Separator  />

              {/* Active toggle */}
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Active</Label>
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(checked) => updateForm('isActive', checked)}
                  className="data-[state=checked]:bg-violet-600"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button
                variant="outline"
                
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                className="bg-violet-600 hover:bg-violet-500 text-white"
                onClick={handleSave}
                disabled={saving || !form.name.trim()}
              >
                {saving ? 'Saving...' : editingServer ? 'Update Server' : 'Add Server'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
          <AlertDialogContent className="bg-popover border-border">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-popover-foreground">Delete MCP Server</AlertDialogTitle>
              <AlertDialogDescription className="text-muted-foreground">
                Are you sure you want to delete <span className="text-secondary-foreground font-medium">{deleteTarget?.name}</span>? This will disconnect the server and remove its configuration.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-500 text-white"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
