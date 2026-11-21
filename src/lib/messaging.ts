import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";

// ============================================================
// Intent Preservation (Guest → Auth → Conversation)
// ============================================================

export interface MessageIntentPayload {
  intent: "message";
  listingId?: string | undefined;
  recipientId: string;
  recipientName: string;
  recipientRole: "landlord" | "agent" | "student";
  returnTo: string;
}

export interface InspectionIntentPayload {
  intent: "inspection";
  listingId: string;
  listingTitle?: string | undefined;
  returnTo: string;
}

export interface BookmarkIntentPayload {
  intent: "bookmark";
  listingId: string;
  listingTitle?: string | undefined;
  returnTo: string;
}

export type AuthIntentPayload =
  | MessageIntentPayload
  | InspectionIntentPayload
  | BookmarkIntentPayload;

const INTENT_KEY = "lodgemate_auth_intent";

export function saveMessageIntent(payload: MessageIntentPayload): void {
  if (typeof window === "undefined") return;
  const serialized = JSON.stringify(payload);
  window.sessionStorage.setItem(INTENT_KEY, serialized);
  window.localStorage.setItem("lodgemate_auth_intent_backup", serialized);
  window.localStorage.setItem("lodgemate_pending_return_to", payload.returnTo);
}

export function saveInspectionIntent(payload: InspectionIntentPayload): void {
  if (typeof window === "undefined") return;
  const serialized = JSON.stringify(payload);
  window.sessionStorage.setItem(INTENT_KEY, serialized);
  window.localStorage.setItem("lodgemate_auth_intent_backup", serialized);
  window.localStorage.setItem("lodgemate_pending_return_to", payload.returnTo);
}

export function saveBookmarkIntent(payload: BookmarkIntentPayload): void {
  if (typeof window === "undefined") return;
  const serialized = JSON.stringify(payload);
  window.sessionStorage.setItem(INTENT_KEY, serialized);
  window.localStorage.setItem("lodgemate_auth_intent_backup", serialized);
  window.localStorage.setItem("lodgemate_pending_return_to", payload.returnTo);
}

export function consumeMessageIntent(): AuthIntentPayload | null {
  if (typeof window === "undefined") return null;
  let raw = window.sessionStorage.getItem(INTENT_KEY);
  if (!raw) {
    raw = window.localStorage.getItem("lodgemate_auth_intent_backup");
    if (raw) {
      window.localStorage.removeItem("lodgemate_auth_intent_backup");
    }
  } else {
    window.sessionStorage.removeItem(INTENT_KEY);
    window.localStorage.removeItem("lodgemate_auth_intent_backup");
  }
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthIntentPayload;
  } catch {
    return null;
  }
}

export function peekMessageIntent(): AuthIntentPayload | null {
  if (typeof window === "undefined") return null;
  const raw =
    window.sessionStorage.getItem(INTENT_KEY) ||
    window.localStorage.getItem("lodgemate_auth_intent_backup");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthIntentPayload;
  } catch {
    return null;
  }
}

export function getSafeReturnUrl(targetUrl: string | null | undefined): string {
  if (!targetUrl) return "/dashboard";
  const clean = targetUrl.trim();
  if (
    clean.startsWith("/") &&
    !clean.startsWith("//") &&
    !clean.includes("\\") &&
    (clean.startsWith("/listings/") ||
      clean.startsWith("/browse") ||
      clean.startsWith("/messages") ||
      clean.startsWith("/dashboard") ||
      clean.startsWith("/host"))
  ) {
    return clean;
  }
  return "/dashboard";
}

// ============================================================
// Types
// ============================================================

export interface Conversation {
  id: string;
  listing_id: string | null;
  created_by: string;
  last_message_at: string;
  last_message_snippet: string;
  created_at: string;
  updated_at: string;
  // Resolved client-side attributes
  otherParticipantId?: string;
  otherParticipantName?: string;
  otherParticipantRole?: string;
  listingTitle?: string;
  listingArea?: string;
  listingPrice?: string;
  unreadCount?: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  message_type: "text" | "system" | "inspection_prompt";
  metadata: Record<string, unknown>;
  created_at: string;
}

// ============================================================
// Mock data for preview / local dev mode
// ============================================================

function isLocalDevPreview(): boolean {
  if (typeof window === "undefined") return false;
  return !isSupabaseConfigured();
}

const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: "mock-conv-1",
    listing_id: "palmview-selfcon",
    created_by: "mock-student-1",
    last_message_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    last_message_snippet: "Yes, inspection is fine for tomorrow",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    otherParticipantId: "mock-provider-1",
    otherParticipantName: "Mr. Emeka Okonkwo",
    otherParticipantRole: "Landlord",
    listingTitle: "PalmView Self-Con, Ishiagu Gate",
    listingArea: "Ishiagu",
    listingPrice: "₦280,000/year",
    unreadCount: 1,
  },
  {
    id: "mock-conv-2",
    listing_id: null,
    created_by: "mock-student-1",
    last_message_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    last_message_snippet: "Are you in 300L?",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    otherParticipantId: "mock-student-2",
    otherParticipantName: "Chiamaka N.",
    otherParticipantRole: "Student",
    listingTitle: "Shared Bedspace (ABSU)",
    unreadCount: 0,
  },
];

const MOCK_MESSAGES: Record<string, Message[]> = {
  "mock-conv-1": [
    {
      id: "msg-1",
      conversation_id: "mock-conv-1",
      sender_id: "mock-student-1",
      content: "Hello sir, is constant borehole water available?",
      message_type: "text",
      metadata: {},
      created_at: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
    },
    {
      id: "msg-2",
      conversation_id: "mock-conv-1",
      sender_id: "mock-provider-1",
      content:
        "Yes, borehole runs morning and evening. You can schedule an inspection to see it running.",
      message_type: "text",
      metadata: {},
      created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    },
  ],
  "mock-conv-2": [
    {
      id: "msg-3",
      conversation_id: "mock-conv-2",
      sender_id: "mock-student-2",
      content: "Hello! Saw your profile for the shared room. Are you in 300L?",
      message_type: "text",
      metadata: {},
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    },
  ],
};

// ============================================================
// React Query Hooks
// ============================================================

export function useConversationsQuery(userId: string | undefined) {
  return useQuery({
    queryKey: ["conversations", userId],
    enabled: !!userId,
    queryFn: async (): Promise<Conversation[]> => {
      if (isLocalDevPreview()) return MOCK_CONVERSATIONS;

      try {
        const client = supabase as any;
        const { data: participantRows, error: pErr } = await client
          .from("conversation_participants")
          .select("conversation_id, last_read_at")
          .eq("user_id", userId!);

        if (pErr || !participantRows || participantRows.length === 0) {
          return [];
        }

        const convIds = participantRows.map((p: any) => p.conversation_id);

        const { data: convRows, error: cErr } = await client
          .from("conversations")
          .select("*")
          .in("id", convIds)
          .order("last_message_at", { ascending: false });

        if (cErr || !convRows) return [];
        return convRows as Conversation[];
      } catch {
        return [];
      }
    },
    staleTime: 1000 * 30,
  });
}

export function useMessagesQuery(conversationId: string | null) {
  return useQuery({
    queryKey: ["messages", conversationId],
    enabled: !!conversationId,
    queryFn: async (): Promise<Message[]> => {
      if (!conversationId) return [];
      if (isLocalDevPreview()) {
        return MOCK_MESSAGES[conversationId] ?? [];
      }

      try {
        const client = supabase as any;
        const { data, error } = await client
          .from("messages")
          .select("*")
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: true });

        if (error || !data) return [];
        return data as Message[];
      } catch {
        return [];
      }
    },
    staleTime: 0,
    refetchInterval: 5000,
  });
}

export function useUnreadCountQuery(userId: string | undefined) {
  return useQuery({
    queryKey: ["unread-count", userId],
    enabled: !!userId,
    queryFn: async (): Promise<number> => {
      if (!userId) return 0;
      if (isLocalDevPreview()) {
        return MOCK_CONVERSATIONS.reduce((acc, c) => acc + (c.unreadCount ?? 0), 0);
      }

      try {
        const client = supabase as any;
        const { data, error } = await client.rpc("get_total_unread_messages_count");
        if (error) return 0;
        return Number(data ?? 0);
      } catch {
        return 0;
      }
    },
    refetchInterval: 15000,
    staleTime: 10000,
  });
}

export function useSendMessageMutation(conversationId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      content,
      senderId,
    }: {
      content: string;
      senderId: string;
    }) => {
      if (!conversationId) throw new Error("No active conversation");

      if (isLocalDevPreview()) {
        const newMsg: Message = {
          id: `msg-${Date.now()}`,
          conversation_id: conversationId,
          sender_id: senderId,
          content: content.trim(),
          message_type: "text",
          metadata: {},
          created_at: new Date().toISOString(),
        };
        if (!MOCK_MESSAGES[conversationId]) {
          MOCK_MESSAGES[conversationId] = [];
        }
        MOCK_MESSAGES[conversationId]!.push(newMsg);
        await new Promise((r) => setTimeout(r, 200));
        return;
      }

      const client = supabase as any;
      const { error } = await client.from("messages").insert({
        conversation_id: conversationId,
        sender_id: senderId,
        content: content.trim(),
        message_type: "text",
        metadata: {},
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages", conversationId] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

export async function getOrCreateConversation(
  recipientId: string,
  listingId?: string | null
): Promise<string> {
  if (isLocalDevPreview()) {
    return "mock-conv-1";
  }

  const client = supabase as any;
  const { data, error } = await client.rpc("get_or_create_conversation", {
    _recipient_id: recipientId,
    _listing_id: listingId ?? null,
  });

  if (error) throw error;
  return data as string;
}

export function useMarkConversationRead(conversationId: string | null, userId: string | undefined) {
  return useMutation({
    mutationFn: async () => {
      if (!conversationId || !userId || isLocalDevPreview()) return;
      try {
        const client = supabase as any;
        await client
          .from("conversation_participants")
          .update({ last_read_at: new Date().toISOString() })
          .eq("conversation_id", conversationId)
          .eq("user_id", userId);
      } catch {
        // silent fail on mark-read
      }
    },
  });
}
