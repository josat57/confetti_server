# Subscription plans: build roadmap

Gaps between the plans in the business case (section 6) and the code, in build order. Each task notes whether it's backend (API) or frontend (FE) work.

## Phase 1: Fix vendor↔client messaging ✅ done

- [x] **API:** Conversation inbox at `/messages/conversations…` in `routes/communication.routes.js`, declared before `/:id`. The old `routes/message.routes.js` stays unmounted: its controller expects a different message format.
- [x] **API:** Endpoints the frontend calls:
  - `GET /messages/conversations`
  - `POST /messages/conversations`, which accepts a user id or a vendor id; it reuses the existing thread with that person
  - `GET /messages/conversations/:id`
  - `GET /messages/conversations/:id/messages`
  - `POST /messages/conversations/:id/messages`
  - `PATCH /messages/conversations/:id/read`
  - `GET /messages/unread-count`
- [x] **API:** New `Conversation` model, one per pair of users. Messages carry an optional `conversation` field.
  - Unread counts are computed from `Message.status`, so the planner endpoints stay consistent.
  - Older messages are attached to conversations automatically.
  - `/planner/messages` sends now land in the same thread.
- [x] **API:** The recipient is notified (`category: "message"`, `actionUrl` = their inbox `?c=<id>`), once per batch of unread messages.
- [x] **API:** Fixed `GET /messages/:id`, which returned 403 to the message's own participants because it compared populated documents.
- [x] **FE:** Added a shared `components/messages/MessagesInbox.tsx` for the vendor, planner and client inboxes.
  - Shows an error state instead of a silent empty inbox.
  - Refreshes the list on a timer.
  - Supports `?c=` deep links.
- [x] **FE (client):** Added `/user/dashboard/messages`, plus Messages in the sidebar and mobile nav.
- [x] **FE:** "Message" buttons on the planner vendor cards and favourites, on the client "Find Vendors" page and on the client booking detail page.
- [x] **FE:** Unread badges on the vendor, planner and client sidebars.
- [x] **Test:** `npm run test:messaging` in `src/node` covers:
  - client → vendor → client exchange, unread counts and notifications
  - backfill of older messages and the planner endpoints
  - access control, validation and concurrent creation

## Phase 2: Plan limits and the new prices ✅ done

**Prices and billing**

- [x] **One plan catalogue,** `config/plans.js`, defines plan names, levels, limits and features.
  - Vendors: Listing ₦0, Pro ₦7,500, Business ₦20,000, Venue ₦30,000.
  - Planners: Solo ₦0, Studio ₦15,000, Agency ₦40,000.
  - Corporate (from ₦500,000/year) appears on the pricing page as "Talk to us"; it's sold by the team (Phase 11).
- [x] **Plan sync at startup** (`services/plan-catalogue.service.js`).
  - Writes the plans into `SubscriptionPlan`, where admins edit prices.
  - Retires the old names and never overwrites an admin's price change.
  - `scripts/seed-subscription-plans.js` resets every plan to the defaults.
- [x] **Existing subscribers keep working without a data migration.** Old names map to the new plans: Basic→Listing, Professional→Pro, Enterprise→Venue (vendors); Starter→Solo, Professional/Business→Studio, Enterprise→Agency (planners).
- [x] **Yearly billing** costs 10× monthly for 12 months. It works at sign-up and when changing plan.
- [x] **Admins edit prices** through the existing plan admin; restarts keep the edits.
- [x] **FE:**
  - Public pricing has a monthly/yearly toggle, the Corporate card and correct copy.
  - Vendor billing and planner subscription pages use the shared `PlanPicker` and `PlanUsage`.

**Limits** (`services/plan-access.service.js`, counted from real data):

| Limit | Plan | Enforced in |
|---|---|---|
| 10 portfolio photos | Vendor Listing | new portfolio item, add photos, gallery upload |
| 5 lead replies a month | Vendor Listing | first message in a conversation that month, quote sending |
| Team (0 / 5) | Vendor Listing+Pro / Business+Venue | vendor team invite and reactivate |
| 2 / 15 / unlimited active events | Planner Solo / Studio / Agency | `POST /events`, saving an AI plan, mobile sync |
| Team (0 / 3 / 15) | Planner Solo / Studio / Agency | planner team invite (members plus open invitations) |
| 1 event, 100 guests | Client Free | event create, guest add/import, event guests (active once the client role exists) |

- [x] **Feature gates:**
  - Vendor AI routes and the AI proposal writer need Business or above (planners: Studio or above).
  - Advanced analytics need Business or above; revenue totals need Pro or above. The dashboard summary says what's locked.
  - Branded proposals and exports need Agency. New planner branding endpoints at `/planner/settings/branding`.
  - Creating API keys or webhooks needs API access: Agency, plus Venue for vendors moved from the old Enterprise plan.
  - Free plans use local-data AI, with external AI only when local data is too thin. Studio and Business and above get full AI.
- [x] **Errors:** 403 with `code: PLAN_LIMIT_REACHED` / `PLAN_FEATURE_REQUIRED` and `details` (limit, used, upgradeTo).
- [x] **FE:** usage meters, plus an upgrade prompt in every dashboard when an action hits a limit.
- [x] **Promo:** an admin creates a `free_trial` coupon (value = months, e.g. 3) limited to the "Pro" plan and to vendors. It applies when changing plan. It can't yet be entered at sign-up.

**Billing bugs fixed along the way**

- Upgrades were free: a duplicate `upgradeSubscription` switched plans without charging, and vendor settings "change plan" did the same.
- Paystack charged 100× the price; proration charged 1/100th.
- A payment could be applied twice (webhook plus redirect). Confirmation is now atomic and checks the amount and currency paid.
- Paystack payers always landed on the error page (the callback expected a `status` that Paystack doesn't send).
- Subscription upgrade, downgrade, cancel and usage endpoints worked on anyone's subscription. Ownership is now checked.
- `GET /subscriptions/plans` always returned 500.
- Cancelling removed paid features at once. They now last until the paid period ends, and cancellation can be undone.
- Downgrades now apply at the end of the period.
- Free plans expired after a month.
- Trials could be restarted over and over (now once per account).
- USD sign-ups failed the price check (floating point); a second, conflicting verification email was sent after payment.
- Old plan names locked paying planners out of reports and calendar sync, and AI plan levels were 0 for every paying user.
- The vendor plan gate rejected every vendor (it read a subscription link that's never set).
- Any signed-in user could edit or delete any vendor through `/vendors/:id` routes. These are now owner or admin only.
- Free vendors failed the frontend tier check (`basic` is level 0); upgrade buttons sent signed-in users to the public sign-up page.

## Phase 3: Per-event passes for clients ✅ done

- [x] **API:** `EventPass` model, one per event: `event`, `user`, `tier` (celebration / plus / diaspora), `status`, `amount`, `currency`, `paymentRef`, history. Passes are defined in `config/plans.js` (`EVENT_PASSES`).
- [x] **API:** One-time payment with Flutterwave or Paystack (`POST /event-passes/checkout`).
  - Completion is atomic and checks the amount: through the production webhooks (`/webhooks/payment/…`, reference `PASS-…`) or the redirect (`GET /event-passes/callback` → the event page).
  - Upgrading Celebration → Plus charges only the difference.
  - Only client accounts can buy a pass, and only for their own events.
- [x] **API:** `requireEventPass(feature)` (per event) and `requireClientPass(feature)` (any pass on the account). Planners and vendors aren't affected.
  - **Free:** one event at a time (events with a pass don't count), local-data AI, 100 guests, vendor search and messaging, budget overview.
  - **Celebration Pass (₦15,000):**
    - unlimited guests
    - expense tracking
    - full AI for the account
    - AI plan chat, refinement and chat sessions
    - PDF export and sharing with family
  - **Celebration Plus (₦45,000):** everything in the Celebration Pass. Its own features (run sheet, gifts, aso-ebi, priority support, curated shortlist) carry flags that Phases 7–8 will use.
  - **Diaspora Pass:** defined, not on sale until Phase 10.
- [x] **FE:**
  - Client event page (`/user/dashboard/events/[id]`) with the pass badge and an "Upgrade this event" panel that goes to checkout and back.
  - Pass badges on the events list.
  - An "Upgrade your event" prompt when a pass feature is used.
- [x] **Fixed along the way:**
  - `GET /events` returned every user's events. It now returns only the user's own.
  - Client event creation failed validation (wrong field names).
  - The client events list crashed on the API's date field.
- [x] **Tests:** `npm run test:passes`.

## Phase 4: Client event screens ✅ done

Screens are under `/user/dashboard/events/[id]/…` with tabs: Overview, Guests, Budget, Checklist, Seating, Invitations.

- [x] **FE Guests:**
  - add, edit and delete
  - CSV import with a template (rows without a name, or with an email already listed, are skipped)
  - filter by reply and search
  - set a guest's RSVP by hand
  - stats (attending, awaiting reply, expected including plus-ones) and the free 100-guest meter
  - per-guest invitation status, with "copy RSVP link" and WhatsApp buttons (pass)
- [x] **FE Budget:**
  - set the total and currency
  - overview: spent, remaining, by category, alerts
  - payments due
  - expenses: add, edit, delete (pass; without one, the screen explains)
- [x] **FE Checklist:** add, tick off, edit, delete, progress and overdue count, and "Suggest tasks". The starter checklist is based on the event type, with due dates counted back from the event, and isn't duplicated.
- [x] **FE Seating:**
  - tables with names and capacities
  - seat each guest from a dropdown
  - capacity counts plus-ones and warns when a table is over
  - removing a table unseats its guests
- [x] **API Public RSVP:** `GET/POST /rsvp/:token` with no login.
  - The token is 64 random hex characters (unguessable); invalid tokens always get a 404.
  - Rate limited per IP (it fails open if Redis is down).
  - The RSVP deadline and the event date are enforced.
  - The host is notified of each change of answer.
- [x] **FE Public RSVP page:** `/rsvp/[token]`, mobile-first. It records the answer, plus-one, dietary needs and a note, and the answer can be changed later.
- [x] **API Digital invitations:** `/events/:eventId/invitation`.
  - The design (title, hosts, message, dress code, venue, theme, accent colour, deadline, plus-ones) needs a pass to save.
  - Emails go out with each guest's RSVP link (pass); a send can be all not yet invited, everyone again, or chosen guests.
  - WhatsApp links per guest, with Nigerian numbers converted (080… → 23480…).
  - Per-guest status: not sent, sent, failed or opened (opened is tracked by the email pixel or a visit to the link).
- [x] **FE Invitation designer:**
  - live preview, the same card guests see
  - save, "email guests not yet invited", "resend to everyone"
  - delivery stats
- [x] **Fixed along the way:**
  - Adding or importing guests always failed (`planner` was never set).
  - The event guest and seating routes had **no authentication**, and guest edit, delete and RSVP had no ownership check.
  - Guest updates wrote whatever the request contained; the RSVP stats were always empty.
  - The budget didn't work for clients' events.
  - The checklist endpoint always returned 500 (it called a model method that doesn't exist).
  - An Event virtual crashed whenever an event was populated with selected fields, affecting the budget, bookings, plans and more.
- [x] **Tests:** `npm run test:event-screens`.

## Phase 5: Escrow and booking commission ✅ built (needs the partner agreement to go live)

- [ ] **Business:** agree escrow and payouts with Paystack (or Flutterwave). Holding customer funds needs their approval, and Paystack Transfers must be enabled before `ESCROW_PAYOUTS=paystack`. Until then payouts run in **manual** mode: admins pay vendors and mark the payouts paid.
- [x] **API:** Vendor payout account (`/vendors/payouts/account`).
  - The bank account is checked with Paystack and a transfer recipient is created.
  - A split subaccount is created when the vendor is verified, by a Vendor model hook that covers every approval path.
  - The account number is kept only encrypted; screens show the last 4 digits.
- [x] **API:** `EscrowPayment` model (booking, client, vendor, amount, commission rate, status held / released / refunded / disputed, plus payout, refund, dispute and history).
- [x] **API:** The commission rate comes from the vendor's plan at payment time: Listing 5%, Pro 3%, Business and Venue 2%.
- [x] **API:** Client checkout (`POST /escrow/checkout`) on vendor-confirmed or quoted bookings, for the balance or part of it. Paying a quote accepts it.
- [x] **API:** Release when the client confirms delivery, or automatically `ESCROW_AUTO_RELEASE_DAYS` (3) after the event (hourly job).
  - Disputes from either side stop the automatic release.
  - Admin resolution: release, refund, or split (refund part, release the rest with commission on the released part).
  - Refunds go through the original provider; if the provider refuses, the refund is marked for a manual refund.
- [x] **API:** Webhooks: escrow payments (`ESC-…`) complete atomically with the amount checked; payout transfers (`PAYOUT-…`, Paystack `transfer.*`, Flutterwave `transfer.completed`) update the payout status.
- [x] **API:** Escrow payments count in the vendor's dashboard revenue and on the booking's paid and outstanding amounts.
- [x] **FE:**
  - Client: "Pay through Confetti" on the client booking page and the planner bookings page, with confirm delivery and report a problem.
  - Vendor: Payouts page (`/vendor/dashboard/payouts`) with the payout account, totals and every payment's fee and payout status.
  - Admin: Escrow & Commission page with disputes and payouts.
- [x] **Admin:** Commission report: collected, commission earned, held, under review, owed to vendors, by month and by rate.
- [x] **Tests:** `npm run test:escrow`.

## Phase 6: Paid featured placement ✅ done

- [x] **API:** ₦5,000/week boost purchase (1–4 weeks) through the same atomic, amount-checked payment path (`BOOST-…`).
  - It sets `isFeatured`/`featuredUntil`, so the existing `/vendors/featured` endpoint and dashboard show it.
  - A vendor's boosts run back to back.
  - Only approved profiles can be boosted.
- [x] **API:** A cap per category (`FEATURED_SLOTS_PER_CATEGORY`, default 6) over the boost dates. When full: "sold out" with the date the next slot opens. A vendor's own running boost doesn't block extending it.
- [x] **API:** Monthly featured credits (Business 1 week, Venue 2) that expire at the month's end. The featured venue listing: Venue-plan venues are always in the rotation for venue searches.
- [x] **API:** Search ranking: the first results page shows up to 3 featured vendors matching the filters, rotated at random, marked `featured: true` and deduplicated from the organic results.
- [x] **FE:** "Boost listing" page (`/vendor/dashboard/boost`): featured status, slots or sold out, credits (balance and expiry), buying 1–4 weeks, past boosts.
- [x] **Fixed along the way:** the vendor directory (client "Find Vendors" and planner "Vendors") always showed "No vendors found".
  - The search returned `data`, while the pages read `vendors`/`total`/`totalPages`.
  - The rating filter (`minRating`) and the category labels ("Music & Entertainment" …) weren't understood.
  - The cards' fields (`location.city`, `pricing`, `portfolio`, `contactInfo`, `description`) were missing.
- [x] **Tests:** `npm run test:featured`.

## Phase 7: Support and planner client portal ✅ done

- [x] **API:** User support tickets (`/support/tickets`): create, list mine, view (admin internal notes never shown), reply (reopens a resolved ticket), close, rate. Up to 20 open tickets per user.
- [x] **API:** Priority set automatically from the plan (Agency) or an event pass (Celebration Plus, Diaspora): high priority, a 4-hour first-response target (24 hours otherwise), and a "Priority support" badge for admins. The admin queue sorts by priority by default (a numeric `priorityRank`, kept in sync on save). Corporate is added when Phase 11 gives it the feature.
- [x] **FE:** "Help & support" in the client, planner and vendor dashboards: new request, history, conversation, reply, close, rating, and `?ticket=` links (used by the email notifications).
- [x] **API:** Client portal (Studio plan and above):
  - The planner invites the client by email and gets a private link per person (up to 10). Links can be copied or revoked, with "last viewed".
  - The client sees the schedule, checklist progress, budget and expenses, and the documents the planner chooses to share (signed links that expire after 7 days).
  - The client can approve or ask for changes on approval requests, and comment.
  - The planner is notified; the client is emailed about new approvals and planner comments.
- [x] **FE:** Planner portal page (`/planner/dashboard/events/[id]/portal`, from "Client portal" on the event): invite, approvals, documents to share, comments. Public client page `/portal/[token]` (mobile-first, no account, no sign-in redirect).
- [x] **Fixed along the way:** admin ticket emails linked to pages that don't exist and inserted the reply unescaped; tickets had no number (the emails referenced one).
- [x] **Tests:** `npm run test:support-portal`.

## Phase 8: Celebration Plus features ✅ done

All four need a Celebration Plus pass on the event (clients get `PASS_REQUIRED` otherwise; planners use them on their own events). Screens are new tabs on the client event page, marked "Plus", with an upgrade card when the event doesn't have the pass.

- [x] **API and FE:** Day-of schedule and vendor run sheet (`/events/:eventId/run-sheet`).
  - Vendors on the day (role, contact, arrival time), with "Add my booked vendors" from confirmed bookings.
  - Timeline entries by time (and day, for multi-day events), each for one vendor or shown to every vendor.
  - Who vendors call on the day, and general notes.
  - A private read-only link per vendor (`/run-sheet/[token]`, no account): their own slots, the moments for everyone, the day-of contact, and the other vendors' names (not their phone numbers). Links can be emailed to the vendor and turned off.
  - PDF export of the whole sheet, and of each vendor's part from their link.
- [x] **API and FE:** Gift tracking (`/events/:eventId/gifts`).
  - Registry items (price, link, quantity wanted and received) and gifts received (from a guest or anyone, cash or item, against a registry item).
  - Thank-you status per gift, marked one at a time or in bulk, with a method; a filter for thank-yous still to send. Totals for cash received and registry fulfilled.
- [x] **API and FE:** Aso-ebi tracking (`/events/:eventId/aso-ebi`).
  - Fabrics with a price per unit and optional stock (orders can't go over it).
  - Orders per person or guest: quantity, size or measurements, amount due (from the fabric price), part payments recorded by method (and removable), payment status, and collection status (not ready, ready, collected; also in bulk).
  - Filters, totals, and a CSV export for the tailor (spreadsheet formulas neutralised).
- [x] **API and FE:** Curated vendor shortlist (`/events/:eventId/shortlist` for clients, `/admin/curation` for admins with `vendor_management`).
  - The client sends a brief (vendor types, budget, notes). Admins work through a queue of Plus events (waiting first), search approved vendors, add them with a note on why, and send the list; the client gets a notification and an email.
  - The client likes or hides picks, messages vendors and asks for quotes from the list. Vendors no longer approved drop off the client's list.
- [x] **Tests:** `npm run test:celebration-plus`.

## Phase 9: Venue plan ✅ done

- [x] **API:** Venue calendar (`/vendors/venue`, Venue plan only).
  - Spaces (halls) per venue with capacity and a day price; a space with history is switched off rather than deleted.
  - Reservations per space by day and session (full day, morning, evening), up to 14 days at a time.
  - Double booking is impossible: each space, day and half-day is a lock document with a unique index, so racing requests can't both win. Conflicts come back as `VENUE_DATE_TAKEN` with who holds the dates.
  - Moving a reservation re-checks the new slots first and keeps the old ones if the move fails.
- [x] **API:** Timed holds. Default 3 days (`VENUE_HOLD_DAYS`), up to 60. A job every 15 minutes expires them and frees the dates, and warns the vendor once a day before. Holds can be extended, released or converted to a booking.
  - Booking (directly or from a hold) creates or links a `VendorBooking`, so it shows on the bookings page. Cancelling that booking frees the space.
- [x] **API:** Deposit tracking. `VendorBooking.paymentSchedule` (instalments with due dates; must add up to the total) and `depositDueDate`. Payments are applied in due-date order, so each instalment shows paid, part paid, due soon or overdue.
  - Without a schedule: deposit + balance (due on the event date).
  - Reminders to the vendor and the client (in-app and email) 3 days before and when overdue, once per stage. Instalments overdue for more than 14 days aren't chased.
- [x] **FE:** Vendor "Venue" page: month calendar per space, holds and bookings list (book it, +3 days, release), spaces. Payment schedule editor on the vendor booking page; schedule shown to clients and planners on their bookings.
- [x] **Tests:** `npm run test:venue`.

## Phase 10: Diaspora Pass ✅ done

- [x] **API:** The Diaspora Pass is on sale in USD ($39) and GBP (£30). Subscriptions and passes already charged `plan.getPriceForCurrency()` (no hardcoded NGN left); Paystack is refused for currencies it can't take (GBP, EUR) with a clear message.
- [x] **API:** Diaspora tier: all Plus features, plus:
  - Paying vendors from abroad: escrow checkout in USD/GBP via Flutterwave at the configured rate (`FX_NGN_PER_USD`, `FX_NGN_PER_GBP`, `FX_BUFFER`). The vendor is held and paid in naira; refunds go back in the charged currency, in proportion.
  - Escrow required: on a Diaspora event's bookings the vendor can't record payments made outside Confetti (`ESCROW_REQUIRED`).
- [x] **API and FE:** Video calls (`/meetings`) from a conversation or a booking: a message in the conversation, notifications, and email invites with an `.ics` calendar file. Reschedule and cancel send updated invites. Clients need a pass with video calls; vendors and planners can start calls.
  - With `DAILY_API_KEY`: a private Daily.co room per call with a personal join link for each person (no sign-in), open from 30 minutes before to an hour after; moved with the call and deleted when it's cancelled.
  - Without it (or if Daily can't be reached): a Jitsi Meet room (`JITSI_BASE_URL`).
- [x] **FE:** Currency choice when buying a pass and in the plan picker (`CurrencyContext` now includes GBP); "Pay in USD/GBP" with the converted amount on the booking payment panel; "Video call" button in messages and on booking pages.
- [x] **Tests:** `npm run test:diaspora`.

## Phase 11: Corporate ✅ done

- [x] **API:** `Organization` model: company name, registered name, RC and VAT numbers, billing email and address; members with roles (admin, approver, requester) and departments; email invitations accepted with the invited address.
  - A person can belong to up to 10 companies (planners often serve several), with a role in each; the app sends the chosen one as `X-Organization-Id`. Vendors can't create or join a company.
- [x] **API:** Company events (created under the company or moved there) with event budgets, and yearly department budgets. Company events on an active contract get the Celebration Plus features; members get priority support.
- [x] **API:** Buying from vendors with approvals: purchase requests (`PR-2026-0001`) for bookings on company events. A vendor can't confirm, nobody can pay, and the vendor's quote can't be accepted from its public link, until it's approved and the amount fits within the approval (`APPROVAL_REQUIRED`). Nobody approves their own request; purchases under the company's limit are approved automatically; every step is logged.
- [x] **API:** Invoices in the company's name (`CFT-2026-0001`) with VAT (`CORPORATE_VAT_RATE`), as PDF; paid invoices download as receipts. Receipts in the company's name for every vendor payment made through Confetti.
- [x] **API:** Reports: spending by event, department (against budget) and vendor for any period, plus approved-but-unpaid and waiting-for-approval totals; CSV and PDF export.
- [x] **API:** Annual contract billing from ₦500,000 + VAT: the company requests it, a Confetti admin (`/admin/corporate`, financial oversight) issues the invoice, the company pays by card or bank transfer (admin marks it received). Renewal invoices go out 30 days before the end; lapsed contracts expire.
- [x] **FE:** Company area at `/company` (overview, events, approvals, reports, billing, people and settings, join link), linked from client and planner sidebars; admin "Corporate accounts" page.
- [x] **Tests:** `npm run test:corporate`.

## Issues found during Phases 1–2 ✅ all fixed

- [x] **Client accounts.**
  - New `user` role, and a "My event" tab on the pricing page that signs people up for the free client plan (no subscription).
  - Vendor search and booking requests are mounted before the planner-only `/planner` router and allow both planners and clients.
- [x] **Client bookings.** New `/users/bookings` endpoints (request, list, detail, cancel) and `/users/dashboard/stats` and `/users/activity`.
  - A quote request creates a booking the client owns, plus a lead for the vendor, and notifies the vendor.
  - The client dashboard calls these directly; the silent fallbacks are gone.
- [x] **Vendors see their bookings.** `/vendors/bookings` has its own controller (`controllers/vendor-booking.controller.js`) for the vendor dashboard:
  - list, stats, upcoming bookings, detail, create, edit
  - confirm, cancel and complete, which notify the client
  - notes, payments and deposits
  - a confirmation email and a PDF contract
- [x] **Planner "Book" flow:** a new `/planner/dashboard/bookings` page, also in the sidebar.
- [x] **Planner "View Profile":** a new `/planner/dashboard/vendors/[id]` page with Save, Message and Book.
- [x] **Leads can be messaged.** Leads from signed-in clients store `customerUser`, and the lead page has "Message Client".
- [x] **Vendor dashboard revenue** comes from payments recorded on the vendor's invoices. The monthly trend now shows the latest 12 months.
- [x] **`POST /vendors/:id/portfolio`** stores items in the Portfolio collection, with the photo limit applied.
- [x] **`req.planner` is set.** The planner profile lookup uses `userId`.
- [x] **API access for planners**, at `/planner/api-access/api-keys` and `/planner/api-access/webhooks`.
  - Keys belong to a user and are accepted through the `x-api-key` header. On every call the key must be active, unexpired and from an allowed IP, and the owner's plan must still include API access.
  - Account, billing and key endpoints refuse keys.
  - Before this, creating keys and webhooks always failed, and nothing accepted keys.
- [x] **Automatic renewal** (`services/subscription-renewal.service.js`, hourly).
  - The saved card is charged for the next period, which starts where the old one ends, and a scheduled downgrade is applied at renewal.
  - Up to 3 attempts, 12 hours apart. Without a card the plan lapses to free.
  - The expiry reminders now actually run: once per stage, for subscriptions that won't renew automatically.
- [x] **Coupons at sign-up.** The code is checked before the account is created. Free-months coupons apply at once; discounts lead to the reduced payment.
- [x] **Security:** `GET /users`, `GET /users/:id` and `PATCH /users/:id/active|lock` were open to any signed-in user. They're now admin-only.

Tests: `npm run test:messaging`, `npm run test:plans`, `npm run test:issues` (in `src/node`).

## Dependencies

- Phases 1–4 have no dependencies and can be shipped in any order.
- Phase 5 depends on a payment partner agreement.
- Phase 10's escrow depends on Phase 5, and Phase 6's fair search depends on Phase 2.
- Every gate on a plan or pass depends on Phase 2's middleware.
