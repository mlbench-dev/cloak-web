# Cloak App Flow

## Main User Journey

- Landing/auth starts at `/` and moves through email OTP, username, profile photo, identity verification, and onboarding reference media.
- Protected app access is gated through `app/(protected)/layout.tsx`.
- Onboarding step labels currently follow:
  - username `1/3`
  - profile photo `2/3`
  - identity verification `3/3`

## Profile Photo Flow

- Profile edit screen lives in `app/(protected)/profile/page.tsx`.
- Editing a profile photo now uses an explicit source picker.
- Available options on both mobile and desktop:
  - `Take Photo`
  - `Upload From Device`
- Live camera capture supports switching front/back camera.
- Front-camera captures are flipped back before save so the final uploaded image is not mirrored.
- Live camera preview now uses a regular `4:3` stream with `object-contain` to avoid the zoomed/cropped look on mobile.
- The profile camera sheet now follows the same full-screen capture design language as `app/components/reference-media/CaptureScreen.tsx`.
- On supported mobile browsers, the profile camera now explicitly resets the video track to its minimum zoom level to reduce the overly close selfie framing.
- Captured or uploaded photos still go through the existing crop flow before save.
- Successful profile updates show a toast confirmation.

## Verification Flow

- Identity documents are submitted through `/api/auth/identity-verify`.
- Profile document submit now redirects straight to `/reference-media?mode=profile` without showing the temporary identity-submitted confirmation card first.
- The profile document flow now navigates before the session refresh resolves, so the URL handoff into `reference-media` is more immediate.
- Reference media verification runs through `/api/reference-media/verify`.
- After tapping `Verify Identity` on reference media, verification starts in the background and the user is redirected to `/dashboard` with a “check Profile later” toast.
- The pending verification screen is shown only when the protected-media verify API has actually started and is still in progress.
- A document re-submit that has not yet called protected-media verification should not show the active “we are verifying you” screen.
- Verification result screen is shown on `/verification?status=APPROVED|REJECTED`.
- Rejected verification can show:
  - actual provider failure reason
  - user-friendly similarity labels
  - recent verification result summaries

## Reports Flow

- Submit report page: `app/(protected)/submit-report/page.tsx`
- My reports page: `/my-reports`
- Report details page: `/reports/[id]`
- Source link must be:
  - valid URL format
  - reachable by server check
- Platform auto-detect locks the selector when a known platform is detected.
- Recent searches should include searched users even without report submission.
