# Plan - Fix Logo Upload and Bucket Not Found Error

The user is experiencing a "Bucket not found" error when trying to upload a logo in the `LandingPageSettings` component. Investigation shows the code is trying to upload to a bucket named `public`, but this bucket does not exist. The existing public buckets are `product-images` and `store-assets`. I will switch to using `store-assets` for reseller logos.

## Proposed Changes

### Storage Configuration
- Create the `store-assets` bucket if it doesn't exist (though it seems to exist based on the query).
- Ensure RLS policies for `storage.objects` allow authenticated users to upload to `store-assets`.

### Frontend
- Update `src/components/reseller/LandingPageSettings.tsx` to use the `store-assets` bucket instead of `public`.
- Update `src/components/reseller/ResellerBasicInfo.tsx` (if it also handles uploads) to ensure consistency.

## Technical Details
- **Bucket Change**: In `LandingPageSettings.tsx`, change `.from('public')` to `.from('store-assets')`.
- **Database**: Add a migration to ensure proper RLS policies for the `store-assets` bucket if missing.

## Constraints & Considerations
- Use Lovable Cloud (Supabase) tools for all backend changes.
- Ensure only authenticated resellers can upload to their specific path in the bucket.
