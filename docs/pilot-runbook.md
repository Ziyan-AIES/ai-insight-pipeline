# Internal pilot runbook

Keep the SharePoint list as the system of record during a two-week pilot. Use
this dashboard in parallel with 3–10 trusted colleagues and do not bulk-migrate
or retire SharePoint until the exit criteria below pass.
Use `docs/pilot-feedback.md` for the first-use and end-of-pilot interviews.

## Before inviting colleagues

1. Apply every Supabase migration and run `supabase test db`.
2. Assign one admin, at least one editor, and the remaining users as members.
3. Configure separate `CAPTURE_WRITE_TOKEN` and `EDITORIAL_WRITE_TOKEN` values.
4. Confirm Netlify deploy checks, `npm test`, `npm run build`, and
   `npm run test:e2e` pass.
5. Export the current database and complete one restore drill in a non-production
   Supabase project.
6. Record the extension version and test capture, duplicate capture, status,
   editorial processing, archive, restore, and a denied member action.

## Weekly review

Run `npm run pilot:report` with `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` configured. Review:

- captures received and duplicate captures;
- pending, processed, failed, and deleted news counts;
- median editorial turnaround;
- failed editorial runs and expired leases;
- concurrent-edit conflicts and restored records;
- activity by contributor, with unexpected admin actions investigated;
- colleague feedback on capture clarity, duplicate handling, and topic linking.

Do not copy article text, tokens, email addresses, or service credentials into
feedback documents.

## Incident response

1. Stop editorial scheduling if unexpected overwrites or repeated failures occur.
2. Rotate the affected capture/editorial token.
3. Preserve the activity and capture event records.
4. Restore soft-deleted content in the UI or with an admin-only database action.
5. If database restoration is required, restore into a separate project first,
   compare counts and checksums, then schedule the production recovery.

## SharePoint replacement exit criteria

- No unexplained data loss or silent write failures during the pilot.
- Duplicate capture never resets processed editorial content.
- Member, editor, and admin permission tests pass.
- Simultaneous edits produce a visible conflict instead of silent overwrite.
- Realtime changes appear on a second browser and reconnect after network loss.
- A deleted item is restored successfully, and a database backup restore drill
  is documented.
- Extension and editorial credentials are independently revocable.
- Every material human or automated change is attributable in activity history.
- Colleagues can add and find news without owner assistance.
- A complete CSV/JSON export is available before SharePoint is retired.

Microsoft Entra SSO remains optional for this small pilot. Reassess it with IT
before expanding access or treating the dashboard as a managed enterprise
system.
