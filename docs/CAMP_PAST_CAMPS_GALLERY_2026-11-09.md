# Camp Rise Again Past Camps Gallery

## Public experience
- `/past-camps` displays **published albums only**.
- A selected album shows **approved photos and videos only** in a mobile-friendly gallery.
- Tap a photo for a larger viewer, or play an approved video in the lightbox.
- The homepage and both desktop/mobile menus link to Past Camps.
- If no album has been approved yet, visitors see a "Memories are on the way" message. An existing draft never appears automatically.

## Staff workflow
In `/admin`, choose **Past Camps Gallery**.

1. Create a titled album. Date, location, and description are optional. New albums are unpublished drafts.
2. Select an album, then upload up to 10 photo/video files at a time.
3. Add a caption; describe photos for accessibility.
4. Review sharing permission for everyone identifiable in the image or video (including guardian permissions if relevant). Tick permission and **Publish** on each item, then **Save Media**.
5. Tick **Show this album publicly** and **Save Album**. Visitors now see only items individually approved and published.
6. Reorder media or albums using up/down buttons, edit captions, unpublish, or delete items. To delete an album, remove its files first.

A draft **Fall Camp 2026** album was created based on the November 6, 2026 Austin gathering already described on the homepage. It is **unpublished** and has no photos.

## Media and privacy
- Storage bucket `camp-rise-again-past-camps` is **private**, limited to 45 MiB/object, and restricts MIME to JPEG, PNG, WebP, MP4, WebM, and QuickTime MOV.
- The browser re-encodes uploaded photos to JPEG, maximum dimension 1920px, generally reducing file size and stripping camera GPS/EXIF.
- Uploaded photos can be up to 25MB before preparation and up to 10MB afterward.
- Videos can be up to 45MB. MP4/WebM are preferable for reliable browser playback; MOV playback may be limited by browser.
- Videos are **not transcoded** and may retain location or camera metadata. Inspect/export without metadata before uploading when required.
- The dedicated private Supabase Edge bridge checks a verified admin Supabase JWT plus a separate Vercel server bearer before issuing a two-hour signed upload authorization to a random storage path.
- After upload, the Edge function checks storage file size and MIME before marking the media complete.
- Database constraints prevent publication if approval or upload completion is missing; published photos require descriptive alt text.
- Public reads only include albums with `is_published=true` and media with all of `is_published`, `upload_complete`, and `consent_confirmed`. Public media URLs are signed for 15 minutes and the page is rendered dynamically.
- Private admin previews use short-lived signed URLs. Publishing visibility can be switched off immediately, but **previously issued signed media URLs may remain usable until expiration**. Do not upload material lacking permission.

## Tests / verification
1. CI: `npm run test:mail` and `npm run build`.
2. Database: verify private bucket, table RLS, non-admin grants revoked, draft album unpublished; test release constraint in a rollback transaction.
3. Deploy updated `camp-email-bridge` Edge Function and confirm the existing Resend signed-webhook replay still returns HTTP 200.
4. After merge, verify Vercel production Ready and `/past-camps` available.
5. Authorized admin should upload one non-sensitive test photo and a small MP4, verify that both stay private until individually approved and the album is published, then delete tests or leave drafts. Check an anonymous visitor cannot access the underlying storage URL directly.
6. When media becomes public, check phone/desktop playback, captions, reordering, accessibility descriptions, and hide/unpublish behavior.

## Cost and limits
Large video files can increase Supabase Storage storage and bandwidth usage. The current implementation uses browser uploads to private Supabase Storage with signed tokens, not Vercel server upload bandwidth. For videos over 45MB or non-browser-compatible MOV formats, prepare/compress to MP4 or add a dedicated resumable/transcoding workflow.

The gallery is separate from confidential camper applications and their staff notifications.
