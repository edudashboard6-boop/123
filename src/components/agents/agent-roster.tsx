'use client';

import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  type ElementType,
} from 'react';
import { toast } from 'sonner';
import {
  Bot,
  Hammer,
  Shield,
  Eye,
  PenTool,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  X,
  Settings,
  Info,
  Zap,
  Save,
  ExternalLink,
  GripVertical,
  Users,
} from 'lucide-react';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

import { useAgentStore } from '@/stores/agent-store';
import { useProviderStore } from '@/stores/provider-store';
import { useUiStore } from '@/stores/ui-store';
import { DEFAULT_AGENTS, BUILT_IN_TOOLS } from '@/lib/constants';
import type { AgentId, AgentConfig, LlmProvider } from '@/lib/types';

// =============================================================================
// Constants & Mappings
// =============================================================================

const AGENT_ICONS: Record<AgentId, ElementType> = {
  architect: Bot,
  forge: Hammer,
  sentinel: Shield,
  perception: Eye,
  scribe: PenTool,
};

const AGENT_STYLES: Record<
  AgentId,
  { borderColor: string; bgGradient: string; iconBg: string; accentText: string; badgeVariant: string }
> = {
  architect: {
    borderColor: 'border-l-violet-500/60',
    bgGradient: 'bg-gradient-to-br from-violet-500/[0.04] to-transparent',
    iconBg: 'bg-violet-500/15',
    accentText: 'text-violet-400',
    badgeVariant: 'bg-violet-500/15 text-violet-300 border-violet-500/20',
  },
  forge: {
    borderColor: 'border-l-blue-500/60',
    bgGradient: 'bg-gradient-to-br from-blue-500/[0.04] to-transparent',
    iconBg: 'bg-blue-500/15',
    accentText: 'text-blue-400',
    badgeVariant: 'bg-blue-500/15 text-blue-300 border-blue-500/20',
  },
  sentinel: {
    borderColor: 'border-l-red-500/60',
    bgGradient: 'bg-gradient-to-br from-red-500/[0.04] to-transparent',
    iconBg: 'bg-red-500/15',
    accentText: 'text-red-400',
    badgeVariant: 'bg-red-500/15 text-red-300 border-red-500/20',
  },
  perception: {
    borderColor: 'border-l-amber-500/60',
    bgGradient: 'bg-gradient-to-br from-amber-500/[0.04] to-transparent',
    iconBg: 'bg-amber-500/15',
    accentText: 'text-amber-400',
    badgeVariant: 'bg-amber-500/15 text-amber-300 border-amber-500/20',
  },
  scribe: {
    borderColor: 'border-l-green-500/60',
    bgGradient: 'bg-gradient-to-br from-green-500/[0.04] to-transparent',
    iconBg: 'bg-green-500/15',
    accentText: 'text-green-400',
    badgeVariant: 'bg-green-500/15 text-green-300 border-green-500/20',
  },
};

const TOOL_CATEGORIES: Record<string, string> = {
  information: 'Information',
  filesystem: 'Filesystem',
  devops: 'DevOps',
  system: 'System',
  quality: 'Quality',
  perception: 'Perception',
  data: 'Data',
  knowledge: 'Knowledge',
};

const AGENT_ORDER: AgentId[] = ['architect', 'forge', 'sentinel', 'perception', 'scribe'];

// =============================================================================
// Debounce hook
// =============================================================================

function useDebouncedCallback<A extends unknown[]>(
  callback: (...args: A) => unknown,
  delay: number,
): (...args: A) => void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const debounced = useCallback(
    (...args: A) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => callbackRef.current(...args), delay);
    },
    [delay],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return debounced;
}

// =============================================================================
// Agent Card Component
// =============================================================================

interface AgentCardProps {
  agent: AgentConfig;
  providers: LlmProvider[];
  onUpdate: (agentId: string, data: Partial<AgentConfig>) => Promise<void>;
  onNavigateToProviders: () => void;
}

function AgentCard({ agent, providers, onUpdate, onNavigateToProviders }: AgentCardProps) {
  const [cardExpanded, setCardExpanded] = useState(true);
  const [paramsOpen, setParamsOpen] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [localPrompt, setLocalPrompt] = useState(agent.systemPrompt);
  const [fallbackIds, setFallbackIds] = useState<string[]>([]);

  const defaultDef = useMemo(
    () => DEFAULT_AGENTS.find((d) => d.agentId === agent.agentId),
    [agent.agentId],
  );

  const style = AGENT_STYLES[agent.agentId];
  const IconComponent = AGENT_ICONS[agent.agentId];
  const availableProviders = providers.filter((p) => p.isActive);

  const selectedProvider = useMemo(
    () => providers.find((p) => p.id === agent.providerId),
    [providers, agent.providerId],
  );

  const availableModels = useMemo(
    () => selectedProvider?.models ?? [],
    [selectedProvider],
  );

  // Debounced save for temperature & max tokens
  const debouncedSave = useDebouncedCallback(
    async (data: Partial<AgentConfig>) => {
      try {
        await onUpdate(agent.agentId, data);
      } catch {
        toast.error(`Failed to save ${agent.name} parameters`);
      }
    },
    600,
  );

  const handleProviderChange = useCallback(
    async (providerId: string) => {
      try {
        const provider = providers.find((p) => p.id === providerId);
        const firstModel = provider?.models?.[0] ?? '';
        await onUpdate(agent.agentId, {
          providerId,
          modelId: firstModel,
        });
        toast.success(`${agent.name} provider updated`);
      } catch {
        toast.error(`Failed to update ${agent.name} provider`);
      }
    },
    [agent.agentId, agent.name, onUpdate, providers],
  );

  const handleModelChange = useCallback(
    async (modelId: string) => {
      try {
        await onUpdate(agent.agentId, { modelId });
        toast.success(`${agent.name} model updated`);
      } catch {
        toast.error(`Failed to update ${agent.name} model`);
      }
    },
    [agent.agentId, agent.name, onUpdate],
  );

  const handleTemperatureChange = useCallback(
    (value: number[]) => {
      const temp = value[0];
      debouncedSave({ temperature: temp });
    },
    [debouncedSave],
  );

  const handleMaxTokensChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      let val = parseInt(e.target.value, 10);
      if (isNaN(val)) val = 4096;
      val = Math.max(256, Math.min(131072, val));
      debouncedSave({ maxTokens: val });
    },
    [debouncedSave],
  );

  const handlePromptBlur = useCallback(async () => {
    if (localPrompt !== agent.systemPrompt) {
      try {
        await onUpdate(agent.agentId, { systemPrompt: localPrompt });
        toast.success(`${agent.name} prompt saved`);
      } catch {
        toast.error(`Failed to save ${agent.name} prompt`);
      }
    }
  }, [agent.agentId, agent.name, agent.systemPrompt, localPrompt, onUpdate]);

  const handlePromptReset = useCallback(async () => {
    if (!defaultDef) return;
    setLocalPrompt(defaultDef.systemPrompt);
    try {
      await onUpdate(agent.agentId, { systemPrompt: defaultDef.systemPrompt });
      toast.success(`${agent.name} prompt reset to default`);
    } catch {
      toast.error(`Failed to reset ${agent.name} prompt`);
    }
  }, [agent.agentId, agent.name, defaultDef, onUpdate]);

  const handleToolToggle = useCallback(
    async (toolId: string, checked: boolean) => {
      const newTools = checked
        ? [...agent.tools, toolId]
        : agent.tools.filter((t) => t !== toolId);
      try {
        await onUpdate(agent.agentId, { tools: newTools });
        toast.success(
          `${toolId} ${checked ? 'enabled' : 'disabled'} for ${agent.name}`,
        );
      } catch {
        toast.error(`Failed to update tools for ${agent.name}`);
      }
    },
    [agent.agentId, agent.name, agent.tools, onUpdate],
  );

  const handleActiveToggle = useCallback(
    async (checked: boolean) => {
      try {
        await onUpdate(agent.agentId, { is_active: checked });
        toast.success(`${agent.name} ${checked ? 'activated' : 'deactivated'}`);
      } catch {
        toast.error(`Failed to toggle ${agent.name}`);
      }
    },
    [agent.agentId, agent.name, onUpdate],
  );

  const handleAddFallback = useCallback(
    (providerId: string) => {
      if (!fallbackIds.includes(providerId)) {
        setFallbackIds((prev) => [...prev, providerId]);
      }
    },
    [fallbackIds],
  );

  const handleRemoveFallback = useCallback((providerId: string) => {
    setFallbackIds((prev) => prev.filter((id) => id !== providerId));
  }, []);

  // Group tools by category
  const toolsByCategory = useMemo(() => {
    const groups: Record<string, typeof BUILT_IN_TOOLS> = {};
    for (const tool of BUILT_IN_TOOLS) {
      if (!groups[tool.category]) groups[tool.category] = [];
      groups[tool.category].push(tool);
    }
    return groups;
  }, []);

  const fallbackProviders = providers.filter(
    (p) => p.isActive && p.id !== agent.providerId,
  );

  return (
    <Collapsible open={cardExpanded} onOpenChange={setCardExpanded}>
      <Card
        className={
          'border-l-4 border border-border/60 border-l-transparent rounded-xl overflow-hidden transition-all duration-200 ' +
          style.borderColor +
          ' ' +
          (cardExpanded ? style.bgGradient : 'bg-card/50') +
          ' hover:border-input/60'
        }
      >
        {/* ── Card Header (always visible) ── */}
        <CollapsibleTrigger asChild>
          <button className="w-full text-left">
            <div className="flex items-start gap-3 p-4 pb-3">
              {/* Icon */}
              <div
                className={
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ' +
                  style.iconBg
                }
              >
                <IconComponent className={'h-5 w-5 ' + style.accentText} />
              </div>

              {/* Name + Description */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground text-sm">
                    {agent.name}
                  </span>
                  <Badge
                    variant="outline"
                    className={
                      'text-[10px] px-1.5 py-0 h-4 font-medium border ' +
                      style.badgeVariant
                    }
                  >
                    {agent.agentId.toUpperCase()}
                  </Badge>
                  {agent.is_active ? (
                    <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/20 text-[10px] px-1.5 py-0 h-4">
                      Active
                    </Badge>
                  ) : (
                    <Badge className="bg-accent/15 text-muted-foreground/70 border-border/20 text-[10px] px-1.5 py-0 h-4">
                      Inactive
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground/70 leading-relaxed line-clamp-2">
                  {agent.description}
                </p>
              </div>

              {/* Right side: toggle + chevron */}
              <div className="flex items-center gap-2 shrink-0">
                <div
                  className="flex items-center gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Label
                    htmlFor={`active-${agent.agentId}`}
                    className="text-[11px] text-muted-foreground/70 hidden sm:block"
                  >
                    Active
                  </Label>
                  <Switch
                    id={`active-${agent.agentId}`}
                    checked={agent.is_active}
                    onCheckedChange={handleActiveToggle}
                    className="data-[state=checked]:bg-violet-600"
                  />
                </div>
                {cardExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground/70" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground/70" />
                )}
              </div>
            </div>
          </button>
        </CollapsibleTrigger>

        {/* ── Expandable Card Body ── */}
        <CollapsibleContent>
          <div className="px-4 pb-4">
            <Separator  />

            {/* ── Provider & Model Selection (KEY FEATURE) ── */}
            <section className="space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Zap className={'h-3.5 w-3.5 ' + style.accentText} />
                <span className="text-xs font-medium text-secondary-foreground">
                  Provider & Model
                </span>
              </div>

              {availableProviders.length === 0 ? (
                <div className="rounded-lg border border-dashed border-input bg-card/50 p-4 text-center">
                  <p className="text-xs text-muted-foreground/70 mb-2">
                    No providers configured yet
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-7 border-input text-secondary-foreground hover:"
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigateToProviders();
                    }}
                  >
                    <ExternalLink className="h-3 w-3 mr-1.5" />
                    Go to Providers
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Provider Select */}
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground/70 uppercase tracking-wider">
                      Provider
                    </Label>
                    <Select
                      value={agent.providerId || undefined}
                      onValueChange={handleProviderChange}
                    >
                      <SelectTrigger className="w-full h-9 bg-card/80 border-input/60 text-secondary-foreground text-sm focus:ring-violet-500/20 focus:border-violet-500/40">
                        <SelectValue placeholder="Select provider..." />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-input">
                        {availableProviders.map((p) => (
                          <SelectItem
                            key={p.id}
                            value={p.id}
                            className="text-secondary-foreground focus:"
                          >
                            <span className="flex items-center gap-2">
                              {p.name}
                              <Badge
                                variant="outline"
                                className={
                                  'text-[9px] px-1 py-0 h-3.5 ml-1 border ' +
                                  (p.isLocal
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                    : 'bg-sky-500/10 text-sky-400 border-sky-500/20')
                                }
                              >
                                {p.isLocal ? 'Local' : 'Cloud'}
                              </Badge>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Provider badge below */}
                    {selectedProvider && (
                      <div className="flex items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className={
                            'text-[9px] px-1.5 py-0 h-4 border ' +
                            (selectedProvider.isLocal
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : 'bg-sky-500/10 text-sky-400 border-sky-500/20')
                          }
                        >
                          {selectedProvider.isLocal ? 'Local' : 'Cloud'}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground/50">
                          {selectedProvider.models.length} models available
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Model Select */}
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground/70 uppercase tracking-wider">
                      Model
                    </Label>
                    <Select
                      value={agent.modelId || undefined}
                      onValueChange={handleModelChange}
                      disabled={!agent.providerId || availableModels.length === 0}
                    >
                      <SelectTrigger className="w-full h-9 bg-card/80 border-input/60 text-secondary-foreground text-sm focus:ring-violet-500/20 focus:border-violet-500/40">
                        <SelectValue placeholder="Select model..." />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-input">
                        {availableModels.map((model) => (
                          <SelectItem
                            key={model}
                            value={model}
                            className="text-secondary-foreground focus:"
                          >
                            {model}
                          </SelectItem>
                        ))}
                        {availableModels.length === 0 && agent.providerId && (
                          <div className="px-2 py-3 text-center text-xs text-muted-foreground/70">
                            No models configured for this provider
                          </div>
                        )}
                      </SelectContent>
                    </Select>

                    {/* Current model info */}
                    {agent.modelId && (
                      <p className="text-[10px] text-muted-foreground/50 truncate">
                        {selectedProvider?.name}: {agent.modelId}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* ── Fallback Chain (bonus) ── */}
              {availableProviders.length > 1 && (
                <div className="mt-2">
                  <Collapsible>
                    <CollapsibleTrigger className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70 hover:text-secondary-foreground transition-colors">
                      <GripVertical className="h-3 w-3" />
                      <span>Fallback Chain</span>
                      <ChevronDown className="h-3 w-3" />
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mt-2 space-y-2 rounded-lg border border-border/60 bg-background/40 p-3">
                        {fallbackIds.length === 0 ? (
                          <p className="text-[10px] text-muted-foreground/50">
                            No fallback providers configured.
                          </p>
                        ) : (
                          <div className="space-y-1.5">
                            {fallbackIds.map((fId) => {
                              const fp = providers.find((p) => p.id === fId);
                              return (
                                <div
                                  key={fId}
                                  className="flex items-center justify-between gap-2 rounded-md bg-card/60 px-2.5 py-1.5"
                                >
                                  <span className="text-xs text-muted-foreground">
                                    {fp?.name ?? fId}
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-5 w-5 p-0 text-muted-foreground/70 hover:text-red-400 hover:bg-red-500/10"
                                    onClick={() => handleRemoveFallback(fId)}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        <Select onValueChange={handleAddFallback}>
                          <SelectTrigger className="h-7 text-[11px] bg-card/80 border-input/50 text-muted-foreground/70">
                            <SelectValue placeholder="Add fallback provider..." />
                          </SelectTrigger>
                          <SelectContent className="bg-popover border-input">
                            {fallbackProviders
                              .filter((p) => !fallbackIds.includes(p.id))
                              .map((p) => (
                                <SelectItem
                                  key={p.id}
                                  value={p.id}
                                  className="text-xs text-secondary-foreground focus:"
                                >
                                  {p.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              )}
            </section>

            <Separator  />

            {/* ── Model Parameters (collapsible) ── */}
            <Collapsible open={paramsOpen} onOpenChange={setParamsOpen}>
              <CollapsibleTrigger className="flex items-center justify-between w-full group">
                <div className="flex items-center gap-2">
                  <Settings className="h-3.5 w-3.5 text-muted-foreground/70" />
                  <span className="text-xs font-medium text-secondary-foreground group-hover:text-foreground transition-colors">
                    Model Parameters
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground/50">
                    {agent.temperature.toFixed(1)} / {agent.maxTokens.toLocaleString()}
                  </span>
                  {paramsOpen ? (
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/70" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/70" />
                  )}
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-3 space-y-4 rounded-lg border border-border/60 bg-background/40 p-3">
                  {/* Temperature */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-[11px] text-muted-foreground/70 uppercase tracking-wider">
                        Temperature
                      </Label>
                      <span className={
                        'text-sm font-mono font-medium tabular-nums ' + style.accentText
                      }>
                        {agent.temperature.toFixed(1)}
                      </span>
                    </div>
                    <Slider
                      value={[agent.temperature]}
                      onValueChange={handleTemperatureChange}
                      min={0}
                      max={2}
                      step={0.1}
                      className="w-full [&_[data-slot=slider-range]]:bg-violet-500 [&_[data-slot=slider-thumb]]:border-violet-500"
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground/50">
                      <span>Precise (0.0)</span>
                      <span>Creative (2.0)</span>
                    </div>
                  </div>

                  <Separator  />

                  {/* Max Tokens */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-[11px] text-muted-foreground/70 uppercase tracking-wider">
                        Max Tokens
                      </Label>
                      <span className="text-[10px] text-muted-foreground/50">
                        256 – 131,072
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={256}
                        max={131072}
                        step={256}
                        value={agent.maxTokens}
                        onChange={handleMaxTokensChange}
                        className="h-8 bg-card/80 border-input/60 text-sm text-secondary-foreground font-mono tabular-nums focus:ring-violet-500/20 focus:border-violet-500/40"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground/70 hover:text-secondary-foreground shrink-0"
                        onClick={() => {
                          if (defaultDef) {
                            onUpdate(agent.agentId, {
                              maxTokens: defaultDef.defaultMaxTokens,
                            });
                          }
                        }}
                        title="Reset to default"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Separator  />

            {/* ── System Prompt (collapsible) ── */}
            <Collapsible open={promptOpen} onOpenChange={setPromptOpen}>
              <CollapsibleTrigger className="flex items-center justify-between w-full group">
                <div className="flex items-center gap-2">
                  <Save className="h-3.5 w-3.5 text-muted-foreground/70" />
                  <span className="text-xs font-medium text-secondary-foreground group-hover:text-foreground transition-colors">
                    System Prompt
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground/50">
                    {localPrompt.length.toLocaleString()} chars
                  </span>
                  {promptOpen ? (
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/70" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/70" />
                  )}
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-3 space-y-2 rounded-lg border border-border/60 bg-background/40 p-3">
                  <Textarea
                    value={localPrompt}
                    onChange={(e) => setLocalPrompt(e.target.value)}
                    onBlur={handlePromptBlur}
                    rows={6}
                    className="w-full bg-card/80 border-input/60 text-sm text-secondary-foreground leading-relaxed resize-y min-h-[100px] max-h-[300px] focus:ring-violet-500/20 focus:border-violet-500/40 placeholder:text-muted-foreground/50"
                    placeholder="Enter system prompt..."
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground/50">
                      {localPrompt.length.toLocaleString()} characters
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[10px] text-muted-foreground/70 hover:text-secondary-foreground gap-1"
                      onClick={handlePromptReset}
                    >
                      <RotateCcw className="h-3 w-3" />
                      Reset to Default
                    </Button>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Separator  />

            {/* ── Tool Permissions (collapsible) ── */}
            <Collapsible open={toolsOpen} onOpenChange={setToolsOpen}>
              <CollapsibleTrigger className="flex items-center justify-between w-full group">
                <div className="flex items-center gap-2">
                  <Info className="h-3.5 w-3.5 text-muted-foreground/70" />
                  <span className="text-xs font-medium text-secondary-foreground group-hover:text-foreground transition-colors">
                    Tool Permissions
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge
                    variant="outline"
                    className="text-[9px] px-1.5 py-0 h-4 border-input text-muted-foreground/70"
                  >
                    {agent.tools.length}/{BUILT_IN_TOOLS.length}
                  </Badge>
                  {toolsOpen ? (
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/70" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/70" />
                  )}
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-3 space-y-3 rounded-lg border border-border/60 bg-background/40 p-3">
                  {Object.entries(toolsByCategory).map(
                    ([category, tools]) => (
                      <div key={category}>
                        <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider font-medium mb-2">
                          {TOOL_CATEGORIES[category] ?? category}
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {tools.map((tool) => {
                            const isChecked = agent.tools.includes(tool.id);
                            return (
                              <Tooltip key={tool.id}>
                                <TooltipTrigger asChild>
                                  <label className="flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer hover:">
                                    <Checkbox
                                      checked={isChecked}
                                      onCheckedChange={(checked) =>
                                        handleToolToggle(
                                          tool.id,
                                          checked === true,
                                        )
                                      }
                                      className={
                                        'data-[state=checked]:bg-violet-600 data-[state=checked]:border-violet-600'
                                      }
                                    />
                                    <span
                                      className={
                                        'text-xs truncate ' +
                                        (isChecked
                                          ? 'text-secondary-foreground'
                                          : 'text-muted-foreground/70 group-hover/check:text-muted-foreground')
                                      }
                                    >
                                      {tool.name}
                                    </span>
                                  </label>
                                </TooltipTrigger>
                                <TooltipContent
                                  side="bottom"
                                  className="max-w-[260px]"
                                >
                                  <p className="font-medium mb-1">
                                    {tool.name}
                                  </p>
                                  <p className="text-muted-foreground leading-relaxed">
                                    {tool.description}
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            );
                          })}
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// =============================================================================
// Skeleton Card
// =============================================================================

function AgentCardSkeleton() {
  return (
    <Card className="border-l-4 border-l-violet-500/30 border border-border/60 rounded-xl">
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-5 w-9 rounded-full" />
        </div>
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
    </Card>
  );
}

// =============================================================================
// Main AgentRoster Component
// =============================================================================

export function AgentRoster() {
  const { agents, loading, fetchAgents, updateAgent, resetAgentsToDefaults } =
    useAgentStore();
  const { providers } = useProviderStore();
  const { setActiveView } = useUiStore();

  const handleResetAll = useCallback(async () => {
    try {
      await resetAgentsToDefaults();
      toast.success('All agents reset to defaults');
    } catch {
      toast.error('Failed to reset agents');
    }
  }, [resetAgentsToDefaults]);

  const handleNavigateToProviders = useCallback(() => {
    setActiveView('providers');
  }, [setActiveView]);

  // Fetch agents on mount
  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  // Sort agents by canonical order
  const sortedAgents = useMemo(() => {
    return [...agents].sort(
      (a, b) =>
        AGENT_ORDER.indexOf(a.agentId) - AGENT_ORDER.indexOf(b.agentId),
    );
  }, [agents]);

  return (
    <div className="h-full overflow-y-auto">
      <ScrollArea className="h-full">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
          {/* ── Header ── */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 border border-violet-500/20">
                <Users className="h-5 w-5 text-violet-400" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-foreground">
                  Agent Council
                </h1>
                <p className="mt-0.5 text-sm text-muted-foreground/70">
                  Configure specialized agents and their model assignments
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="self-start sm:self-auto h-8 px-3 text-xs border-input text-muted-foreground hover:"
              onClick={handleResetAll}
              disabled={loading}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset to Defaults
            </Button>
          </div>

          {/* ── Agent Grid ── */}
          {loading && agents.length === 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <AgentCardSkeleton key={i} />
              ))}
            </div>
          ) : sortedAgents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-card border border-border">
                <Users className="h-7 w-7 text-muted-foreground/50" />
              </div>
              <p className="text-sm text-muted-foreground/70">
                No agent configurations found. Initialize agents to get started.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {sortedAgents.map((agent) => (
                <AgentCard
                  key={agent.updatedAt}
                  agent={agent}
                  providers={providers}
                  onUpdate={updateAgent}
                  onNavigateToProviders={handleNavigateToProviders}
                />
              ))}
            </div>
          )}

          {/* Bottom padding for scroll */}
          <div className="h-8" />
        </div>
      </ScrollArea>
    </div>
  );
}
