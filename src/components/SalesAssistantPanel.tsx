import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import CallDetailsDialog from "@/components/CallDetailsDialog";
import { useAssistantMessages, useAssistantThreads, useDeleteAssistantThread, useSalesAssistant, useUpdateAssistantThread } from "@/hooks/useSalesAssistant";
import { AssistantMessage, CallAnalysis } from "@/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Archive,
  ArchiveRestore,
  Bot,
  Calendar,
  Compass,
  Link2,
  Loader2,
  MoreVertical,
  Pencil,
  Pin,
  PinOff,
  Plus,
  SendHorizonal,
  Share2,
  Trash2,
  User2,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type Props = {
  closerId: string | null;
  isAdmin?: boolean;
  closers?: Array<{ id: string; name: string }>;
  selectedCloserId?: string;
  onSelectCloser?: (id: string) => void;
  closerName?: string | null;
  selectedCall: CallAnalysis | null;
  calls: CallAnalysis[];
  disabledReason?: string | null;
  onOpenCall: (call: CallAnalysis) => void;
  onClearSelectedCall: () => void;
  selectedThreadId: string | null;
  onSelectThread: (threadId: string | null) => void;
};

const suggestedPrompts = [
  "What did I do well in this call?",
  "Where did I lose momentum?",
  "What's my biggest area to improve right now?",
  "Help me handle the price objection better.",
  "What patterns do you see across my recent calls?",
];

const LoadingMessages = () => (
  <div className="mx-auto max-w-4xl space-y-4 p-1">
    {Array.from({ length: 3 }).map((_, index) => (
      <div key={index} className={cn("flex", index % 2 === 0 ? "justify-start" : "justify-end")}>
        <Skeleton className="h-20 w-[82%] rounded-[24px]" />
      </div>
    ))}
  </div>
);

const formatTime = (value: string) => {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
};

const TypingDots = () => (
  <div className="flex items-center gap-1.5 px-1 py-1">
    {[0, 1, 2].map((i) => (
      <span
        key={i}
        className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce"
        style={{ animationDelay: `${i * 160}ms`, animationDuration: "900ms" }}
      />
    ))}
  </div>
);

const MessageBubble = ({
  message,
  pending = false,
  isNew = false,
  callsById,
  onViewCall,
}: {
  message: AssistantMessage | { role: "user" | "assistant"; content: string; citations?: AssistantMessage["citations"]; createdAt?: string };
  pending?: boolean;
  isNew?: boolean;
  callsById: Map<string, CallAnalysis>;
  onViewCall: (call: CallAnalysis) => void;
}) => {
  const isAssistant = message.role === "assistant";

  return (
    <div
      className={cn(
        "flex gap-3",
        isAssistant ? "items-start" : "justify-end",
        isNew && "animate-in fade-in slide-in-from-bottom-3 fill-mode-both",
      )}
      style={isNew ? { animationDuration: "350ms" } : undefined}
    >
      {isAssistant && (
        <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-primary/10 bg-primary/8 text-primary shadow-sm">
          <Bot className="h-4 w-4" />
        </div>
      )}

      <div className="max-w-[87%] space-y-2">
        <div
          className={cn(
            "rounded-[24px] border shadow-sm",
            isAssistant
              ? "border-border/50 bg-background/90 text-card-foreground px-4 py-3"
              : "border-primary/15 bg-primary text-primary-foreground px-4 py-3",
          )}
        >
          {pending && isAssistant ? (
            <TypingDots />
          ) : isAssistant ? (
            <ReactMarkdown
              components={{
                p:      ({ children }) => <p className="mb-3 last:mb-0 text-sm leading-relaxed">{children}</p>,
                strong: ({ children }) => <strong className="font-bold text-foreground">{children}</strong>,
                em:     ({ children }) => <em className="italic">{children}</em>,
                ol:     ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-1.5 text-sm">{children}</ol>,
                ul:     ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1.5 text-sm">{children}</ul>,
                li:     ({ children }) => <li className="leading-relaxed">{children}</li>,
                h1:     ({ children }) => <h1 className="text-base font-black mb-2">{children}</h1>,
                h2:     ({ children }) => <h2 className="text-sm font-black mb-2">{children}</h2>,
                h3:     ({ children }) => <h3 className="text-sm font-bold mb-1">{children}</h3>,
              }}
            >
              {message.content}
            </ReactMarkdown>
          ) : (
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
          )}
        </div>

        {!pending && isAssistant && message.citations && message.citations.filter(c =>
          // Only show citations when Max is referencing something specific —
          // skip generic "Referenced by the assistant" auto-citations
          c.reason &&
          c.reason !== "Referenced by the assistant." &&
          c.reason !== "Referenced by the assistant" &&
          c.reason !== "Selected call context." &&
          c.reason.length > 25
        ).length > 0 && (
          <div className="flex flex-wrap gap-2">
            {message.citations.filter(c =>
              c.reason &&
              c.reason !== "Referenced by the assistant." &&
              c.reason !== "Referenced by the assistant" &&
              c.reason !== "Selected call context." &&
              c.reason.length > 25
            ).map((citation) => {
              const call = callsById.get(citation.callId);
              return (
                <button
                  key={`${citation.callId}-${citation.reason}`}
                  type="button"
                  className="rounded-2xl border border-border/60 bg-background px-3 py-2 text-left transition-all hover:border-primary/30 hover:bg-primary/5"
                  onClick={() => call && onViewCall(call)}
                  disabled={!call}
                >
                  <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-primary">
                    <Link2 className="h-3 w-3" />
                    Call Evidence
                  </div>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {citation.callTitle ?? "Untitled call"}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{citation.reason}</p>
                </button>
              );
            })}
          </div>
        )}

        {!pending && message.createdAt && (
          <p className={cn("px-1 text-[11px] text-muted-foreground", !isAssistant && "text-right")}>
            {formatTime(message.createdAt)}
          </p>
        )}
      </div>

      {!isAssistant && (
        <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-border/60 bg-secondary text-secondary-foreground shadow-sm">
          <User2 className="h-4 w-4" />
        </div>
      )}
    </div>
  );
};

const SalesAssistantPanel = ({
  closerId,
  closerName,
  isAdmin = false,
  closers = [],
  selectedCloserId = "",
  onSelectCloser,
  selectedCall,
  calls,
  disabledReason,
  onOpenCall,
  onClearSelectedCall,
  selectedThreadId,
  onSelectThread,
}: Props) => {
  const { data: threads = [], isLoading: loadingThreads } = useAssistantThreads(closerId);
  const { data: messages = [], isLoading: loadingMessages } = useAssistantMessages(selectedThreadId);
  const assistant = useSalesAssistant();
  const deleteThread = useDeleteAssistantThread(closerId);
  const updateThread = useUpdateAssistantThread(closerId);

  const [draft, setDraft] = useState("");
  const [optimisticPrompt, setOptimisticPrompt] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<{ id: string; current: string | null } | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [callPickerOpen, setCallPickerOpen] = useState(false);
  const [dialogCall, setDialogCall] = useState<CallAnalysis | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const bottomRef    = useRef<HTMLDivElement | null>(null);
  // Track how many messages were already visible so only new ones animate
  const seenCount    = useRef(0);

  const callsById = useMemo(() => new Map(calls.map((call) => [call.id, call])), [calls]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 220)}px`;
  }, [draft]);

  const handleSend = (event?: FormEvent) => {
    event?.preventDefault();
    const message = draft.trim();
    if (!message || !closerId) return;

    setOptimisticPrompt(message);
    setDraft("");

    assistant.mutate(
      {
        closerId,
        threadId: selectedThreadId ?? undefined,
        selectedCallId: selectedCall?.id,
        message,
      },
      {
        onSuccess: (res) => {
          // Don't clear optimisticPrompt here — the useEffect below does it
          // once real messages have loaded, preventing the flash between
          // optimistic clear and query refetch completing.
          if (!selectedThreadId && res.threadId) {
            onSelectThread(res.threadId);
          }
        },
        onError: (error) => {
          setDraft(message);
          setOptimisticPrompt(null);
          toast.error(`Assistant error: ${error.message}`);
        },
      },
    );
  };

  const handleComposerKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter") return;
    if (event.metaKey) return;

    event.preventDefault();
    handleSend();
  };

  const combinedMessages = useMemo(() => {
    const optimistic: Array<AssistantMessage | { role: "user" | "assistant"; content: string; citations?: AssistantMessage["citations"]; createdAt?: string }> = [...messages];
    if (optimisticPrompt) {
      optimistic.push({
        role: "user",
        content: optimisticPrompt,
        createdAt: new Date().toISOString(),
      });
      optimistic.push({
        role: "assistant",
        content: "",
        citations: [],
      });
    }
    return optimistic;
  }, [messages, optimisticPrompt]);

  // Clear optimistic state only after the server's real messages have loaded.
  // Waiting here prevents the visible flash that happens when optimistic is
  // cleared before the TanStack Query refetch has finished.
  useEffect(() => {
    if (!optimisticPrompt) return;
    const last = messages[messages.length - 1];
    if (last?.role === "assistant") setOptimisticPrompt(null);
  }, [messages, optimisticPrompt]);

  // Auto-scroll whenever the list grows (new message or typing indicator)
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [combinedMessages.length]);

  // Track how many messages were visible after each render so only
  // genuinely new ones get the slide-in animation next render
  useEffect(() => {
    seenCount.current = combinedMessages.length;
  });

  const groupedThreads = useMemo(() => {
    const activeThreads = threads.filter(t => t.isArchived === showArchived);
    
    const groups: Record<string, typeof threads> = {
      Pinned: threads.filter(t => t.isPinned && t.isArchived === showArchived),
      Today: [],
      Yesterday: [],
      Earlier: [],
    };

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    threads.filter(t => !t.isPinned && t.isArchived === showArchived).forEach((t) => {
      const date = new Date(t.updatedAt);
      if (date >= today) groups.Today.push(t);
      else if (date >= yesterday) groups.Yesterday.push(t);
      else groups.Earlier.push(t);
    });

    return Object.entries(groups).filter(([_, items]) => items.length > 0);
  }, [threads, showArchived]);

  const handleShare = () => {
    if (!selectedThreadId) return;
    const thread = threads.find(t => t.id === selectedThreadId);
    const url = `${window.location.origin}/assistant?thread=${selectedThreadId}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copied to clipboard", {
      description: "Anyone with access to the dashboard can use this link to view this chat."
    });
  };

  const handleTogglePin = (threadId: string, isPinned: boolean, event: React.MouseEvent) => {
    event.stopPropagation();
    updateThread.mutate({ threadId, is_pinned: !isPinned }, {
      onSuccess: () => toast.success(!isPinned ? "Chat pinned" : "Chat unpinned"),
    });
  };

  const handleToggleArchive = (threadId: string, isArchived: boolean, event: React.MouseEvent) => {
    event.stopPropagation();
    updateThread.mutate({ threadId, is_archived: !isArchived }, {
      onSuccess: () => {
        if (!isArchived && selectedThreadId === threadId) {
          onSelectThread(null);
        }
        toast.success(!isArchived ? "Chat archived" : "Chat restored");
      },
    });
  };

  const handleDeleteThread = (threadId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setDeleteTarget(threadId);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteThread.mutate(deleteTarget, {
      onSuccess: () => {
        if (selectedThreadId === deleteTarget) onSelectThread(null);
        toast.success("Conversation deleted");
        setDeleteTarget(null);
      },
    });
  };

  const handleRenameThread = (threadId: string, currentTitle: string | null, event: React.MouseEvent) => {
    event.stopPropagation();
    setRenameTarget({ id: threadId, current: currentTitle });
    setRenameValue(currentTitle ?? "");
  };

  const confirmRename = () => {
    if (!renameTarget || !renameValue.trim() || renameValue.trim() === renameTarget.current) {
      setRenameTarget(null);
      return;
    }
    updateThread.mutate({ threadId: renameTarget.id, title: renameValue.trim() }, {
      onSuccess: () => { toast.success("Conversation renamed"); setRenameTarget(null); },
    });
  };

  return (
    <Card className="flex h-full flex-col overflow-hidden rounded-none border-0 bg-background shadow-none">
      <CardContent className="flex min-h-0 flex-1 flex-col p-0">
        {disabledReason ? (
          <div className="flex min-h-0 flex-1 items-center justify-center p-8 text-center">
            <div>
              <Compass className="mx-auto h-9 w-9 text-muted-foreground/40" />
              <p className="mt-4 text-sm font-semibold text-foreground">{disabledReason}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Once a closer context is active, the assistant will load the persistent coaching thread automatically.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-row">
            {/* ── Sidebar ─────────────────────────────────────────────────── */}
            <div className="hidden w-64 flex-col bg-[#0A0D14] lg:flex">

              {/* Branding */}
              <div className="px-5 pt-5 pb-4 border-b border-white/[0.06]">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary shadow-lg shadow-primary/30">
                    <Bot className="h-4.5 w-4.5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-black text-white leading-none">Max</p>
                    <p className="text-[10px] font-medium text-white/40 mt-1">Your Sales Coach</p>
                  </div>
                </div>

                {closerName && (
                  <p className="mt-3 text-[10px] font-bold text-primary/70 uppercase tracking-widest truncate">
                    Coaching {closerName}
                  </p>
                )}

                {isAdmin && onSelectCloser && (
                  <Select
                    value={selectedCloserId || "none"}
                    onValueChange={(value) => onSelectCloser(value === "none" ? "" : value)}
                  >
                    <SelectTrigger className="mt-3 h-9 w-full rounded-xl border-white/10 bg-white/[0.04] text-white/70 text-xs font-medium focus:ring-primary/30 hover:bg-white/[0.07] transition-colors">
                      <SelectValue placeholder="Choose closer" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="none" className="text-xs font-bold text-muted-foreground">All closers</SelectItem>
                      {closers.map((c) => (
                        <SelectItem key={c.id} value={c.id} className="text-xs font-medium">{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* New chat */}
              <div className="px-3 pt-4 pb-2">
                <button
                  onClick={() => onSelectThread(null)}
                  className="flex w-full items-center gap-2.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 active:scale-[0.98]"
                >
                  <Plus className="h-4 w-4" />
                  New Chat
                </button>
              </div>

              {/* Call focus — searchable popover */}
              <div className="px-3 pb-3">
                <p className="px-1 mb-1.5 text-[9px] font-black uppercase tracking-widest text-white/25 select-none">
                  Focus a Call
                </p>
                <Popover open={callPickerOpen} onOpenChange={setCallPickerOpen}>
                  <PopoverTrigger asChild>
                    <button
                      disabled={calls.length === 0}
                      className="flex w-full items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-left text-xs font-medium text-white/50 hover:bg-white/[0.07] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <span className="truncate">
                        {selectedCall
                          ? (selectedCall.callTitle || "Untitled call")
                          : calls.length === 0
                          ? "No calls yet — sync Fathom first"
                          : "Choose a call to focus..."}
                      </span>
                      <Calendar className="h-3.5 w-3.5 shrink-0 opacity-50" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    side="bottom"
                    align="start"
                    className="w-[420px] p-0 rounded-2xl shadow-2xl border-border/60"
                    sideOffset={6}
                    avoidCollisions
                  >
                    <Command
                      className={cn(
                        // kill the browser focus ring on the input wrapper
                        "[&_[cmdk-input-wrapper]]:focus-within:outline-none",
                        "[&_[cmdk-input-wrapper]]:focus-within:ring-0",
                        "[&_[cmdk-input-wrapper]]:focus-within:border-border/40",
                      )}
                    >
                      <CommandInput
                        placeholder="Search by title, date, or client..."
                        className="h-11 text-sm focus:ring-0 focus:outline-none"
                      />
                      <CommandList className="max-h-[420px] overflow-y-auto">
                        <CommandEmpty className="py-8 text-center text-sm text-muted-foreground">
                          No calls match your search.
                        </CommandEmpty>
                        {selectedCall && (
                          <CommandGroup heading="Active">
                            <CommandItem
                              onSelect={() => { onClearSelectedCall(); setCallPickerOpen(false); }}
                              className="flex items-center gap-2 text-muted-foreground text-xs py-2"
                            >
                              <span className="text-rose-500 font-bold">× Clear focused call</span>
                            </CommandItem>
                          </CommandGroup>
                        )}
                        <CommandGroup heading={`${calls.length} call${calls.length === 1 ? "" : "s"} available`}>
                          {(() => {
                            // Count occurrences of each title+date combination so duplicates
                            // get numbered: "Call Title (1 of 3)", "Call Title (2 of 3)"
                            const keyCount = new Map<string, number>();
                            const keyIndex = new Map<string, number>();
                            for (const c of calls) {
                              const k = `${c.callTitle ?? ""}|${c.callDate ?? ""}`;
                              keyCount.set(k, (keyCount.get(k) ?? 0) + 1);
                            }
                            return calls.map((call) => {
                            const isActive = selectedCall?.id === call.id;
                            const score = call.score;
                            const dupKey = `${call.callTitle ?? ""}|${call.callDate ?? ""}`;
                            const total = keyCount.get(dupKey) ?? 1;
                            keyIndex.set(dupKey, (keyIndex.get(dupKey) ?? 0) + 1);
                            const idx = keyIndex.get(dupKey)!;
                            const dupLabel = total > 1 ? ` (${idx} of ${total})` : "";
                            // Prefix with ID so each item is unique even if titles match.
                            const itemValue = `${call.id} ${call.callTitle ?? ""} ${call.callDate ?? ""}`;
                            return (
                              <CommandItem
                                key={call.id}
                                value={itemValue}
                                onSelect={() => { onOpenCall(call); setCallPickerOpen(false); }}
                                className={cn(
                                  "flex flex-col items-start gap-1 py-3 px-4 rounded-none cursor-pointer border-b border-border/40 last:border-b-0",
                                  // force off the default Radix selected background at all specificity levels
                                  "[&[data-selected=true]]:!bg-transparent [&[data-selected=true]]:!text-foreground",
                                  // active call gets a left accent line instead of a background
                                  isActive ? "border-l-2 border-l-primary pl-3.5" : "hover:bg-muted/30"
                                )}
                              >
                                <div className="flex items-start justify-between w-full gap-3">
                                  <p className="text-sm font-semibold leading-snug text-foreground">
                                    {call.callTitle || "Untitled call"}
                                    {dupLabel && (
                                      <span className="ml-1 text-[11px] font-normal text-muted-foreground">{dupLabel}</span>
                                    )}
                                  </p>
                                  {score !== null && (
                                    <span className={cn(
                                      "text-[10px] font-black tabular-nums shrink-0 mt-0.5 px-2 py-0.5 rounded-lg",
                                      score >= 80 ? "bg-emerald-500/10 text-emerald-600" :
                                      score >= 60 ? "bg-amber-500/10 text-amber-600" :
                                                    "bg-rose-500/10 text-rose-600"
                                    )}>
                                      {score}/100
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                  {call.callStartedAt
                                    ? <span>{new Date(call.callStartedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                                    : call.callDate && <span>{call.callDate}</span>
                                  }
                                  {call.durationSeconds && (
                                    <><span className="opacity-40">·</span><span>{Math.round(call.durationSeconds / 60)} min</span></>
                                  )}
                                  <span className="opacity-40">·</span>
                                  <span className={call.status === "done" ? "text-emerald-500 font-semibold" : "text-muted-foreground/60"}>
                                    {call.status === "done" ? "✓ Analyzed" : "Ready"}
                                  </span>
                                </div>
                              </CommandItem>
                            );
                          });
                          })()}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>

                {selectedCall && (
                  <button
                    onClick={onClearSelectedCall}
                    className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-lg py-1 text-[11px] font-medium text-white/30 hover:text-white/60 transition-colors"
                  >
                    Clear focused call ×
                  </button>
                )}
              </div>

              {/* Thread list */}
              <ScrollArea className="flex-1">
                <div className="px-2 pb-2 space-y-0.5">
                  {loadingThreads ? (
                    <div className="space-y-1.5 px-2 py-3">
                      {[1,2,3].map(i => <Skeleton key={i} className="h-9 w-full rounded-xl bg-white/5" />)}
                    </div>
                  ) : threads.length === 0 ? (
                    <p className="py-10 text-center text-xs text-white/25 italic">No conversations yet</p>
                  ) : (
                    groupedThreads.map(([group, items]) => (
                      <div key={group}>
                        <p className="px-3 pb-1 pt-3 text-[9px] font-black uppercase tracking-widest text-white/20 select-none">{group}</p>
                        {items.map((t) => (
                          <div
                            key={t.id}
                            className={cn(
                              "group relative flex w-full items-center gap-1 rounded-xl px-3 py-2.5 text-left transition-all duration-150",
                              selectedThreadId === t.id
                                ? "bg-white/10 text-white"
                                : "text-white/45 hover:bg-white/[0.05] hover:text-white/75",
                            )}
                          >
                            <button
                              onClick={() => onSelectThread(t.id)}
                              className="flex-1 text-left min-w-0"
                            >
                              <div className="flex items-center gap-1.5">
                                {t.isPinned && <Pin className="h-2.5 w-2.5 text-primary/70 shrink-0" />}
                                <p className="truncate text-xs font-semibold leading-tight">
                                  {t.title || "New Chat"}
                                </p>
                              </div>
                              {t.lastMessageAt && (
                                <p className="mt-0.5 text-[9px] opacity-40">
                                  {formatTime(t.lastMessageAt)}
                                </p>
                              )}
                            </button>

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className={cn(
                                    "h-6 w-6 rounded-lg opacity-0 transition-opacity group-hover:opacity-100 text-white/50 hover:text-white hover:bg-white/10",
                                    selectedThreadId === t.id && "opacity-100"
                                  )}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MoreVertical className="h-3 w-3" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48 rounded-xl">
                                <DropdownMenuItem onClick={(e) => handleTogglePin(t.id, t.isPinned, e)} className="gap-2 text-xs font-bold">
                                  {t.isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                                  {t.isPinned ? "Unpin" : "Pin Chat"}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => handleRenameThread(t.id, t.title, e)} className="gap-2 text-xs font-bold">
                                  <Pencil className="h-3.5 w-3.5" />
                                  Rename
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => handleToggleArchive(t.id, t.isArchived, e)} className="gap-2 text-xs font-bold">
                                  {t.isArchived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                                  {t.isArchived ? "Restore" : "Archive"}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={(e) => handleDeleteThread(t.id, e)}
                                  className="gap-2 text-xs font-bold text-red-500 focus:bg-red-50 focus:text-red-600"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        ))}
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>

              {/* Footer: archive + share */}
              <div className="border-t border-white/[0.06] px-3 py-2 space-y-0.5">
                <button
                  onClick={() => setShowArchived(!showArchived)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-colors",
                    showArchived ? "text-primary/80" : "text-white/30 hover:text-white/60"
                  )}
                >
                  {showArchived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                  {showArchived ? "Back to Active" : "Archived Chats"}
                </button>
                {selectedThreadId && (
                  <button
                    onClick={handleShare}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-white/30 hover:text-white/60 transition-colors"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    Share Conversation
                  </button>
                )}
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 px-3 pb-3 pt-3 md:px-6 md:pb-4 md:pt-4">
                <div className="flex h-full min-h-0 flex-col">
                  <ScrollArea className="min-h-0 flex-1 pr-2">
                    {loadingMessages ? (
                      <div className="px-4 py-6">
                        <LoadingMessages />
                      </div>
                    ) : combinedMessages.length === 0 ? (
                    <div className="flex h-full min-h-[320px] flex-col items-center justify-center px-6 py-10 text-center md:px-8 md:py-12">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <Bot className="h-7 w-7" />
                      </div>
                      <p className="mt-5 text-2xl font-black tracking-tight text-foreground">
                        Hey — I'm Max 👋
                      </p>
                      <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
                        Your personal sales coach. Ask me about your calls, objection handling, closing patterns, or just say hi.
                      </p>
                      <div className="mt-7 flex max-w-3xl flex-wrap justify-center gap-3">
                        {suggestedPrompts.map((prompt) => (
                          <button
                            key={prompt}
                            type="button"
                            className="rounded-full border border-border/50 bg-background px-4 py-2 text-sm font-semibold text-foreground transition-all hover:border-primary/25 hover:bg-primary/5"
                            onClick={() => setDraft(prompt)}
                          >
                            {prompt}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
                      {combinedMessages.map((message, index) => (
                        <MessageBubble
                          key={"id" in message ? message.id : `optimistic-${index}`}
                          message={message}
                          isNew={index >= seenCount.current}
                          pending={optimisticPrompt !== null && index === combinedMessages.length - 1 && message.role === "assistant"}
                          callsById={callsById}
                          onViewCall={setDialogCall}
                        />
                      ))}
                      <div ref={bottomRef} className="h-px" />
                    </div>
                  )}
                </ScrollArea>
              </div>
            </div>

            <div className="border-t border-border/40 bg-background px-3 py-3 md:px-6 md:py-4">
              <div className="mx-auto max-w-4xl">
                <form className="relative rounded-[28px] border border-border/50 bg-muted/20 p-2" onSubmit={handleSend}>
                  <Textarea
                    ref={textareaRef}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={handleComposerKeyDown}
                    placeholder="Ask Max anything — calls, objections, patterns, or just say hi..."
                    rows={1}
                    className="min-h-0 resize-none overflow-y-auto border-0 bg-transparent px-4 py-3 pr-16 text-sm leading-relaxed shadow-none focus-visible:ring-0"
                    disabled={assistant.isPending || !closerId}
                  />

                  <Button
                    type="submit"
                    size="icon"
                    className="absolute bottom-3 right-3 h-10 w-10 rounded-full shadow-lg shadow-primary/20"
                    disabled={!draft.trim() || assistant.isPending || !closerId}
                    aria-label={assistant.isPending ? "Sending message" : "Send message"}
                  >
                    {assistant.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <SendHorizonal className="h-4 w-4" />
                    )}
                  </Button>
                </form>
              </div>
            </div>
            </div>
          </div>
        )}
      </CardContent>
      {/* Call details dialog — opened by clicking a citation card */}
      <CallDetailsDialog
        call={dialogCall}
        open={!!dialogCall}
        onOpenChange={(open) => { if (!open) setDialogCall(null); }}
      />

      {/* Delete conversation confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-[2rem] border-none shadow-2xl p-8">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black">Delete conversation?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              This permanently removes the conversation and all its messages. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3 mt-6">
            <AlertDialogCancel className="rounded-xl h-11 font-bold">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteThread.isPending}
              className="rounded-xl h-11 bg-rose-500 hover:bg-rose-600 font-bold shadow-lg shadow-rose-500/20"
            >
              {deleteThread.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rename conversation dialog */}
      <Dialog open={!!renameTarget} onOpenChange={(open) => !open && setRenameTarget(null)}>
        <DialogContent className="rounded-[2rem] border-none shadow-2xl max-w-sm p-8">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">Rename conversation</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={e => setRenameValue(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") confirmRename(); }}
            className="h-12 rounded-xl border-2 bg-muted/20 mt-4 font-medium"
            placeholder="Conversation title..."
            autoFocus
          />
          <DialogFooter className="mt-4 gap-3">
            <button
              type="button"
              onClick={() => setRenameTarget(null)}
              className="h-11 px-5 rounded-xl font-bold text-sm text-muted-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmRename}
              disabled={updateThread.isPending}
              className="h-11 px-5 rounded-xl bg-primary text-white font-bold text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {updateThread.isPending ? "Saving..." : "Save"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default SalesAssistantPanel;
