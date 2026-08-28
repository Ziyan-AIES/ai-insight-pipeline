# AI Signals Chrome extension

This folder is the Chrome extension that captures links into the AI Insight Pipeline dashboard.

It uses the **same magic-link login and `team_members` list** as the dashboard. There is no display-name field and no shared capture token in the extension.

## Reload required

After updating these files you **must reload the unpacked extension** in `chrome://extensions` (Developer mode → Reload). Existing tabs also need a refresh before the new capture UI appears.

Version **0.2.1** keeps the extension signed in with a 30-minute session refresh alarm. The dashboard handshake stays valid for 24 hours so a slow work-email magic link still connects. Remaining signed in for about two months also depends on the Supabase Auth refresh-token lifetime in the project settings.

## Sign in

1. Load this `extension/` folder as an unpacked Chrome extension.
2. Open the extension panel on any news page (the **AI** button), or open Options.
3. Choose **Sign in with work email**. Chrome opens the dashboard at `/?extension_auth=1&state=…`.
4. Complete the work-email magic link. The dashboard shows **Capture access enabled** and stays on Daily/Weekly (it does not replace the workspace with a blank card).
5. Return to the article tab. The extension updates to the capture panel automatically. You do not need to look for capture UI on the dashboard itself.
6. If your account is in `team_members`, contributor names come from the team profile.
7. If you are signed in but not on that list, the extension shows **Access not enabled** and capture stays blocked.

Default workspace URL: `https://aiinsightpipeline.netlify.app`. When you are signed out and no origin is stored, Options can show a workspace URL field (for a Netlify preview, for example).

## Source of truth

The live extension repository is [browser-signal-watcher](https://github.com/Ziyan-AIES/browser-signal-watcher). If that repo could not be pushed from this agent, copy this `extension/` directory over `browser-signal-watcher/extension/`.
