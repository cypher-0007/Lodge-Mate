import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type UserInspection = {
  id: string;
  preferred_date: string | null;
  note: string | null;
  status: string;
  created_at: string;
  student_id: string;
  listings: {
    id: string;
    title: string;
    area: string;
    owner_id: string;
  } | null;
};

export type UserNotification = {
  id: string;
  version: string;
  title: string;
  description: string;
  createdAt: string;
  href: "/inspections" | "/host";
  status: string;
};

export function useUserInspectionsQuery(userId: string | undefined) {
  return useQuery({
    queryKey: ["user-inspections", userId],
    enabled: !!userId,
    refetchInterval: 30_000,
    queryFn: async (): Promise<UserInspection[]> => {
      const { data, error } = await (supabase as any)
        .from("inspections")
        .select("id, preferred_date, note, status, created_at, student_id, listings!inner(id, title, area, owner_id)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as UserInspection[];
    },
  });
}

function readStateFor(userId: string): Record<string, string> {
  try {
    return JSON.parse(window.localStorage.getItem(`lodgemate-notifications-read:${userId}`) ?? "{}");
  } catch {
    return {};
  }
}

export function useUserNotifications(userId: string | undefined, isHost: boolean) {
  const inspections = useUserInspectionsQuery(userId);
  const listings = useQuery({
    queryKey: ["notification-listings", userId],
    enabled: !!userId && isHost,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("id, title, status, updated_at")
        .eq("owner_id", userId!)
        .order("updated_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  const [readState, setReadState] = useState<Record<string, string>>({});
  const [readStateReady, setReadStateReady] = useState(false);

  useEffect(() => {
    if (!userId) {
      setReadState({});
      setReadStateReady(true);
      return;
    }
    setReadState(readStateFor(userId));
    setReadStateReady(true);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const syncReadState = (event: Event) => {
      const notificationEvent = event as CustomEvent<{ userId?: string }>;
      if (notificationEvent.detail?.userId === userId) setReadState(readStateFor(userId));
    };
    window.addEventListener("lodgemate-notifications-read", syncReadState);
    return () => window.removeEventListener("lodgemate-notifications-read", syncReadState);
  }, [userId]);

  const notifications = useMemo(() => {
    if (!userId) return [];
    const items: UserNotification[] = [];

    for (const inspection of inspections.data ?? []) {
      const incoming = isHost && inspection.listings?.owner_id === userId;
      const outgoing = inspection.student_id === userId;
      if (!incoming && !outgoing) continue;

      const title = incoming
        ? inspection.status === "pending" ? "New inspection request"
          : inspection.status === "confirmed" ? "Inspection confirmed"
            : "Inspection request declined"
        : inspection.status === "pending" ? "Inspection request sent"
          : inspection.status === "confirmed" ? "Inspection confirmed"
            : "Inspection request declined";
      const date = inspection.preferred_date
        ? new Date(`${inspection.preferred_date}T00:00:00`).toLocaleDateString()
        : "Flexible date";
      items.push({
        id: `inspection:${inspection.id}:${inspection.status}`,
        version: `${inspection.status}:${inspection.created_at}`,
        title,
        description: `${inspection.listings?.title ?? "Accommodation"} · ${date}`,
        createdAt: inspection.created_at,
        href: "/inspections",
        status: inspection.status,
      });
    }

    if (isHost) {
      for (const listing of listings.data ?? []) {
        const title = listing.status === "approved" ? "Your listing is approved"
          : listing.status === "rejected" ? "Your listing needs changes"
            : listing.status === "removed" ? "Listing marked as taken"
              : "Your listing is awaiting review";
        items.push({
          id: `listing:${listing.id}`,
          version: `${listing.status}:${listing.updated_at}`,
          title,
          description: listing.title,
          createdAt: listing.updated_at,
          href: "/host",
          status: listing.status,
        });
      }
    }

    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [inspections.data, isHost, listings.data, userId]);

  const unreadCount = readStateReady
    ? notifications.filter((item) => readState[item.id] !== item.version).length
    : 0;
  const unreadIds = useMemo(
    () => new Set(notifications.filter((item) => readState[item.id] !== item.version).map((item) => item.id)),
    [notifications, readState],
  );

  const markAllAsRead = () => {
    if (!userId) return;
    const nextState = { ...readState };
    for (const item of notifications) nextState[item.id] = item.version;
    window.localStorage.setItem(`lodgemate-notifications-read:${userId}`, JSON.stringify(nextState));
    setReadState(nextState);
    window.dispatchEvent(new CustomEvent("lodgemate-notifications-read", { detail: { userId } }));
  };

  return {
    notifications,
    unreadCount,
    unreadIds,
    markAllAsRead,
    isLoading: inspections.isLoading || (isHost && listings.isLoading),
    error: inspections.error ?? (isHost ? listings.error : null),
  };
}
