# AI Signals Chrome extension

This folder is the Chrome extension that captures links into the AI Insight Pipeline dashboard.

It uses the **same magic-link login and `team_members` list** as the dashboard. There is no display-name field and no shared capture token in the extension.

## Reload required

After updating these files you **must reload the unpacked extension** in `chrome://extensions` (Developer mode → Reload). Existing tabs also need a refresh before the new capture UI appears.

## Sign in

1. Load this `extension/` folder as an unpacked Chrome extension.
2. Open the extension on any page, or open Options.
3. Choose **Sign in**. Chrome opens the dashboard at `/?extension_auth=1&state=…`.
4. Complete the work-email magic link.
5. If your account is in `team_members`, the extension shows **Capture access enabled** and contributor names come from the team profile.
6. If you are signed in but not on that list, the extension shows **Access not enabled** and capture stays blocked.

Default workspace URL: `https://aiinsightpipeline.netlify.app`. When you are signed out and no origin is stored, Options can show a workspace URL field (for a Netlify preview, for example).

## Source of truth

The live extension repository is [browser-signal-watcher](https://github.com/Ziyan-AIES/browser-signal-watcher). If that repo could not be pushed from this agent, copy this `extension/` directory over `browser-signal-watcher/extension/`.
