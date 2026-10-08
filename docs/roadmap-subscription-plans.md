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

## Phase 2: Plan limits and the new prices

**Prices and billing**

- [ ] **API:** Replace the plan table in `services/subscription.service.js` with the document's plans:
  - Vendors: Listing ₦0, Pro ₦7,500, Business ₦20,000, Venue ₦30,000
  - Planners: Solo ₦0, Studio ₦15,000, Agency ₦40,000
  - Corporate: from ₦500,000/year
- [ ] **API:** Map the new plan names to plan levels in `universal-ai.service.js` `featureAccess`, and migrate existing subscribers to the nearest new plan.
- [ ] **API:** Make yearly billing real: charge 10× the monthly price for 12 months, honour `billingCycle: "yearly"` at checkout and set the correct expiry date.
- [ ] **API:** Let admins edit prices, so the yearly increase of up to 10% needs no code change.
- [ ] **FE:** Update the pricing and upgrade pages (vendor, planner, public) with the new plans and a monthly/yearly toggle.

**Limit enforcement:** one `enforcePlanLimit(resource)` middleware plus a usage counter.

| Limit | Plan | Where to enforce |
|---|---|---|
| 10 portfolio photos | Vendor Listing | Portfolio and photo upload routes |
| 5 lead replies a month | Vendor Listing | Lead reply and quote send |
| Team up to 5 | Vendor Business (and Venue) | Vendor team invite |
| 2 active events | Planner Solo | Event create |
| 15 active events | Planner Studio | Event create |
| Team of 3 / 15 | Planner Studio / Agency | Planner team invite |
| 1 event | Client Free | Event create |
| 100 guests | Client Free | Guest create and import |

- [ ] **API:** Implement the middleware and apply it to every route in the table.
- [ ] **API:** Feature gates:
  - AI proposal writer: Business and above
  - Advanced analytics: Business and above. Split the analytics response into basic and advanced.
  - Branded proposals and exports: Agency
  - API access: Agency only. `api-access.routes.js` is currently open to every signed-in user.
  - Full AI vs local-data AI: Free and Solo get the local model only
- [ ] **API:** Return a consistent `402/403 PLAN_LIMIT_REACHED` error with an upgrade hint.
- [ ] **FE:** Show usage meters ("7 of 10 photos") and an upgrade prompt when that error is returned.
- [ ] **Promo:** Use `couponRoutes` to offer Pro free for 3 months for the launch campaign.

## Phase 3: Per-event passes for clients

- [ ] **API:** Add an `EventPass` model (`event`, `user`, `tier`: celebration / plus / diaspora, `amount`, `currency`, `paymentRef`, `status`).
- [ ] **API:** One-time payment with Paystack and Flutterwave: initiate, verify, webhook. Activate the pass on a successful webhook.
- [ ] **API:** Make `requireEventPass(tier)` middleware that checks the pass for that event.
  - Free: 1 event, AI plan from local data, 100 guests, vendor search and messaging, checklist and budget overview
  - Celebration Pass (₦15,000): full AI plan with refinements and chat, unlimited guests, RSVPs, digital invites, budget tracking and PDF export, sharing with family, rating and refining
  - Celebration Plus (₦45,000): everything in Pass, plus the day-of run sheet, gift and aso-ebi tracking, priority support and a curated shortlist
- [ ] **FE:** "Upgrade this event" screen, checkout, and pass badges on the event page.

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

## Issues found during Phase 1 (not yet fixed)

- [ ] **No client accounts.** Registration only creates `vendor` or `event-planner` (`controllers/auth.controller.js`), and the User schema has no `user` role. The client dashboard (`/user/dashboard`, which requires `role === "user"`) is unreachable, so people planning their own event use the planner dashboard. Fix before Phase 3/4: add the `user` role and a "planning my own event" option at sign-up.
- [ ] **Vendors see no bookings.** `/vendors/bookings` uses the planner booking controller, which filters `planner: req.user._id`. It also returns `VendorBooking` documents, while the vendor booking page expects a `client` object.
- [ ] **Planner "Book" flow** redirects to `/planner/dashboard/bookings`, which doesn't exist.
- [ ] **Planner "View Profile"** on vendor cards links to `/planner/dashboard/vendors/[id]`, which doesn't exist.
- [ ] **Leads can't be messaged.** Leads have no linked user account, so vendors reply to leads by email or phone. Linking a lead to the client's account when they're signed in would allow it.

## Dependencies

- Phases 1–4 have no dependencies and can be shipped in any order.
- Phase 5 depends on a payment partner agreement.
- Phase 10's escrow depends on Phase 5, and Phase 6's fair search depends on Phase 2.
- Every gate on a plan or pass depends on Phase 2's middleware.
