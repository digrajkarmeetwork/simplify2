# Simplify2 — Automated Small-Business Sales Tracking via WhatsApp + AI

## Context

The owner runs multiple Pizzaville locations and currently tracks monthly sales **by hand**, copying numbers off a daily receipt (in-store + call-center totals on one receipt) plus Uber Eats and Skip the Dishes figures into spreadsheets. This is tedious and error-prone.

**Goal:** Drop a photo of the daily receipt (and Uber/Skip summary screenshots) into a dedicated WhatsApp chat. AI parses the numbers automatically and updates a clean, mobile-first dashboard — one separate dashboard per business/location — with one-tap Excel/PDF export that replaces the manual sheets.

**Repo:** https://github.com/digrajkarmeetwork/simplify2.git (currently empty — greenfield scaffold).

### Key decision: how Uber/Skip data is ingested (important correction)
Direct API pulls are **not viable for a single franchisee in v1**:
- **Uber Eats Reporting API** exists but needs an NDA + licensing agreement and enterprise onboarding via an Uber sales rep (2–4 weeks). Out of scope for v1.
- **Skip the Dishes** has **no public sales-reporting API** (JET Connect only pushes orders into a POS).

**Decision:** Ingest all four channels through the **same WhatsApp + AI image pipeline**. The parser detects the receipt type (Pizzaville / Uber / Skip) and extracts the relevant numbers. A `SalesConnector` interface is left in place so a real Uber Reporting API or email-forward ingestion can be added later without touching the rest of the system.

### Key decision: no Metabase
A custom React dashboard (Recharts + Tailwind/shadcn) beats Metabase here — full control over the mobile-first UX, WhatsApp-native review flow, and custom Excel/PDF export. Metabase would be heavy and fight the mobile experience.

---

## Architecture Overview

```
 Owner's phone (WhatsApp)
        │  sends receipt photo to the app's WhatsApp Business number
        ▼
 Meta WhatsApp Cloud API ──webhook POST──▶ Next.js API route (/api/whatsapp/webhook)
        ▲                                          │ 1. verify X-Hub-Signature-256
        │  confirmation reply ("Got it ✅ …")      │ 2. download media via Graph API
        └──────────────────────────────────────────│ 3. store image → Supabase Storage
                                                    │ 4. Claude vision → structured JSON
                                                    │ 5. match sender→user, receipt→business
                                                    │ 6. upsert sales_entry (idempotent)
                                                    ▼
                                          Supabase Postgres (RLS) + Realtime
                                                    ▼
                                   Next.js dashboard (PWA, mobile-first)
                                   KPIs · charts · monthly table · Excel/PDF export
```

## Tech Stack (cheapest managed, ~$0–10/mo)
- **Next.js (App Router) on Vercel** — single repo for dashboard (server components) + webhook/API routes. Free Hobby tier. PWA for "install to home screen".
- **Supabase (free tier)** — Postgres + Auth + Storage + Realtime. Row-Level Security for per-user/per-business isolation.
- **Anthropic Claude API** — `claude-opus-4-8` vision (or `claude-sonnet-4-6` for cheaper) with **tool-use structured output** for receipt parsing. ~pennies per receipt; the only real recurring cost.
- **Meta WhatsApp Business Cloud API** — free to receive images; free service-message replies within the 24h window.
- **Resend** — transactional email for the monthly auto-export (free tier ~3,000 emails/mo; clean API, attachment support).
- **UI:** Tailwind CSS + shadcn/ui + Recharts.
- **Export:** SheetJS (`xlsx`) for Excel; `@react-pdf/renderer` for PDF.

---

## Data Model (Postgres / Supabase)

- **businesses** — `id, owner_id, name, location_label, timezone, match_keywords text[]` (keywords like store address/number used to auto-route a receipt to the right business).
- **whatsapp_senders** — `phone, user_id` — whitelist mapping the owner's WhatsApp number to their account. Unknown senders are ignored.
- **sales_entries** — `id, business_id, entry_date, channel enum(in_store|call_center|uber_eats|skip_dishes), amount numeric, source enum(whatsapp_ai|manual|api), confidence numeric, status enum(confirmed|needs_review), image_url, raw_extraction jsonb, created_at`.
  - **Unique (business_id, entry_date, channel)** + upsert → idempotent; re-sending the same receipt corrects rather than duplicates.
- **whatsapp_messages** — raw audit log: `wam_id (Meta msg id, unique), sender, media_id, status, error` → idempotency + retry.
- **conversation_state** — `sender, pending_action, options jsonb, expires_at` → for "which store?" disambiguation replies.
- **business_settings** — per-business: `auto_email_enabled bool, email_recipients text[], export_format enum(xlsx|pdf|both)`.
- **day_status** — `business_id, day_date, is_closed bool` → owner can mark a specific day "closed / no sales" so it counts as filled for completeness.
- **monthly_email_log** — `business_id, period (YYYY-MM), status, recipients, file_refs, sent_at` with **unique (business_id, period)** → a completed month is emailed exactly once (idempotent; no duplicate sends on later corrections).

RLS: every table scoped to `owner_id` so each user only sees their own businesses/entries.

---

## Ingestion Pipeline (the core)

1. **Webhook receive** (`app/api/whatsapp/webhook/route.ts`): GET handler for Meta's verify challenge; POST handler verifies `X-Hub-Signature-256` against the app secret, dedupes on Meta `message id`, returns 200 fast and processes async.
2. **Media download**: `GET /{media-id}` (Graph API) → media URL → download bytes with bearer token → store privately in Supabase Storage.
3. **AI parse** (`lib/ai/parseReceipt.ts`): send image to Claude with a tool-use schema →
   `{ receipt_type, business_identifier, entry_date, line_items: [{channel, amount}], confidence, raw_text }`.
   Prompt handles thermal-receipt glare/smudges and the three layouts (Pizzaville daily receipt, Uber summary, Skip summary).
4. **Routing**: map sender → user (whitelist); fuzzy-match `business_identifier` against the user's `businesses.match_keywords`. If ambiguous/low confidence → store `needs_review` and send a WhatsApp reply ("Which store? 1) Main St 2) Downtown"), resolved via `conversation_state`.
5. **Upsert** `sales_entries` (high confidence → `confirmed`; low → `needs_review`).
6. **Confirm reply**: "Got it ✅ Pizzaville Main St — Jun 13: In-store $X, Call-center $Y. Reply EDIT to fix." Dashboard updates live via Supabase Realtime.

**Connector abstraction** (`lib/connectors/`): `SalesConnector` interface with a `WhatsAppImageConnector` (v1). Future `UberReportingConnector` / `EmailForwardConnector` implement the same interface — no pipeline rewrite needed.

---

## Dashboard (mobile-first PWA)

- **Business switcher** at top; each business has its **own separate dashboard** (per the requirement that locations = separate businesses).
- **KPI cards**: today / this week / this month totals + per-channel, with WoW & MoM deltas.
- **Charts** (Recharts): trend line over time; stacked bar / donut for channel mix (in-store vs call-center vs Uber vs Skip).
- **Monthly table** mirroring the current manual sheet layout (familiar drop-in replacement), with inline edit.
- **Review queue**: low-confidence entries shown next to the original receipt image for one-tap correction.
- **Export**: any month/range → **Excel (.xlsx)** and **PDF**, matching the existing sheet format.
- **Mobile UX**: bottom tab nav, large touch targets, responsive cards, installable PWA, offline-friendly read.

---

## Monthly Auto-Email Export (new)

When enabled per business, the app automatically emails the exported monthly sheet to one or more recipients **only once every day of the month is filled in** — if any day is missing, it does **not** send.

- **Settings (per business):** toggle `auto_email_enabled`, manage `email_recipients[]` (one or many), choose format (Excel / PDF / both). Plus a manual **"Send now"** button.
- **Completeness check** (`lib/export/monthIsComplete.ts`): a month is complete when **every calendar day** of the month has **confirmed in-store AND call-center** numbers, **or** is marked closed in `day_status`. **Uber Eats and Skip the Dishes are optional** — their absence never blocks the email (whatever Uber/Skip figures exist are still included in the export). Days where in-store/call-center are still `needs_review` count as **not** filled. The dashboard surfaces remaining missing days so the owner knows exactly what's blocking the send.
- **Trigger:** re-evaluated after each entry is confirmed (event-driven, so it fires the moment the final day lands), plus a daily cron backstop (e.g. Supabase scheduled function) to catch month boundaries. On first transition to complete → generate the export server-side, attach via **Resend**, send to recipients, and write `monthly_email_log` (unique on `business_id+period`) so it's sent exactly once.
- **Idempotency / corrections:** later edits to an already-sent month do **not** auto-resend (avoids spam); the owner can use **"Send now"** to push a corrected copy on demand.

---

## Build Phases

- **Phase 0 — Scaffold:** Next.js + Tailwind + shadcn + Supabase client; schema migrations + RLS; Supabase Auth (Google / magic link). Push to the GitHub repo, wire Vercel + Supabase projects.
- **Phase 1 — Ingestion (single business):** Meta Cloud API setup; webhook verify + signature check; media download; Claude parser with structured output; upsert entry; confirmation reply. *This is the riskiest piece — build & test first.*
- **Phase 2 — Dashboard:** per-business KPIs, charts, monthly table, Realtime updates.
- **Phase 3 — Multi-business + human-in-loop:** business routing/disambiguation, review queue, inline edit, EDIT-reply flow.
- **Phase 4 — Export + polish:** Excel + PDF export, PWA manifest, mobile nav, empty/error states. **Monthly auto-email**: business_settings UI, completeness check, "mark day closed" action, Resend integration, event-driven + cron trigger, "Send now" button.
- **Phase 5 — Optional auto-ingestion (later):** email-forward connector for Uber/Skip daily-summary emails; Uber Reporting API connector if enterprise access is pursued.

---

## Verification (end-to-end)

- **Parser unit tests:** feed sample images of (a) a Pizzaville daily receipt, (b) an Uber summary, (c) a Skip summary → assert extracted channel amounts, date, and business match within tolerance; assert low-quality images flag `needs_review`.
- **Webhook tests:** replay a sample Meta webhook payload → assert signature rejection on bad sig, idempotent no-op on duplicate `message id`, and a created `sales_entry`.
- **Manual E2E:** from a real phone, send a receipt photo to the WhatsApp Business number → confirm reply received, entry appears live on the correct business dashboard, numbers correct.
- **Multi-business routing:** send an ambiguous receipt → assert the "which store?" reply and that answering routes the entry correctly.
- **Export:** generate Excel + PDF for a month → open and verify figures match the dashboard and the old manual sheet layout.
- **Auto-email:** fill in-store + call-center for every day of a test month except one → assert **no** email sends; mark that day **closed** (or fill it) → assert exactly one email with the correct attachment goes to all recipients; verify a day missing only Uber/Skip does **not** block the send; confirm a later confirmed edit does **not** resend, while "Send now" does.
- **RLS:** sign in as a second user → confirm zero visibility into the first user's data.

## Open Items / Risks
- **Meta Business verification** for a production WhatsApp number takes some setup (test number works immediately for development).
- **Parsing accuracy** on smudged thermal receipts → mitigated by confidence scoring + review queue + EDIT reply (always keep human-in-the-loop for low confidence).
- **Claude API key + Anthropic billing** required (small).
