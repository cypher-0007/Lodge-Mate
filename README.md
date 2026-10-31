# LodgeMate

LodgeMate is a student housing marketplace for MOUAU and ABSU. It helps students browse lodges, bedspaces, and tenancy takeovers, arrange inspections, and check provider details before paying.

## Run locally

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env` and add the Supabase project values.
3. Start the development server with `npm run dev`.

Create a production build with `npm run build` and serve it with `npm run preview`.

## Main screens

- Browse listings and inspect listing details.
- Sign in and create student or landlord accounts.
- Manage inspections and listings in the student and host dashboards.
- Review reports and users in the admin dashboard.
- Read safety guidance, FAQs, and contact information.

## Supabase configuration

The app uses Supabase for authentication and marketplace data. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` for the browser. Server-side operations also use `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. Keep the service role key private and never prefix it with `VITE_`.

The Supabase schema and policies are in `supabase/`. The `.env` file from the reference clone was intentionally not imported; configure this project with its own Supabase credentials.
