'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useProviderStore } from '@/stores/provider-store';
import { PROVIDER_TYPES } from '@/lib/constants';
import type { LlmProvider, ProviderType } from '@/lib/types';

import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

import {
  Plus,
  Server,
  Wifi,
  Edit,
  Trash2,
  TestTube,
  Eye,
  EyeOff,
  Globe,
  HardDrive,
  Check,
  X,
  Loader2,
  ExternalLink,
  Key,
  Settings,
  Cloud,
  BrainCircuit,
  Zap,
  Box,
  Cpu,
  Flame,
  Rabbit,
  CircleDot,
  Sparkles,
  Download,
} from 'lucide-react';

// =============================================================================
// Provider icon & color mappings
// =============================================================================

interface ProviderVisual {
  icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
}

const PROVIDER_VISUALS: Record<ProviderType, ProviderVisual> = {
  openai: { icon: Sparkles, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  anthropic: { icon: BrainCircuit, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  google: { icon: Cloud, color: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/20' },
  mistral: { icon: Zap, color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
  groq: { icon: Flame, color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
  together: { icon: CircleDot, color: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/20' },
  ollama: { icon: Rabbit, color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
  lmstudio: { icon: Cpu, color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
  vllm: { icon: Server, color: 'text-fuchsia-400', bg: 'bg-fuchsia-500/10', border: 'border-fuchsia-500/20' },
  llamacpp: { icon: Box, color: 'text-lime-400', bg: 'bg-lime-500/10', border: 'border-lime-500/20' },
  koboldcpp: { icon: HardDrive, color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
  custom: { icon: Settings, color: 'text-muted-foreground', bg: 'bg-primary/10', border: 'border-border/20' },
};

// =============================================================================
// Form state type
// =============================================================================

interface ProviderFormData {
  name: string;
  type: ProviderType;
  baseUrl: string;
  apiKey: string;
  models: string[];
  isActive: boolean;
}

const EMPTY_FORM: ProviderFormData = {
  name: '',
  type: 'openai',
  baseUrl: '',
  apiKey: '',
  models: [],
  isActive: true,
};

// =============================================================================
// Discovery result type
// =============================================================================

interface DiscoveredProvider {
  port: number;
  baseUrl: string;
  models: string[];
  type: string;
  name: string;
}

// =============================================================================
// Animation variants
// =============================================================================

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.06,
      duration: 0.4,
      ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
    },
  }),
  exit: { opacity: 0, y: -10, transition: { duration: 0.2 } },
};

const discoveryCardVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    transition: { delay: i * 0.08, duration: 0.3 },
  }),
  exit: { opacity: 0, scale: 0.95, transition: { duration: 0.15 } },
};

// =============================================================================
// Skeleton grid for loading state
// =============================================================================

function ProviderSkeletonGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border/60 bg-card p-5">
          <div className="flex items-start gap-3">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
          <div className="mt-4 flex items-center gap-2">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-20" />
          </div>
          <Separator className="my-4" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-8 rounded-md" />
            <Skeleton className="h-8 w-8 rounded-md" />
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// Empty state
// =============================================================================

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center justify-center py-24 px-4"
    >
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-violet-500/10 border border-violet-500/20 mb-6">
        <Server className="h-9 w-9 text-violet-400" />
      </div>
      <h3 className="text-xl font-semibold text-foreground mb-2">No providers configured</h3>
      <p className="text-sm text-muted-foreground text-center max-w-md mb-8">
        Add your first LLM provider to get started. Connect to cloud APIs like OpenAI and Anthropic, or discover local servers running Ollama, LM Studio, and more.
      </p>
      <div className="flex gap-3">
        <Button onClick={onAdd} className="bg-violet-600 hover:bg-violet-500 text-white gap-2">
          <Plus className="h-4 w-4" />
          Add Provider
        </Button>
      </div>
    </motion.div>
  );
}

// =============================================================================
// Provider Card
// =============================================================================

function ProviderCard({
  provider,
  index,
  onEdit,
  onTest,
  onDelete,
  onConfigureModels,
  testingId,
}: {
  provider: LlmProvider;
  index: number;
  onEdit: (p: LlmProvider) => void;
  onTest: (id: string) => void;
  onDelete: (p: LlmProvider) => void;
  onConfigureModels: (p: LlmProvider) => void;
  testingId: string | null;
}) {
  const visual = PROVIDER_VISUALS[provider.type] ?? PROVIDER_VISUALS.custom;
  const Icon = visual.icon;
  const isTesting = testingId === provider.id;

  const typeLabel = PROVIDER_TYPES.find((t) => t.value === provider.type)?.label ?? provider.type;

  return (
    <motion.div
      custom={index}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      layout
    >
      <Card className="group relative overflow-hidden border-border/60 bg-card hover:border-violet-500/30 transition-all duration-300 hover:shadow-[0_0_20px_-4px_rgba(139,92,246,0.15)] py-0 gap-0">
        {/* Hover glow effect */}
        <div className="pointer-events-none absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-violet-500/5 via-transparent to-transparent" />

        <CardHeader className="pb-3 pt-5 px-5">
          <div className="flex items-start gap-3">
            {/* Provider icon */}
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${visual.bg} ${visual.border}`}>
              <Icon className={`h-5 w-5 ${visual.color}`} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-foreground text-sm font-semibold truncate">
                  {provider.name}
                </CardTitle>
                {/* Status indicator */}
                <span className="relative flex h-2 w-2 shrink-0">
                  <span
                    className={`absolute inline-flex h-full w-full rounded-full ${
                      provider.isActive ? 'bg-emerald-400' : 'bg-red-500'
                    }`}
                  />
                  <span
                    className={`relative inline-flex h-2 w-2 rounded-full ${
                      provider.isActive ? 'bg-emerald-400' : 'bg-red-500'
                    } animate-ping ${
                      provider.isActive ? 'opacity-75' : 'opacity-0'
                    }`}
                  />
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 h-5 border-input text-muted-foreground font-normal"
                >
                  {typeLabel}
                </Badge>
                {provider.isLocal && (
                  <Badge className="text-[10px] px-1.5 py-0 h-5 bg-amber-500/15 text-amber-400 border-amber-500/25 hover:bg-amber-500/20 font-normal">
                    <HardDrive className="h-2.5 w-2.5 mr-1" />
                    Local
                  </Badge>
                )}
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 h-5 border-input text-muted-foreground font-normal"
                >
                  {provider.models.length} model{provider.models.length !== 1 ? 's' : ''}
                </Badge>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-5 pb-3">
          {/* Base URL */}
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70 truncate group-hover:text-muted-foreground transition-colors">
                  <Globe className="h-3 w-3 shrink-0" />
                  <span className="truncate">{provider.baseUrl || 'No URL configured'}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" >
                {provider.baseUrl || 'No URL configured'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Models list or CTA */}
          {provider.models.length === 0 ? (
            <button
              onClick={() => onConfigureModels(provider)}
              className="mt-3 w-full flex items-center justify-center gap-2 rounded-lg border border-dashed border-violet-500/30 bg-violet-500/5 px-3 py-2.5 text-xs text-violet-400 hover:bg-violet-500/10 hover:border-violet-500/50 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Configure Models
            </button>
          ) : (
            <div className="mt-3 flex flex-wrap gap-1">
              {provider.models.slice(0, 3).map((model) => (
                <Badge
                  key={model}
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0 h-5"
                >
                  {model.length > 24 ? model.slice(0, 24) + '…' : model}
                </Badge>
              ))}
              {provider.models.length > 3 && (
                <Badge
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0 h-5"
                >
                  +{provider.models.length - 3} more
                </Badge>
              )}
            </div>
          )}
        </CardContent>

        <Separator  />

        <CardFooter className="px-5 py-3 gap-2">
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground hover:"
                  onClick={() => onEdit(provider)}
                >
                  <Edit className="h-3.5 w-3.5" />
                  <span className="sr-only">Edit</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" >
                Edit connection
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-violet-400 hover:bg-violet-500/10"
                  onClick={() => onConfigureModels(provider)}
                >
                  <Download className="h-3.5 w-3.5" />
                  <span className="sr-only">Configure models</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" >
                Configure models
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-violet-400 hover:bg-violet-500/10"
                  onClick={() => onTest(provider.id)}
                  disabled={isTesting}
                >
                  {isTesting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <TestTube className="h-3.5 w-3.5" />
                  )}
                  <span className="sr-only">Test connection</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" >
                Test connection
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 ml-auto"
                  onClick={() => onDelete(provider)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="sr-only">Delete</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" >
                Delete provider
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardFooter>
      </Card>
    </motion.div>
  );
}

// =============================================================================
// Provider Form Dialog — Two-step wizard: (1) Connection → (2) Model selection
// =============================================================================

function ProviderFormDialog({
  open,
  onOpenChange,
  editingProvider,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingProvider: LlmProvider | null;
  onSave: (data: ProviderFormData) => Promise<void>;
}) {
  const [form, setForm] = useState<ProviderFormData>(EMPTY_FORM);
  const [showApiKey, setShowApiKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  // Step 2 state — model fetching/selection
  const [fetchedModels, setFetchedModels] = useState<string[]>([]);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [customModel, setCustomModel] = useState('');

  const isEditing = editingProvider !== null;
  const isLocal = PROVIDER_TYPES.find((t) => t.value === form.type)?.isLocal ?? false;

  // Populate form when editing or resetting
  useEffect(() => {
    if (editingProvider) {
      setForm({
        name: editingProvider.name,
        type: editingProvider.type,
        baseUrl: editingProvider.baseUrl,
        apiKey: editingProvider.apiKey,
        models: editingProvider.models,
        isActive: editingProvider.isActive,
      });
      setStep(1); // Editing stays on step 1 (models configured via separate dialog)
    } else {
      setForm(EMPTY_FORM);
      setStep(1);
    }
    setShowApiKey(false);
    setFetchedModels([]);
    setSelectedModels([]);
    setFetchError('');
    setCustomModel('');
  }, [editingProvider, open]);

  // Auto-fill base URL when type changes
  const handleTypeChange = useCallback(
    (value: string) => {
      const type = value as ProviderType;
      const def = PROVIDER_TYPES.find((t) => t.value === type);
      setForm((prev) => ({
        ...prev,
        type,
        baseUrl: def?.defaultBaseUrl ?? '',
      }));
    },
    []
  );

  // --- Step 2: Fetch models from the provider API ---
  const handleFetchModels = useCallback(async () => {
    setFetching(true);
    setFetchError('');
    try {
      const res = await fetch('/api/providers/probe-models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: form.type, baseUrl: form.baseUrl, apiKey: form.apiKey }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Failed to fetch models');
      }
      const data = await res.json();
      const models: string[] = data.models;
      if (models.length === 0) {
        setFetchError('No models found. The API responded but returned an empty list.');
      } else {
        setFetchedModels(models);
        setSelectedModels(models); // Auto-select all
      }
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to fetch models');
    } finally {
      setFetching(false);
    }
  }, [form.type, form.baseUrl, form.apiKey]);

  const toggleModel = useCallback((model: string) => {
    setSelectedModels((prev) =>
      prev.includes(model) ? prev.filter((m) => m !== model) : [...prev, model]
    );
  }, []);

  const addCustomModel = useCallback(() => {
    const trimmed = customModel.trim();
    if (trimmed && !selectedModels.includes(trimmed)) {
      setSelectedModels((prev) => [...prev, trimmed]);
      setCustomModel('');
    }
  }, [customModel, selectedModels]);

  const allModels = useMemo(() => {
    return [...new Set([...fetchedModels, ...selectedModels])].sort();
  }, [fetchedModels, selectedModels]);

  // --- Validate step 1 and advance to step 2 ---
  const handleNext = useCallback(() => {
    if (!form.name.trim()) {
      toast.error('Provider name is required');
      return;
    }
    if (!form.baseUrl.trim()) {
      toast.error('Base URL is required');
      return;
    }
    if (!isLocal && !form.apiKey.trim() && form.type !== 'custom') {
      toast.error('API key is required for cloud providers');
      return;
    }
    setStep(2);
    // Auto-fetch models when advancing to step 2 (unless local with no URL)
    if (form.baseUrl.trim()) {
      handleFetchModels();
    }
  }, [form, isLocal, handleFetchModels]);

  // --- Final save ---
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const dataToSave = {
        ...form,
        models: isEditing ? form.models : selectedModels,
      };
      await onSave(dataToSave);
      onOpenChange(false);
      toast.success(isEditing ? 'Provider updated' : 'Provider added', {
        description: `${form.name} has been ${isEditing ? 'updated' : 'added'}${!isEditing ? ` with ${selectedModels.length} model${selectedModels.length !== 1 ? 's' : ''}.` : ''}`,
      });
    } catch (err) {
      toast.error(isEditing ? 'Failed to update provider' : 'Failed to add provider', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setSaving(false);
    }
  }, [form, selectedModels, isEditing, onSave, onOpenChange]);

  const canSave = isEditing || selectedModels.length > 0;

  // =========================================================================
  // STEP 1: Connection Details
  // =========================================================================
  const step1 = (
    <>
      <DialogHeader>
        <DialogTitle className="text-popover-foreground">
          {isEditing ? 'Edit Provider' : 'Add Provider'}
        </DialogTitle>
        <DialogDescription className="text-muted-foreground">
          {isEditing
            ? 'Update the connection settings for this provider.'
            : 'Configure a new LLM provider. You\'ll select models next.'}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-5 py-2">
        {/* Name */}
        <div className="space-y-2">
          <Label htmlFor="provider-name" className="text-secondary-foreground text-sm">Name</Label>
          <Input
            id="provider-name"
            placeholder="e.g. My GPT-4o Instance"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            
          />
        </div>

        {/* Provider Type */}
        <div className="space-y-2">
          <Label className="text-secondary-foreground text-sm">Provider Type</Label>
          <Select value={form.type} onValueChange={handleTypeChange}>
            <SelectTrigger >
              <SelectValue placeholder="Select a provider type" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-input">
              <SelectGroup>
                <SelectLabel className="text-muted-foreground/70 text-xs">Cloud Providers</SelectLabel>
                {PROVIDER_TYPES.filter((t) => !t.isLocal).map((t) => (
                  <SelectItem key={t.value} value={t.value} className="text-secondary-foreground focus:">
                    {t.label}
                  </SelectItem>
                ))}
              </SelectGroup>
              <SelectGroup>
                <SelectLabel className="text-muted-foreground/70 text-xs">Local Providers</SelectLabel>
                {PROVIDER_TYPES.filter((t) => t.isLocal).map((t) => (
                  <SelectItem key={t.value} value={t.value} className="text-secondary-foreground focus:">
                    {t.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        {/* Base URL */}
        <div className="space-y-2">
          <Label htmlFor="provider-url" className="text-secondary-foreground text-sm">Base URL</Label>
          <Input
            id="provider-url"
            placeholder="https://api.example.com/v1"
            value={form.baseUrl}
            onChange={(e) => setForm((p) => ({ ...p, baseUrl: e.target.value }))}
            
          />
          {form.type !== 'custom' && (
            <p className="text-[11px] text-muted-foreground/70">
              Default URL for {PROVIDER_TYPES.find((t) => t.value === form.type)?.label} — modify if using a proxy or self-hosted instance.
            </p>
          )}
        </div>

        {/* API Key */}
        <div className="space-y-2">
          <Label htmlFor="provider-key" className="text-secondary-foreground text-sm">
            <span className="flex items-center gap-1.5">
              <Key className="h-3.5 w-3.5" />
              API Key
            </span>
          </Label>
          <div className="relative">
            <Input
              id="provider-key"
              type={showApiKey ? 'text' : 'password'}
              placeholder={isLocal ? 'Not required for local providers' : 'sk-...'}
              value={form.apiKey}
              onChange={(e) => setForm((p) => ({ ...p, apiKey: e.target.value }))}
              
              disabled={isLocal}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground/70 hover:text-secondary-foreground"
              onClick={() => setShowApiKey(!showApiKey)}
              disabled={isLocal}
            >
              {showApiKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </Button>
          </div>
          {isLocal && (
            <p className="text-[11px] text-amber-400/80 flex items-center gap-1">
              <HardDrive className="h-3 w-3" />
              Not required for local providers
            </p>
          )}
        </div>

        {/* Active toggle */}
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-secondary-foreground text-sm">Active</Label>
            <p className="text-[11px] text-muted-foreground/70">Inactive providers won\'t be available to agents.</p>
          </div>
          <Switch
            checked={form.isActive}
            onCheckedChange={(checked) => setForm((p) => ({ ...p, isActive: checked }))}
            className="data-[state=checked]:bg-violet-600"
          />
        </div>
      </div>

      <DialogFooter className="pt-4 border-t border-border">
        <Button
          variant="outline"
          onClick={() => onOpenChange(false)}
          className="border-input text-secondary-foreground hover:"
        >
          Cancel
        </Button>
        <Button
          onClick={isEditing ? handleSave : handleNext}
          disabled={isEditing ? saving : false}
          className="bg-violet-600 hover:bg-violet-500 text-white min-w-[100px]"
        >
          {isEditing ? (saving ? (<><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving…</>) : 'Save Changes') : 'Next: Select Models'}
        </Button>
      </DialogFooter>
    </>
  );

  // =========================================================================
  // STEP 2: Model Selection (only for new providers)
  // =========================================================================
  const step2 = (
    <>
      <DialogHeader>
        <DialogTitle className="text-popover-foreground">Select Models</DialogTitle>
        <DialogDescription className="text-muted-foreground">
          Choose which models to enable for <span className="text-secondary-foreground font-medium">{form.name}</span>.
          Models are being fetched from the API.
        </DialogDescription>
      </DialogHeader>

      <div className="flex-1 overflow-y-auto space-y-4 py-1">
        {/* Fetch status / re-fetch button */}
        <Button
          type="button"
          variant="outline"
          className="w-full border-dashed border-input hover:border-violet-500/50 text-secondary-foreground hover:text-violet-300 hover:bg-violet-500/5 gap-2 h-10"
          onClick={handleFetchModels}
          disabled={fetching}
        >
          {fetching ? (
            <><Loader2 className="h-4 w-4 animate-spin" />Fetching models…</>
          ) : (
            <><Download className="h-4 w-4" />{fetchedModels.length > 0 ? 'Re-fetch Models from API' : 'Fetch Available Models from API'}</>
          )}
        </Button>

        {fetchError && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
            <p className="text-xs text-red-400">{fetchError}</p>
            <p className="text-[11px] text-red-400/60 mt-1">
              {isLocal
                ? 'Make sure your local server is running and accessible at the configured URL.'
                : 'Check your API key and base URL. You can still add models manually below.'}
            </p>
          </div>
        )}

        {fetchedModels.length > 0 && !fetchError && (
          <p className="text-[11px] text-emerald-400/80">
            <Check className="h-3 w-3 inline mr-1" />
            Fetched {fetchedModels.length} model{fetchedModels.length !== 1 ? 's' : ''} from the API
          </p>
        )}

        {/* Model list */}
        {allModels.length > 0 && (
          <>
            <div className="flex items-center justify-between">
              <Label className="text-secondary-foreground text-sm">Models ({selectedModels.length} selected)</Label>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px] text-muted-foreground/70 hover:text-violet-400 hover:bg-violet-500/10 px-2"
                  onClick={() => setSelectedModels(allModels)}
                >
                  Select all
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px] text-muted-foreground/70 hover:text-muted-foreground hover:"
                  onClick={() => setSelectedModels([])}
                >
                  Clear
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-1 max-h-52 overflow-y-auto pr-1">
              {allModels.map((model) => (
                <label
                  key={model}
                  className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 hover:"
                >
                  <Checkbox
                    checked={selectedModels.includes(model)}
                    onCheckedChange={() => toggleModel(model)}
                    className="border-border data-[state=checked]:bg-violet-600 data-[state=checked]:border-violet-600"
                  />
                  <span className="text-xs text-secondary-foreground truncate">{model}</span>
                </label>
              ))}
            </div>
          </>
        )}

        {/* Custom model input */}
        <div className="space-y-2">
          <Label className="text-muted-foreground text-xs">Or add a model manually:</Label>
          <div className="flex gap-2">
            <Input
              placeholder="e.g. gpt-4o-2024-08-06"
              value={customModel}
              onChange={(e) => setCustomModel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCustomModel();
                }
              }}
              
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0 border-input text-muted-foreground hover:text-foreground hover:"
              onClick={addCustomModel}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Selected models as badges */}
        {selectedModels.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {selectedModels.map((model) => (
              <Badge
                key={model}
                variant="secondary"
                className="text-[11px] px-2 py-0.5 h-6 bg-violet-500/15 text-violet-300 border-violet-500/25 hover:bg-violet-500/25 font-normal gap-1"
              >
                {model.length > 24 ? model.slice(0, 24) + '…' : model}
                <button
                  type="button"
                  className="ml-0.5 hover:text-violet-100 transition-colors"
                  onClick={() => toggleModel(model)}
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      <DialogFooter className="pt-4 border-t border-border">
        <Button
          variant="outline"
          onClick={() => setStep(1)}
          className="border-input text-secondary-foreground hover:"
        >
          Back
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving || !canSave}
          className="bg-violet-600 hover:bg-violet-500 text-white min-w-[100px]"
        >
          {saving ? (
            <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving…</>
          ) : (
            `Add with ${selectedModels.length} Model${selectedModels.length !== 1 ? 's' : ''}`
          )}
        </Button>
      </DialogFooter>
    </>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-popover border-border text-foreground sm:max-w-lg max-h-[85vh] flex flex-col">
        {step === 1 ? step1 : step2}
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// Model Configuration Dialog — Step 2: Fetch & select models for a provider
// =============================================================================

function ModelConfigDialog({
  open,
  onOpenChange,
  provider,
  onUpdate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: LlmProvider | null;
  onUpdate: (id: string, data: { models: string[] }) => Promise<void>;
}) {
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [fetchedModels, setFetchedModels] = useState<string[]>([]);
  const [customModel, setCustomModel] = useState('');
  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fetchError, setFetchError] = useState('');

  // Sync selected models with provider when dialog opens
  useEffect(() => {
    if (provider) {
      setSelectedModels(provider.models);
      setFetchedModels([]);
      setFetchError('');
      setCustomModel('');
    }
  }, [provider, open]);

  const allModels = useMemo(() => {
    const combined = [...new Set([...fetchedModels, ...selectedModels])];
    return combined.sort();
  }, [fetchedModels, selectedModels]);

  const handleFetchModels = useCallback(async () => {
    if (!provider) return;
    setFetching(true);
    setFetchError('');
    try {
      const res = await fetch(`/api/providers/${provider.id}/fetch-models`, {
        method: 'POST',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Failed to fetch models');
      }
      const data = await res.json();
      const models: string[] = data.models;
      if (models.length === 0) {
        setFetchError('No models found. The API responded but returned an empty list.');
      } else {
        setFetchedModels(models);
        // Auto-select all fetched models
        setSelectedModels((prev) => [...new Set([...prev, ...models])]);
      }
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to fetch models');
    } finally {
      setFetching(false);
    }
  }, [provider]);

  const toggleModel = useCallback((model: string) => {
    setSelectedModels((prev) =>
      prev.includes(model)
        ? prev.filter((m) => m !== model)
        : [...prev, model]
    );
  }, []);

  const addCustomModel = useCallback(() => {
    const trimmed = customModel.trim();
    if (trimmed && !selectedModels.includes(trimmed)) {
      setSelectedModels((prev) => [...prev, trimmed]);
      setCustomModel('');
    }
  }, [customModel, selectedModels]);

  const selectAll = useCallback(() => {
    setSelectedModels(allModels);
  }, [allModels]);

  const deselectAll = useCallback(() => {
    setSelectedModels([]);
  }, []);

  const handleSave = useCallback(async () => {
    if (!provider) return;
    setSaving(true);
    try {
      await onUpdate(provider.id, { models: selectedModels });
      onOpenChange(false);
      toast.success('Models updated', {
        description: `${selectedModels.length} model${selectedModels.length !== 1 ? 's' : ''} configured for ${provider.name}.`,
      });
    } catch (err) {
      toast.error('Failed to save models', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setSaving(false);
    }
  }, [provider, selectedModels, onUpdate, onOpenChange]);

  if (!provider) return null;
  const isLocal = provider.isLocal;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-popover border-border text-foreground sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-popover-foreground">Configure Models</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Fetch and select available models for <span className="text-secondary-foreground font-medium">{provider.name}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-1">
          {/* Fetch button */}
          <Button
            type="button"
            variant="outline"
            className="w-full border-dashed border-input hover:border-violet-500/50 text-secondary-foreground hover:text-violet-300 hover:bg-violet-500/5 gap-2 h-10"
            onClick={handleFetchModels}
            disabled={fetching}
          >
            {fetching ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Fetching models…
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                {fetchedModels.length > 0 ? 'Re-fetch Models from API' : 'Fetch Available Models from API'}
              </>
            )}
          </Button>

          {fetchError && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
              <p className="text-xs text-red-400">{fetchError}</p>
              <p className="text-[11px] text-red-400/60 mt-1">
                {isLocal
                  ? 'Make sure your local server is running and accessible at the configured URL.'
                  : 'Check your API key and base URL. Some providers may require specific permissions.'}
              </p>
            </div>
          )}

          {fetchedModels.length > 0 && (
            <p className="text-[11px] text-emerald-400/80">
              <Check className="h-3 w-3 inline mr-1" />
              Fetched {fetchedModels.length} model{fetchedModels.length !== 1 ? 's' : ''} from the API
            </p>
          )}

          {/* Model list */}
          {allModels.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <Label className="text-secondary-foreground text-sm">
                  Models ({selectedModels.length} selected)
                </Label>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px] text-muted-foreground/70 hover:text-violet-400 hover:bg-violet-500/10 px-2"
                    onClick={selectAll}
                  >
                    Select all
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px] text-muted-foreground/70 hover:text-muted-foreground hover:"
                    onClick={deselectAll}
                  >
                    Clear
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-1 max-h-52 overflow-y-auto pr-1">
                {allModels.map((model) => (
                  <label
                    key={model}
                    className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 hover:"
                  >
                    <Checkbox
                      checked={selectedModels.includes(model)}
                      onCheckedChange={() => toggleModel(model)}
                      className="border-border data-[state=checked]:bg-violet-600 data-[state=checked]:border-violet-600"
                    />
                    <span className="text-xs text-secondary-foreground truncate">{model}</span>
                  </label>
                ))}
              </div>
            </>
          )}

          {/* Custom model input */}
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs">Or add a model manually:</Label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. gpt-4o-2024-08-06"
                value={customModel}
                onChange={(e) => setCustomModel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCustomModel();
                  }
                }}
                
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0 border-input text-muted-foreground hover:text-foreground hover:"
                onClick={addCustomModel}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Currently selected as badges */}
          {selectedModels.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedModels.map((model) => (
                <Badge
                  key={model}
                  variant="secondary"
                  className="text-[11px] px-2 py-0.5 h-6 bg-violet-500/15 text-violet-300 border-violet-500/25 hover:bg-violet-500/25 font-normal gap-1"
                >
                  {model.length > 24 ? model.slice(0, 24) + '…' : model}
                  <button
                    type="button"
                    className="ml-0.5 hover:text-violet-100 transition-colors"
                    onClick={() => toggleModel(model)}
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="pt-4 border-t border-border">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-input text-secondary-foreground hover:"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || selectedModels.length === 0}
            className="bg-violet-600 hover:bg-violet-500 text-white min-w-[100px]"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Saving…
              </>
            ) : (
              `Save ${selectedModels.length} Model${selectedModels.length !== 1 ? 's' : ''}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// Delete Confirmation Dialog
// =============================================================================

function DeleteConfirmDialog({
  open,
  onOpenChange,
  provider,
  onConfirm,
  deleting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: LlmProvider | null;
  onConfirm: () => void;
  deleting: boolean;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-popover border-border">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-popover-foreground">Delete Provider</AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground">
            Are you sure you want to delete{' '}
            <span className="text-secondary-foreground font-medium">{provider?.name}</span>?
            This action cannot be undone. Any agents currently using this provider will need to be reassigned.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            disabled={deleting}
            className="border-input text-secondary-foreground hover:"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={deleting}
            className="bg-red-600 hover:bg-red-500 text-white focus:ring-red-500/50"
          >
            {deleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Deleting…
              </>
            ) : (
              'Delete'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// =============================================================================
// Discovery Results Section
// =============================================================================

function DiscoveryResults({
  results,
  onAdd,
  onDismiss,
}: {
  results: DiscoveredProvider[];
  onAdd: (result: DiscoveredProvider) => void;
  onDismiss: () => void;
}) {
  if (results.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="mb-6"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Wifi className="h-4 w-4 text-violet-400" />
          <h3 className="text-sm font-medium text-secondary-foreground">
            Discovered {results.length} local {results.length === 1 ? 'server' : 'servers'}
          </h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-muted-foreground/70 hover:text-secondary-foreground hover:"
          onClick={onDismiss}
        >
          <X className="h-3 w-3 mr-1" />
          Dismiss
        </Button>
      </div>

      <AnimatePresence>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {results.map((result, i) => {
            const visual = PROVIDER_VISUALS[result.type as ProviderType] ?? PROVIDER_VISUALS.custom;
            const Icon = visual.icon;

            return (
              <motion.div
                key={result.port}
                custom={i}
                variants={discoveryCardVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
                  <div className="flex items-start gap-3">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${visual.bg}`}>
                      <Icon className={`h-4 w-4 ${visual.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-secondary-foreground">{result.name}</span>
                        <Badge className="text-[10px] h-5 px-1.5 py-0 bg-emerald-500/15 text-emerald-400 border-emerald-500/25 font-normal">
                          <Check className="h-2.5 w-2.5 mr-0.5" />
                          Found
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground/70 mt-0.5">
                        Port {result.port} • {result.models.length} model{result.models.length !== 1 ? 's' : ''} available
                      </p>

                      {/* Model badges */}
                      {result.models.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2 max-h-20 overflow-y-auto">
                          {result.models.slice(0, 4).map((model) => (
                            <Badge
                              key={model}
                              variant="secondary"
                              className="text-[10px] px-1.5 py-0 h-5"
                            >
                              {model.length > 20 ? model.slice(0, 20) + '…' : model}
                            </Badge>
                          ))}
                          {result.models.length > 4 && (
                            <Badge
                              variant="secondary"
                              className="text-[10px] px-1.5 py-0 h-5"
                            >
                              +{result.models.length - 4} more
                            </Badge>
                          )}
                        </div>
                      )}

                      <Button
                        size="sm"
                        className="mt-3 h-7 text-xs bg-violet-600 hover:bg-violet-500 text-white"
                        onClick={() => onAdd(result)}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add as Provider
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </AnimatePresence>
    </motion.div>
  );
}

// =============================================================================
// Main Provider Manager Component
// =============================================================================

export function ProviderManager() {
  const {
    providers,
    loading,
    error,
    fetchProviders,
    addProvider,
    updateProvider,
    deleteProvider,
    testProvider,
  } = useProviderStore();

  // Dialog states
  const [formOpen, setFormOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<LlmProvider | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LlmProvider | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [modelConfigTarget, setModelConfigTarget] = useState<LlmProvider | null>(null);

  // Discovery state
  const [discovering, setDiscovering] = useState(false);
  const [discovered, setDiscovered] = useState<DiscoveredProvider[]>([]);

  // Fetch providers on mount
  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  // Show error toast
  useEffect(() => {
    if (error) {
      toast.error('Provider error', { description: error });
    }
  }, [error]);

  // ---- Handlers ----

  const handleOpenAdd = useCallback(() => {
    setEditingProvider(null);
    setFormOpen(true);
  }, []);

  const handleOpenEdit = useCallback((provider: LlmProvider) => {
    setEditingProvider(provider);
    setFormOpen(true);
  }, []);

  const handleSave = useCallback(
    async (data: ProviderFormData) => {
      const typeDef = PROVIDER_TYPES.find((t) => t.value === data.type);

      if (editingProvider) {
        await updateProvider(editingProvider.id, {
          name: data.name,
          type: data.type,
          baseUrl: data.baseUrl,
          apiKey: data.apiKey,
          isLocal: typeDef?.isLocal ?? false,
          isActive: data.isActive,
          models: data.models,
        });
      } else {
        await addProvider({
          name: data.name,
          type: data.type,
          baseUrl: data.baseUrl,
          apiKey: data.apiKey,
          isLocal: typeDef?.isLocal ?? false,
          isActive: data.isActive,
          models: data.models,
        });
      }
    },
    [editingProvider, addProvider, updateProvider]
  );

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteProvider(deleteTarget.id);
      toast.success('Provider deleted', {
        description: `${deleteTarget.name} has been removed.`,
      });
      setDeleteTarget(null);
    } catch (err) {
      toast.error('Failed to delete provider', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, deleteProvider]);

  const handleTest = useCallback(
    async (id: string) => {
      setTestingId(id);
      try {
        const success = await testProvider(id);
        const provider = providers.find((p) => p.id === id);
        if (success) {
          toast.success('Connection successful', {
            description: `${provider?.name ?? 'Provider'} is reachable and responding.`,
          });
        } else {
          toast.error('Connection failed', {
            description: `Could not reach ${provider?.name ?? 'provider'}. Check the URL and API key.`,
          });
        }
      } catch {
        toast.error('Connection test error', {
          description: 'An unexpected error occurred during the test.',
        });
      } finally {
        setTestingId(null);
      }
    },
    [testProvider, providers]
  );

  const handleDiscover = useCallback(async () => {
    setDiscovering(true);
    setDiscovered([]);
    try {
      const res = await fetch('/api/discover');
      if (!res.ok) {
        throw new Error('Discovery request failed');
      }
      const results: DiscoveredProvider[] = await res.json();
      setDiscovered(results);

      if (results.length === 0) {
        toast.info('No local servers found', {
          description:
            'Make sure Ollama, LM Studio, vLLM, or another local server is running on its default port.',
        });
      } else {
        toast.success(`Found ${results.length} local ${results.length === 1 ? 'server' : 'servers'}`, {
          description: 'Select which ones you\'d like to add as providers.',
        });
      }
    } catch (err) {
      toast.error('Discovery failed', {
        description: err instanceof Error ? err.message : 'Could not scan for local servers.',
      });
    } finally {
      setDiscovering(false);
    }
  }, []);

  const handleAddDiscovered = useCallback(
    (result: DiscoveredProvider) => {
      const typeDef = PROVIDER_TYPES.find((t) => t.value === result.type);
      addProvider({
        name: `${result.name} (Local)`,
        type: result.type as ProviderType,
        baseUrl: result.baseUrl,
        apiKey: '',
        isLocal: true,
        isActive: true,
        models: result.models,
      }).then(() => {
        setDiscovered((prev) => prev.filter((r) => r.port !== result.port));
        toast.success(`${result.name} added`, {
          description: `Added with ${result.models.length} model(s) on port ${result.port}.`,
        });
      }).catch((err) => {
        toast.error('Failed to add discovered provider', {
          description: err instanceof Error ? err.message : 'Unknown error',
        });
      });
    },
    [addProvider]
  );

  // ---- Render ----

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500/10 border border-violet-500/20">
              <Server className="h-5 w-5 text-violet-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground tracking-tight">Model Gateway</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Configure LLM providers for your agents
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              onClick={handleDiscover}
              disabled={discovering}
              className="border-input text-secondary-foreground hover:"
            >
              {discovering ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wifi className="h-4 w-4" />
              )}
              Discover Local
            </Button>
            <Button
              onClick={handleOpenAdd}
              className="bg-violet-600 hover:bg-violet-500 text-white gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Provider
            </Button>
          </div>
        </div>

        {/* Discovery results */}
        <AnimatePresence>
          {discovered.length > 0 && (
            <DiscoveryResults
              results={discovered}
              onAdd={handleAddDiscovered}
              onDismiss={() => setDiscovered([])}
            />
          )}
        </AnimatePresence>

        {/* Content */}
        {loading && providers.length === 0 ? (
          <ProviderSkeletonGrid />
        ) : providers.length === 0 ? (
          <EmptyState onAdd={handleOpenAdd} />
        ) : (
          <AnimatePresence mode="popLayout">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {providers.map((provider, i) => (
                <ProviderCard
                  key={provider.id}
                  provider={provider}
                  index={i}
                  onEdit={handleOpenEdit}
                  onTest={handleTest}
                  onDelete={setDeleteTarget}
                  onConfigureModels={setModelConfigTarget}
                  testingId={testingId}
                />
              ))}
            </div>
          </AnimatePresence>
        )}
      </div>

      {/* Form Dialog */}
      <ProviderFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editingProvider={editingProvider}
        onSave={handleSave}
      />

      {/* Model Configuration Dialog */}
      <ModelConfigDialog
        open={modelConfigTarget !== null}
        onOpenChange={(open) => !open && setModelConfigTarget(null)}
        provider={modelConfigTarget}
        onUpdate={updateProvider}
      />

      {/* Delete Confirmation */}
      <DeleteConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        provider={deleteTarget}
        onConfirm={handleDelete}
        deleting={deleting}
      />
    </div>
  );
}
