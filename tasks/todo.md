# Tap to Pay Redesign — Final

## Decision
The existing QR system (Scan QR + Receive) already provides the optimal 3-click payment flow.
NFC Tap to Pay is deferred to the virtual cards phase.

## Changes Made
- [x] Home screen: "Tap to Pay" quick action → "Receive" (routes to `/receive`)
- [x] Home screen: secondary "Receive" → "Accounts" (avoid duplicate, add useful shortcut)
- [x] Removed payment_requests API functions from `lib/api.ts`
- [x] Deleted migration 031 (payment_requests table not needed)
- [x] Failed transactions filtered from activity (`.neq('status', 'failed')`)

## Click Counts (3-click rule ✅)
- **Receive**: Home → Receive (1) → QR shows instantly (done) → optional: set amount (2)
- **Pay**: Home → Scan QR (1) → auto-scan (0) → confirm payment (2)

## Deferred: NFC with Virtual Cards
The NFC/Tap to Pay concept will be reimplemented in a future phase using virtual cards,
not the current NDEF tag read/write approach which doesn't work phone-to-phone.
