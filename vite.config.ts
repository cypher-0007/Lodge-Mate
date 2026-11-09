import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const isVercel = Boolean(process.env["VERCEL"]);

export default defineConfig({
  // This project supports both Vite and Next-style public environment variable
  // names. Expose the latter to the browser so the existing Supabase settings
  // in .env.local are available to the authentication client.
  envPrefix: ["VITE_", "NEXT_PUBLIC_"],
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    tailwindcss(),
    tanstackStart({
      server: { entry: "server" },
    }),
    nitro(isVercel ? { preset: "vercel" } : {}),
    viteReact(),
  ],
});
