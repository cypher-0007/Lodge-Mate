import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Building2,
  CalendarCheck,
  CheckCircle2,
  ExternalLink,
  MessageCircle,
  Send,
  ShieldAlert,
  User,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { SiteHeader } from "@/components/site-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import {
  type Conversation,
  type Message,
  useConversationsQuery,
  useMarkConversationRead,
  useMessagesQuery,
  useSendMessageMutation,
} from "@/lib/messaging";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/messages")({
  validateSearch: (search: Record<string, unknown>): { conversation_id?: string | undefined } => ({
    conversation_id:
      typeof search["conversation_id"] === "string" ? search["conversation_id"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Messages — LodgeMate" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MessagesPage,
});

function getInitials(name: string): string {
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length === 0) return "LM";
  if (parts.length === 1) return (parts[0] || "").slice(0, 2).toUpperCase();
  return ((parts[0]?.[0] || "") + (parts[parts.length - 1]?.[0] || "")).toUpperCase();
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return date.toLocaleDateString([], { weekday: "short" });
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function MessagesPage() {
  const { user } = useAuth();
  const search = Route.useSearch();
  const navigate = useNavigate();

  const { data: conversations = [], isLoading } = useConversationsQuery(user?.id);
  const [activeConvId, setActiveConvId] = useState<string | null>(
    search.conversation_id ?? null
  );
  const [mobileView, setMobileView] = useState<"list" | "thread">(
    search.conversation_id ? "thread" : "list"
  );

  // Sync URL param
  useEffect(() => {
    if (search.conversation_id && search.conversation_id !== activeConvId) {
      setActiveConvId(search.conversation_id);
      setMobileView("thread");
    }
  }, [search.conversation_id]);

  // Auto-select first conversation on desktop if none selected
  useEffect(() => {
    if (!activeConvId && conversations.length > 0) {
      const firstId = conversations[0]?.id;
      if (firstId) setActiveConvId(firstId);
    }
  }, [conversations, activeConvId]);

  const activeConv = conversations.find((c) => c.id === activeConvId) ?? null;

  const handleSelectConversation = (conv: Conversation) => {
    setActiveConvId(conv.id);
    setMobileView("thread");
    navigate({
      to: "/messages",
      search: { conversation_id: conv.id },
      replace: true,
    });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1 flex flex-col">
        <div className="mx-auto flex w-full max-w-7xl flex-1 border-x border-border/60 bg-card overflow-hidden h-[calc(100vh-4rem)]">
          {/* Left Column: Conversation Directory */}
          <section
            aria-label="Conversation list"
            className={cn(
              "flex flex-col border-r border-border/70 bg-card",
              "w-full md:w-80 lg:w-96 md:flex shrink-0",
              mobileView === "thread" ? "hidden md:flex" : "flex"
            )}
          >
            {/* Inbox Header */}
            <div className="border-b border-border/70 px-4 py-4 bg-muted/20">
              <div className="flex items-center justify-between">
                <h1 className="font-display text-lg font-bold text-foreground">Messages</h1>
                <span className="text-xs font-medium text-muted-foreground">
                  {conversations.length} {conversations.length === 1 ? "thread" : "threads"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Direct inquiries with hosts, agents, and roommates
              </p>
            </div>

            {/* Conversation List */}
            <div className="flex-1 overflow-y-auto divide-y divide-border/40">
              {isLoading ? (
                <div className="flex flex-col gap-3 p-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-start gap-3 animate-pulse">
                      <div className="h-10 w-10 rounded-full bg-muted shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 bg-muted rounded w-3/4" />
                        <div className="h-2.5 bg-muted rounded w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16 px-4 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                    <MessageCircle className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">No conversations yet</p>
                    <p className="text-xs text-muted-foreground leading-relaxed mt-1 max-w-[240px]">
                      Ask questions about rooms, borehole water, or schedule visits by clicking
                      "Message Host" on any listing.
                    </p>
                  </div>
                </div>
              ) : (
                conversations.map((conv) => (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => handleSelectConversation(conv)}
                    className={cn(
                      "flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/50",
                      conv.id === activeConvId && "bg-muted/80"
                    )}
                  >
                    <Avatar className="h-10 w-10 shrink-0 border border-border/70">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                        {getInitials(conv.otherParticipantName ?? "LM")}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-foreground truncate">
                          {conv.otherParticipantName ?? "Host"}
                        </span>
                        <span className="text-[11px] text-muted-foreground shrink-0">
                          {formatRelativeTime(conv.last_message_at)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 mt-0.5">
                        {conv.otherParticipantRole && (
                          <span className="inline-block text-[10px] font-medium text-muted-foreground bg-secondary/80 border border-border/60 rounded-md px-1.5 py-0.2">
                            {conv.otherParticipantRole}
                          </span>
                        )}
                        {conv.listingArea && (
                          <span className="text-[10px] text-muted-foreground truncate">
                            · {conv.listingArea}
                          </span>
                        )}
                      </div>

                      {conv.listingTitle && (
                        <p className="text-[11px] font-medium text-foreground/80 truncate mt-1">
                          {conv.listingTitle}
                        </p>
                      )}

                      <div className="flex items-center justify-between mt-1">
                        <p className="text-xs text-muted-foreground truncate max-w-[190px]">
                          {conv.last_message_snippet || "Click to open conversation…"}
                        </p>
                        {(conv.unreadCount ?? 0) > 0 && (
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground shrink-0">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </section>

          {/* Right Column: Active Thread Pane */}
          <section
            aria-label="Active conversation"
            className={cn(
              "flex flex-col flex-1 min-w-0 bg-background",
              mobileView === "list" ? "hidden md:flex" : "flex"
            )}
          >
            {activeConv ? (
              <ThreadPane
                conversation={activeConv}
                userId={user?.id ?? ""}
                onBack={() => setMobileView("list")}
              />
            ) : (
              <div className="hidden md:flex flex-col items-center justify-center flex-1 gap-4 text-center px-8">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                  <MessageCircle className="h-8 w-8" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Select a conversation</p>
                  <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                    Choose an accommodation thread from the left to view messages, ask questions, or arrange an inspection.
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function ThreadPane({
  conversation: conv,
  userId,
  onBack,
}: {
  conversation: Conversation;
  userId: string;
  onBack: () => void;
}) {
  const { data: messages = [], isLoading } = useMessagesQuery(conv.id);
  const sendMessage = useSendMessageMutation(conv.id);
  const markRead = useMarkConversationRead(conv.id, userId);
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Mark as read when thread opens or changes
  useEffect(() => {
    markRead.mutate();
  }, [conv.id]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const content = draft.trim();
    if (!content || sendMessage.isPending) return;
    setDraft("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    await sendMessage.mutateAsync({ content, senderId: userId });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDraft(e.target.value);
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
    }
  };

  const remaining = 3000 - draft.length;

  return (
    <div className="flex flex-col h-full">
      {/* Thread Header */}
      <div className="flex items-center justify-between border-b border-border/70 px-4 py-3 shrink-0 bg-card">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="md:hidden flex h-8 w-8 items-center justify-center rounded-lg border border-border/70 text-muted-foreground hover:bg-muted"
            aria-label="Back to conversations"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          <Avatar className="h-9 w-9 shrink-0 border border-border/70">
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
              {getInitials(conv.otherParticipantName ?? "LM")}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">
              {conv.otherParticipantName ?? "Host"}
            </p>
            {conv.otherParticipantRole && (
              <p className="text-[11px] text-muted-foreground">
                {conv.otherParticipantRole}
              </p>
            )}
          </div>
        </div>

        {conv.listing_id && (
          <Button
            variant="outline"
            size="sm"
            asChild
            className="hidden sm:inline-flex h-8 gap-1.5 rounded-lg text-xs font-semibold"
          >
            <a href={`/listings/${conv.listing_id}`} target="_blank" rel="noreferrer">
              <span>View listing</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </Button>
        )}
      </div>

      {/* Listing Context Banner */}
      {conv.listingTitle && (
        <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-muted/40 px-4 py-2.5 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 text-primary shrink-0">
              <Building2 className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">{conv.listingTitle}</p>
              {conv.listingPrice && (
                <p className="text-[11px] text-muted-foreground truncate">{conv.listingPrice}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Safety Notice Watermark */}
      <div className="flex items-start gap-2 border-b border-warning/30 bg-warning/10 px-4 py-2 text-[11px] text-warning-foreground shrink-0">
        <ShieldAlert className="h-3.5 w-3.5 text-warning mt-0.5 shrink-0" />
        <span className="leading-tight">
          <strong>LodgeMate Safety:</strong> Always inspect the room in person during daylight. Never transfer rent, caution, or reservation fees before physically visiting the lodge.
        </span>
      </div>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-muted/10">
        {isLoading ? (
          <div className="flex flex-col gap-3 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className={cn(
                  "max-w-[70%] h-12 rounded-2xl bg-muted",
                  i % 2 === 0 ? "ml-auto" : ""
                )}
              />
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <User className="h-5 w-5" />
            </div>
            <p className="text-xs text-muted-foreground">
              Send a message to ask about room availability, amenities, or moving in.
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} isMine={msg.sender_id === userId} />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Message Composer */}
      <div className="border-t border-border/70 bg-card px-4 py-3 shrink-0">
        {sendMessage.isError && (
          <p className="mb-2 text-xs text-destructive">
            Failed to send message. Please check your connection and retry.
          </p>
        )}
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              rows={1}
              value={draft}
              onChange={handleTextareaInput}
              onKeyDown={handleKeyDown}
              placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
              maxLength={3000}
              className="w-full resize-none rounded-xl border border-border/80 bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-hidden focus:ring-1 focus:ring-primary/40 overflow-hidden"
              style={{ minHeight: "42px", maxHeight: "120px" }}
            />
            {draft.length > 2700 && (
              <span
                className={cn(
                  "absolute right-2 bottom-2 text-[10px] font-mono",
                  remaining < 100 ? "text-destructive font-bold" : "text-muted-foreground"
                )}
              >
                {remaining}
              </span>
            )}
          </div>
          <Button
            type="button"
            size="icon"
            onClick={handleSend}
            disabled={!draft.trim() || sendMessage.isPending || draft.length > 3000}
            className="h-10 w-10 shrink-0 rounded-xl bg-canopy text-primary-foreground shadow-xs"
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message: msg, isMine }: { message: Message; isMine: boolean }) {
  return (
    <div className={cn("flex", isMine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-xs",
          isMine
            ? "bg-canopy text-primary-foreground rounded-br-xs"
            : "bg-card border border-border/80 text-foreground rounded-bl-xs"
        )}
      >
        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
        <p
          className={cn(
            "mt-1 text-[10px]",
            isMine ? "text-primary-foreground/75 text-right" : "text-muted-foreground"
          )}
        >
          {new Date(msg.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
}
