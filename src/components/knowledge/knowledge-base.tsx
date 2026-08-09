'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Database,
  Upload,
  FileText,
  FileJson,
  FileCode,
  Trash2,
  Search,
  ChevronRight,
  X,
  Check,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
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

import type { KnowledgeDocument } from '@/lib/types';

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const ACCEPTED_EXTENSIONS = ['.txt', '.md', '.pdf', '.json', '.csv', '.py', '.js', '.ts'];
const ACCEPTED_MIME = '.txt,.md,.pdf,.json,.csv,.py,.js,.ts';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function fileIconForType(fileType: string) {
  if (fileType === 'json') return FileJson;
  if (['py', 'js', 'ts', 'csv'].includes(fileType)) return FileCode;
  return FileText;
}

function categoryColor(category: string): string {
  switch (category) {
    case 'text': return 'bg-accent/50 text-secondary-foreground border-border/50';
    case 'code': return 'bg-emerald-900/30 text-emerald-400 border-emerald-700/40';
    case 'data': return 'bg-amber-900/30 text-amber-400 border-amber-700/40';
    default: return 'bg-violet-900/30 text-violet-400 border-violet-700/40';
  }
}

function fileCategory(fileType: string): string {
  if (['py', 'js', 'ts'].includes(fileType)) return 'code';
  if (['json', 'csv'].includes(fileType)) return 'data';
  return 'text';
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function KnowledgeBase() {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [activeWorkspace, setActiveWorkspace] = useState('default');

  // RAG settings
  const [ragSettings, setRagSettings] = useState({
    chunkSize: 1000,
    chunkOverlap: 200,
    embeddingModel: 'text-embedding-3-small',
    topK: 5,
    similarityThreshold: 0.7,
  });

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<KnowledgeDocument | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Test RAG dialog
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testQuery, setTestQuery] = useState('');
  const [testResults, setTestResults] = useState<Array<{ text: string; score: number }>>([]);
  const [testLoading, setTestLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---------------------------------------------------------------------------
  // Fetch documents
  // ---------------------------------------------------------------------------

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/documents');
      if (!res.ok) throw new Error('Failed to fetch documents');
      const data: KnowledgeDocument[] = await res.json();
      setDocuments(data);
    } catch {
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // ---------------------------------------------------------------------------
  // Upload
  // ---------------------------------------------------------------------------

  const handleUpload = useCallback(async (file: File) => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      toast.error(`Unsupported file type: ${ext}`);
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    // Simulate progress ticks
    const progressInterval = setInterval(() => {
      setUploadProgress((p) => Math.min(p + Math.random() * 15, 90));
    }, 200);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('workspaceId', activeWorkspace);

      const res = await fetch('/api/documents', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Upload failed');
      }

      const created: KnowledgeDocument = await res.json();
      setDocuments((prev) => [...prev, created]);
      toast.success(`Uploaded ${created.filename}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setTimeout(() => {
        setUploading(false);
        setUploadProgress(0);
      }, 600);
    }
  }, [activeWorkspace]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  }, [handleUpload]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [handleUpload]);

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/documents/${deleteTarget.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setDocuments((prev) => prev.filter((d) => d.id !== deleteTarget.id));
      toast.success(`Deleted ${deleteTarget.filename}`);
    } catch {
      toast.error('Failed to delete document');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }, [deleteTarget]);

  // ---------------------------------------------------------------------------
  // Test RAG
  // ---------------------------------------------------------------------------

  const handleTestRag = useCallback(async () => {
    if (!testQuery.trim()) return;
    setTestLoading(true);
    setTestResults([]);
    // Simulate RAG results
    await new Promise((r) => setTimeout(r, 1200));
    setTestResults([
      { text: `Relevant chunk for "${testQuery}": The NEXUS orchestration pipeline consists of five specialized agents that collaborate through a structured debate process...`, score: 0.92 },
      { text: `Additional context: Each agent in the NEXUS system has a distinct role — Architect plans, Forge implements, Sentinel reviews...`, score: 0.85 },
      { text: `Supplementary information: The debate phases include draft, critique, rebuttal, arbitrate, verify, and commit...`, score: 0.73 },
    ]);
    setTestLoading(false);
  }, [testQuery]);

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
                <Database className="h-4.5 w-4.5 text-violet-400" />
              </div>
              <div>
                <h1 className="text-base font-semibold text-foreground">Knowledge Base</h1>
                <p className="text-xs text-muted-foreground/70">Upload documents for RAG-enhanced responses</p>
              </div>
            </div>
            <Button
              size="sm"
              className="bg-violet-600 hover:bg-violet-500 text-white gap-1.5"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <Upload className="h-3.5 w-3.5" />
              Upload Document
            </Button>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_MIME}
          className="hidden"
          onChange={handleFileSelect}
        />

        <ScrollArea className="flex-1 min-h-0">
          <div className="mx-auto w-full max-w-5xl space-y-6 p-6">

            {/* Upload Zone */}
            <div
              className={`relative rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer ${
                dragOver
                  ? 'border-violet-500 bg-violet-500/5'
                  : 'border-input/60 hover:border-border bg-card/40'
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="flex flex-col items-center justify-center gap-3 py-10">
                <div className={`rounded-xl p-3 transition-colors ${dragOver ? 'bg-violet-600/15' : 'bg-muted/60'}`}>
                  <Upload className={`h-6 w-6 ${dragOver ? 'text-violet-400' : 'text-muted-foreground/70'}`} />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-secondary-foreground">
                    {dragOver ? 'Drop your file here' : 'Drag & drop a file, or click to browse'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground/70">
                    Supports {ACCEPTED_EXTENSIONS.join(', ')}
                  </p>
                </div>
              </div>

              {/* Upload Progress */}
              {uploading && (
                <div className="mx-8 mb-6">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-muted-foreground">Uploading...</span>
                    <span className="text-xs text-muted-foreground">{Math.round(uploadProgress)}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-1.5" />
                </div>
              )}
            </div>

            {/* Workspace Selector */}
            <div className="flex items-center gap-3">
              <Label className="text-xs text-muted-foreground/70 shrink-0">Workspace</Label>
              <Select value={activeWorkspace} onValueChange={setActiveWorkspace}>
                <SelectTrigger className="w-48 h-8 bg-card border-border text-secondary-foreground text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="default" className="text-secondary-foreground">default</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Document List or Empty State */}
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-32 rounded-xl bg-card/60" />
                ))}
              </div>
            ) : documents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl">
                  <FileText className="h-6 w-6 text-muted-foreground/50" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">No documents yet</p>
                <p className="mt-1 text-xs text-muted-foreground/50 max-w-xs text-center">
                  Upload files to build your knowledge base. Documents are chunked and embedded for RAG retrieval.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {documents.map((doc) => {
                  const Icon = fileIconForType(doc.fileType);
                  const cat = fileCategory(doc.fileType);
                  return (
                    <Card
                      key={doc.id}
                      className="group relative bg-card/80 border-border/60 hover:border-violet-500/30 hover:shadow-[0_0_20px_rgba(139,92,246,0.06)] transition-all duration-200 overflow-hidden"
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                              <Icon className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-secondary-foreground truncate" title={doc.filename}>
                                {doc.filename}
                              </p>
                              <div className="mt-1 flex items-center gap-2 flex-wrap">
                                <span className="text-xs text-muted-foreground/70">{formatFileSize(doc.fileSize)}</span>
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] px-1.5 py-0 h-4 border ${categoryColor(cat)}`}
                                >
                                  {doc.fileType.toUpperCase()}
                                </Badge>
                                {doc.chunkCount > 0 && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] px-1.5 py-0 h-4 border-violet-700/40 bg-violet-900/20 text-violet-400"
                                  >
                                    {doc.chunkCount} chunks
                                  </Badge>
                                )}
                              </div>
                              <p className="mt-1.5 text-[11px] text-muted-foreground/50">{relativeTime(doc.createdAt)}</p>
                            </div>
                          </div>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground/50 hover:text-red-400 hover:bg-red-500/10 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteTarget(doc);
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="left" >
                              Delete document
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* RAG Settings */}
            <Card className="bg-card/80 border-border/60">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-semibold text-secondary-foreground">RAG Configuration</CardTitle>
                    <CardDescription className="text-xs text-muted-foreground/70 mt-0.5">
                      Tune retrieval-augmented generation parameters
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-input text-secondary-foreground hover:bg-muted"
                    onClick={() => { setTestQuery(''); setTestResults([]); setTestDialogOpen(true); }}
                  >
                    <Search className="h-3 w-3" />
                    Test RAG
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Chunk Size */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Chunk Size</Label>
                    <span className="text-xs font-mono text-violet-400">{ragSettings.chunkSize}</span>
                  </div>
                  <Slider
                    value={[ragSettings.chunkSize]}
                    min={500}
                    max={4000}
                    step={100}
                    onValueChange={([v]) => setRagSettings((s) => ({ ...s, chunkSize: v }))}
                    className="py-1"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground/50">
                    <span>500</span>
                    <span>4000</span>
                  </div>
                </div>

                {/* Chunk Overlap */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Chunk Overlap</Label>
                    <span className="text-xs font-mono text-violet-400">{ragSettings.chunkOverlap}</span>
                  </div>
                  <Slider
                    value={[ragSettings.chunkOverlap]}
                    min={0}
                    max={500}
                    step={25}
                    onValueChange={([v]) => setRagSettings((s) => ({ ...s, chunkOverlap: v }))}
                    className="py-1"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground/50">
                    <span>0</span>
                    <span>500</span>
                  </div>
                </div>

                <Separator  />

                {/* Embedding Model */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Embedding Model</Label>
                  <Input
                    value={ragSettings.embeddingModel}
                    onChange={(e) => setRagSettings((s) => ({ ...s, embeddingModel: e.target.value }))}
                    className="h-8"
                  />
                </div>

                {/* Top-K */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Top-K Results</Label>
                    <span className="text-xs font-mono text-violet-400">{ragSettings.topK}</span>
                  </div>
                  <Slider
                    value={[ragSettings.topK]}
                    min={1}
                    max={20}
                    step={1}
                    onValueChange={([v]) => setRagSettings((s) => ({ ...s, topK: v }))}
                    className="py-1"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground/50">
                    <span>1</span>
                    <span>20</span>
                  </div>
                </div>

                {/* Similarity Threshold */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Similarity Threshold</Label>
                    <span className="text-xs font-mono text-violet-400">{ragSettings.similarityThreshold.toFixed(2)}</span>
                  </div>
                  <Slider
                    value={[ragSettings.similarityThreshold]}
                    min={0}
                    max={1}
                    step={0.05}
                    onValueChange={([v]) => setRagSettings((s) => ({ ...s, similarityThreshold: v }))}
                    className="py-1"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground/50">
                    <span>0.0</span>
                    <span>1.0</span>
                  </div>
                </div>
              </CardContent>
            </Card>

          </div>
        </ScrollArea>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
          <AlertDialogContent className="bg-popover border-border">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-popover-foreground">Delete Document</AlertDialogTitle>
              <AlertDialogDescription className="text-muted-foreground">
                Are you sure you want to delete <span className="text-secondary-foreground font-medium">{deleteTarget?.filename}</span>? This will also remove all associated embeddings and cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel >Cancel</AlertDialogCancel>
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

        {/* Test RAG Dialog */}
        <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
          <DialogContent className="bg-popover border-border max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-popover-foreground">Test RAG Retrieval</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Enter a query to test similarity search against your knowledge base.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={testQuery}
                  onChange={(e) => setTestQuery(e.target.value)}
                  placeholder="How does the debate pipeline work?"
                  
                  onKeyDown={(e) => { if (e.key === 'Enter') handleTestRag(); }}
                />
                <Button
                  size="sm"
                  className="bg-violet-600 hover:bg-violet-500 text-white shrink-0"
                  onClick={handleTestRag}
                  disabled={testLoading || !testQuery.trim()}
                >
                  {testLoading ? '...' : 'Search'}
                </Button>
              </div>

              {testLoading && (
                <div className="flex items-center justify-center py-8">
                  <div className="flex items-center gap-2 text-muted-foreground/70 text-sm">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-violet-500" />
                    Searching...
                  </div>
                </div>
              )}

              {testResults.length > 0 && (
                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {testResults.map((result, i) => (
                    <div
                      key={i}
                      className="rounded-lg border border-border"
                    >
                      <div className="flex items-center justify-between">
                        <Badge
                          variant="outline"
                          className="text-[10px] h-4 px-1.5 border-violet-700/40 bg-violet-900/20 text-violet-400"
                        >
                          Chunk #{i + 1}
                        </Badge>
                        <span className="text-[11px] font-mono text-muted-foreground/70">
                          Score: <span className="text-violet-400">{result.score.toFixed(2)}</span>
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{result.text}</p>
                    </div>
                  ))}
                </div>
              )}

              {documents.length === 0 && testResults.length === 0 && !testLoading && (
                <div className="flex items-center justify-center py-6">
                  <p className="text-xs text-muted-foreground/50">No documents uploaded yet. Upload some documents to test RAG retrieval.</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
