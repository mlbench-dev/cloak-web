# Working Memory

## Product Rules

- Verified users should show the shared verified badge next to their username everywhere relevant.
- Submit report stays blocked until the link is valid and reachable.
- Disabled-looking submit buttons should still explain missing requirements when tapped.
- Auto-detected report platform should lock the selector for known platforms.
- Verification rejection should prefer real provider reasons over generic copy.

## Recent Changes

- Added recent-search persistence for searched users even before report submission.
- Added `appflow.md` and `memory.md` for future context updates.
- Added profile photo source picker with both camera capture and file upload options on all devices.
- Added live desktop/mobile camera capture for profile editing with front-camera output corrected before save.
- Reduced profile camera preview zoom by switching from a square stream request to a standard `4:3` camera stream and keeping the preview contained.
- Matched the profile camera sheet styling to the protected-media capture screen so both capture flows feel consistent.
- Added a minimum-zoom camera-track pass for supported mobile browsers to reduce the overly zoomed selfie preview while keeping the frame filled.
- Added a success toast after profile updates.
- Updated reference-media `Verify Identity` to start verification in the background and redirect to dashboard with a “check Profile later” toast.
- Updated `/verification` to show the pending “we are verifying you” state only when the protected-media verify request is truly in progress.
- Restored the rejected -> document -> reference-media -> back flow so a plain document re-submit does not get treated as active verification.
- Smoothed the profile document-submit transition by navigating directly to `reference-media?mode=profile` and suppressing the temporary submitted-state flash.
- Moved the profile submit route change ahead of the session refresh so the URL no longer waits on `update()` before entering `reference-media`.

## Follow Up Notes

- Keep this file short and update it after meaningful user-facing changes.
- Keep `appflow.md` focused on navigation and state flow, not low-level implementation detail.
