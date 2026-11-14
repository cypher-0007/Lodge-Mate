-- ==============================================================================
-- Migration: Student Profile & Inspection Scheduling Enhancements
-- Description: Adds optional student accommodation preference fields to profiles
-- and structured time slot tracking to inspections.
-- NOTE: THIS MIGRATION IS DRAFTED AND HAS NOT BEEN APPLIED TO REMOTE PRODUCTION.
-- ==============================================================================

-- 1. Extend profiles with student academic and accommodation preference columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS level text,
  ADD COLUMN IF NOT EXISTS preferred_kind text,
  ADD COLUMN IF NOT EXISTS budget_min integer,
  ADD COLUMN IF NOT EXISTS budget_max integer,
  ADD COLUMN IF NOT EXISTS preferred_area text;

-- 2. Extend inspections with time_slot column
ALTER TABLE public.inspections
  ADD COLUMN IF NOT EXISTS time_slot text;

