import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/beta-lodges")({
  component: () => <Outlet />,
});

