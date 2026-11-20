import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      const returnTo =
        typeof window !== "undefined"
          ? window.location.pathname + window.location.search
          : "/dashboard";
      throw redirect({
        to: "/auth",
        search: { returnTo },
      });
    }

    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);

    const roles = (roleRows ?? []).map((r) => r.role);
    const isHost = roles.includes("landlord") || roles.includes("admin");
    const isStudent = roles.includes("student") || (!roles.includes("landlord") && !roles.includes("admin"));

    return {
      user: data.user,
      roles,
      isHost,
      isStudent,
      isAdmin: roles.includes("admin"),
    };
  },
  component: () => <Outlet />,
});
