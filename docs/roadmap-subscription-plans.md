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

## Phase 4: Client event screens (API mostly exists)

- [ ] **FE:** Guest list page: add, edit, delete, import a CSV, filter by RSVP status, show the free limit. Backend: `guest.routes.js`.
- [ ] **FE:** Budget and expenses page: set the budget, add, edit and delete expenses, see the overview and payments due. Backend: `budget.routes.js`.
- [ ] **FE:** Checklist page. Backend: `/events/:id/checklist`.
- [ ] **FE:** Seating page. Backend: `eventSeatingRoutes`.
- [ ] **API:** Public RSVP link: a signed token for each guest, a public `GET/POST /rsvp/:token` with no login, and protection against brute force and abuse.
- [ ] **FE:** Public RSVP page that works well on mobile.
- [ ] **API:** Digital invitations: an invitation template, sending by email (and a link that can be shared on WhatsApp), delivery and open status for each guest. Requires the Pass.
- [ ] **FE:** Invitation designer, preview, and the "Send to guests" / "Copy WhatsApp link" actions.

## Phase 5: Escrow and booking commission

- [ ] **Business:** Agree split payments or subaccounts and an escrow arrangement with Paystack or Flutterwave, a licensed partner.
- [ ] **API:** Create a Paystack subaccount when a vendor is verified (bank details are needed at that point).
- [ ] **API:** Add an `EscrowPayment` model (`booking`, `client`, `vendor`, `amount`, `commissionRate`, `commissionAmount`, `status`: held / released / refunded / disputed).
- [ ] **API:** Set the commission rate from the vendor's plan at payment time: Listing 5%, Pro 3%, Business and Venue 2%.
- [ ] **API:** Release rules: the client confirms delivery, or funds auto-release N days after the event. Add refunds and a dispute flow handled by admins.
- [ ] **API:** Payment webhooks for escrow events. Use the paid escrow record as the source of vendor revenue; Payment has no `vendor` field.
- [ ] **FE:**
  - Client: "Pay through Confetti" checkout on bookings and quotes
  - Vendor: payouts page
  - Admin: escrow and disputes screens
- [ ] **Admin:** Commission revenue report.

## Phase 6: Paid featured placement

- [ ] **API:** ₦5,000/week boost purchase that sets `isFeatured` and `featuredUntil`.
- [ ] **API:** Cap boosts per category so search stays fair. Show "sold out" when a category is full.
- [ ] **API:** Monthly featured credits for Business and Venue plans, and a featured venue listing for the Venue plan.
- [ ] **API:** Search ranking: mark boosted results as "Featured", with limited slots.
- [ ] **FE:** "Boost my listing" screen, plus credits balance and expiry.

## Phase 7: Support and planner client portal

- [ ] **API:** User-facing support tickets: create, list mine, reply. `SupportTicket` and the admin routes already exist; no user route creates a ticket today.
- [ ] **API:** Priority flag set automatically for Celebration Plus, Agency and Corporate, and admin queue sorting by priority.
- [ ] **FE:** "Contact support" form and ticket history for clients, vendors and planners.
- [ ] **API:** Client portal: a planner invites a client (a magic link or a client account), and the client sees their event's timeline, budget, documents and approvals as read-only, with comments.
- [ ] **FE:** Client portal pages, and an "Invite client" action in the planner dashboard.

## Phase 8: Celebration Plus features

- [ ] **API and FE:** Day-of schedule and vendor run sheet: time slots per vendor, contacts, a shareable read-only link per vendor, and PDF export.
- [ ] **API and FE:** Gift tracking: gift registry and received gifts, with thank-you status.
- [ ] **API and FE:** Aso-ebi tracking: fabric orders per guest, sizes, payment status and collection status.
- [ ] **API and FE:** Curated vendor shortlist: admin- or expert-picked vendors added to a Plus event, beyond the AI suggestions.

## Phase 9: Venue plan

- [ ] **API:** Venue calendar: spaces or halls per venue, availability per space, and prevention of double booking.
- [ ] **API:** Timed holds: a tentative hold with an expiry date, auto-release of the hold, and conversion to a booking.
- [ ] **API:** Deposit tracking: deposit due, paid and balance schedule. This extends the existing `depositAmount` on `VendorBooking` and on quotes. Payment reminders through notifications.
- [ ] **FE:** Venue calendar view, hold management and deposit status.

## Phase 10: Diaspora Pass

- [ ] **API:** Charge in USD/GBP ($39 / £30). Remove the hardcoded `"NGN"` in the Flutterwave charge in `services/subscription.service.js` and use `plan.getPriceForCurrency()`. Use pass prices in each currency.
- [ ] **API:** Diaspora pass tier: Plus features, with escrow required for vendor payments (depends on Phase 5).
- [ ] **API and FE:** Video calls with vendors: generate a meeting link (Jitsi, Daily or Zoom API) from messages or bookings, and send calendar invites.
- [ ] **FE:** Currency selector at checkout (the frontend `CurrencyContext` already exists).

## Phase 11: Corporate

- [ ] **API:** `Organization` model: company name, billing details, RC number and VAT number, plus members with roles (requester, approver, admin).
- [ ] **API:** Several events and budgets under the organization.
- [ ] **API:** Buying from vendors with approvals: a quote needs an approver's sign-off before booking or payment, and every step is logged.
- [ ] **API:** Invoices and receipts issued in the company's name.
- [ ] **API:** Corporate reports: spending by event, department and vendor, exportable to CSV/PDF.
- [ ] **API:** Annual contract billing (from ₦500,000/year), paid by invoice or bank transfer.
- [ ] **FE:** Company dashboard, approvals inbox and reports.

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
