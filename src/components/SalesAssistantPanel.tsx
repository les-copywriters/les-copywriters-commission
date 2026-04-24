import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
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

type Props = {
  closerId: string | null;
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
  "What went wrong in this call?",
  "What patterns do you see across my recent calls?",
  "Give me my top 3 coaching priorities.",
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

const MessageBubble = ({
  message,
  pending = false,
  callsById,
  onOpenCall,
}: {
  message: AssistantMessage | { role: "user" | "assistant"; content: string; citations?: AssistantMessage["citations"]; createdAt?: string };
  pending?: boolean;
  callsById: Map<string, CallAnalysis>;
  onOpenCall: (call: CallAnalysis) => void;
}) => {
  const isAssistant = message.role === "assistant";

  return (
    <div className={cn("flex gap-3", isAssistant ? "items-start" : "justify-end")}>
      {isAssistant && (
        <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-primary/10 bg-primary/8 text-primary shadow-sm">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
        </div>
      )}

      <div className="max-w-[87%] space-y-2">
        <div
          className={cn(
            "rounded-[24px] border px-4 py-3 shadow-sm",
            isAssistant
              ? "border-border/50 bg-background/90 text-card-foreground"
              : "border-primary/15 bg-primary text-primary-foreground",
          )}
        >
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
        </div>

        {isAssistant && message.citations && message.citations.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {message.citations.map((citation) => {
              const call = callsById.get(citation.callId);
              return (
                <button
                  key={`${citation.callId}-${citation.reason}`}
                  type="button"
                  className="rounded-2xl border border-border/60 bg-background px-3 py-2 text-left transition-all hover:border-primary/30 hover:bg-primary/5"
                  onClick={() => call && onOpenCall(call)}
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

        {message.createdAt && (
          <p className={cn("px-1 text-[11px] text-muted-foreground", !isAssistant && "text-right")}>
            {pending ? "Sending..." : formatTime(message.createdAt)}
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
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

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
          setOptimisticPrompt(null);
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
        content: "Thinking through your call history and coaching memory...",
        citations: [],
      });
    }
    return optimistic;
  }, [messages, optimisticPrompt]);

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
    if (!confirm("Are you sure you want to delete this conversation?")) return;
    
    deleteThread.mutate(threadId, {
      onSuccess: () => {
        if (selectedThreadId === threadId) {
          onSelectThread(null);
        }
        toast.success("Conversation deleted");
      },
    });
  };

  const handleRenameThread = (threadId: string, currentTitle: string | null, event: React.MouseEvent) => {
    event.stopPropagation();
    const newTitle = prompt("Enter a new title for this conversation:", currentTitle || "");
    if (!newTitle || newTitle === currentTitle) return;

    updateThread.mutate({ threadId, title: newTitle }, {
      onSuccess: () => toast.success("Conversation renamed"),
    });
  };

  return (
    <Card className="flex h-[calc(100vh-12rem)] flex-col overflow-hidden rounded-[32px] border border-border/40 bg-background shadow-premium lg:h-[calc(100vh-8rem)]">
      <div className="border-b border-border/40 bg-muted/5 px-4 py-3 md:px-6">
        <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Bot className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-black uppercase tracking-widest text-foreground">Sales Assistant</p>
              {closerName && <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Coaching {closerName}</p>}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Select
              value={selectedCall?.id || "none"}
              onValueChange={(value) => {
                if (value === "none") {
                  onClearSelectedCall();
                } else {
                  const call = calls.find(c => c.id === value);
                  if (call) onOpenCall(call);
                }
              }}
            >
              <SelectTrigger className="h-9 min-w-[200px] rounded-xl border-border/60 bg-background text-xs font-bold shadow-sm focus:ring-primary/20">
                <SelectValue placeholder="Focus a meeting..." />
              </SelectTrigger>
              <SelectContent className="max-w-[300px] rounded-xl">
                <SelectItem value="none" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">No focused meeting</SelectItem>
                {calls.map((call) => (
                  <SelectItem key={call.id} value={call.id} className="text-xs font-medium">
                    <div className="flex flex-col gap-0.5">
                      <span className="line-clamp-1">{call.callTitle || "Untitled meeting"}</span>
                      <span className="text-[10px] opacity-60">{call.callDate || "Unknown date"}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedCall && (
              <Button variant="ghost" size="sm" className="h-9 rounded-xl px-3 text-xs font-bold text-muted-foreground hover:bg-red-50 hover:text-red-600" onClick={onClearSelectedCall}>
                Clear
              </Button>
            )}

            {selectedThreadId && (
              <Button
                variant="outline"
                size="sm"
                className="h-9 rounded-xl px-3 text-xs font-bold border-border/60 gap-2"
                onClick={handleShare}
              >
                <Share2 className="h-3.5 w-3.5" />
                Share
              </Button>
            )}
          </div>
        </div>
      </div>

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
            {/* Recent Chats Sidebar */}
            <div className="hidden w-64 flex-col border-r border-border/40 bg-muted/5 lg:flex">
              <div className="p-4 space-y-2">
                <Button
                  className="w-full justify-start gap-2 rounded-xl bg-primary font-bold shadow-lg shadow-primary/20 hover:bg-primary/90"
                  onClick={() => onSelectThread(null)}
                >
                  <Plus className="h-4 w-4" />
                  New Chat
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "w-full justify-start gap-2 rounded-xl px-3 text-xs font-bold",
                    showArchived ? "text-primary bg-primary/5" : "text-muted-foreground"
                  )}
                  onClick={() => setShowArchived(!showArchived)}
                >
                  {showArchived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                  {showArchived ? "Back to Active" : "View Archived"}
                </Button>
              </div>
              <ScrollArea className="flex-1 px-2">
                <div className="space-y-4 pb-4">
                  {loadingThreads ? (
                    <div className="space-y-2 p-2">
                      <Skeleton className="h-10 w-full rounded-lg" />
                      <Skeleton className="h-10 w-full rounded-lg" />
                      <Skeleton className="h-10 w-full rounded-lg" />
                    </div>
                  ) : threads.length === 0 ? (
                    <p className="px-4 py-8 text-center text-xs text-muted-foreground font-medium italic">No recent chats</p>
                  ) : (
                    groupedThreads.map(([group, items]) => (
                      <div key={group} className="space-y-1">
                        <h4 className="px-3 pb-1 pt-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{group}</h4>
                        {items.map((t) => (
                          <div
                            key={t.id}
                            className={cn(
                              "group relative flex w-full items-center gap-1 rounded-xl px-3 py-2 text-left transition-all",
                              selectedThreadId === t.id
                                ? "bg-primary/8 text-primary shadow-sm"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground",
                            )}
                          >
                            <button
                              onClick={() => onSelectThread(t.id)}
                              className="flex-1 text-left min-w-0"
                            >
                              <div className="flex items-center gap-1.5">
                                {t.isPinned && <Pin className="h-2.5 w-2.5 text-primary" />}
                                <p className="truncate text-xs font-bold leading-tight">
                                  {t.title || "New Chat"}
                                </p>
                              </div>
                              {t.lastMessageAt && (
                                <p className="mt-0.5 text-[9px] opacity-60">
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
                                    "h-7 w-7 rounded-lg opacity-0 transition-opacity group-hover:opacity-100",
                                    selectedThreadId === t.id && "opacity-100"
                                  )}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MoreVertical className="h-3.5 w-3.5" />
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
                                  {t.isArchived ? "Restore Chat" : "Archive Chat"}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={(e) => handleDeleteThread(t.id, e)}
                                  className="gap-2 text-xs font-bold text-red-600 focus:bg-red-50 focus:text-red-600"
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
                        Start a conversation
                      </p>
                      <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
                        Ask about a sales call, objection handling, or patterns across recent conversations.
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
                          pending={optimisticPrompt !== null && index === combinedMessages.length - 1 && message.role === "assistant"}
                          callsById={callsById}
                          onOpenCall={onOpenCall}
                        />
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </div>

            <div className="border-t border-border/40 bg-background px-3 py-3 md:px-6 md:py-4">
              <div className="mx-auto max-w-4xl space-y-3">
                {combinedMessages.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {suggestedPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        className="rounded-full border border-border/60 bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition-all hover:border-primary/25 hover:bg-primary/5"
                        onClick={() => setDraft(prompt)}
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                )}

                <form className="relative rounded-[28px] border border-border/50 bg-muted/20 p-2" onSubmit={handleSend}>
                  <Textarea
                    ref={textareaRef}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={handleComposerKeyDown}
                    placeholder="Message Sales Assistant..."
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
    </Card>
  );
};

export default SalesAssistantPanel;
