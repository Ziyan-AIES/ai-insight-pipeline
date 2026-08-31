# AI Signals Chrome extension

This folder is the Chrome extension that captures links into the AI Insight Pipeline dashboard.

It uses the **same magic-link login and `team_members` list** as the dashboard. There is no display-name field and no shared capture token in the extension.

## Reload required

After updating these files you **must reload the unpacked extension** in `chrome://extensions` (Developer mode → Reload). Existing tabs also need a refresh before the new capture UI appears.

Version **0.4.1** uses the official Qira color logomark on a compact white orb. Hover reveals Capture above the orb and Dashboard below it. Capture opens a small composer where a team member can add an optional thought before saving; success, duplicate, access, and retry outcomes are explicit.

Dashboard and extension keep credentials in their own browser security boundaries, but synchronize the same verified Supabase session on the trusted Dashboard origin. Opening either surface while the other is signed in should connect it automatically. Signing out from the Dashboard also signs out the extension.

The bundled `qira-mark.svg` is sourced from Lenovo's official Qira product page and is kept local so the extension UI works without loading a remote image.

## Sign in

1. Load this `extension/` folder as an unpacked Chrome extension.
2. On a news page, hover the **Qira mark** and click Sign in (or use Options).
3. Complete the work-email magic link. The dashboard may briefly show **Connecting Chrome extension**, then returns to Daily/Weekly with no persistent sign-in banner.
4. Return to the article tab. Hover the **Qira mark** and click Capture. Optionally add a thought, then save. The result says whether the signal was saved, enriched, deduplicated, or needs a retry.
5. Dashboard opens from the grid icon. Capture UI is not shown on the dashboard after you are signed in.

Default workspace URL: `https://aiinsightpipeline.netlify.app`. It is fixed in the normal team-member UI; development overrides remain supported through extension storage.

## Settings

Settings follows the Dashboard's muted editorial visual system and exposes only account status, Open Dashboard, Sign out, and the functional floating-button toggle. Capture category is always detected from the page and can be corrected later in the Dashboard.

## Source of truth

The canonical extension source is this `ai-insight-pipeline/extension` directory. Load this folder in Chrome and make future extension changes here. Standalone Browser Signal Watcher copies are historical mirrors and do not need to be kept in sync unless a separate distribution repository is intentionally revived.
