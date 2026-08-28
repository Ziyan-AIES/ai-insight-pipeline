# AI Signals Chrome extension

This folder is the Chrome extension that captures links into the AI Insight Pipeline dashboard.

It uses the **same magic-link login and `team_members` list** as the dashboard. There is no display-name field and no shared capture token in the extension.

## Reload required

After updating these files you **must reload the unpacked extension** in `chrome://extensions` (Developer mode → Reload). Existing tabs also need a refresh before the new capture UI appears.

Version **0.2.2** uses a compact **MI** circle on article pages. Hover to Capture (one click) or open Dashboard. Sign-in prompts appear on the dashboard until the handshake succeeds, then they hide.

## Sign in

1. Load this `extension/` folder as an unpacked Chrome extension.
2. On a news page, hover the **MI** circle and click Sign in (or use Options).
3. Complete the work-email magic link. The dashboard may briefly show **Connecting Chrome extension**, then returns to Daily/Weekly with no persistent sign-in banner.
4. Return to the article tab. Hover **MI** and click Capture. A toast shows **Saved** or the error.
5. Dashboard opens from the grid icon. Capture UI is not shown on the dashboard after you are signed in.

Default workspace URL: `https://aiinsightpipeline.netlify.app`. When you are signed out and no origin is stored, Options can show a workspace URL field (for a Netlify preview, for example).

## Source of truth

The live extension repository is [browser-signal-watcher](https://github.com/Ziyan-AIES/browser-signal-watcher). If that repo could not be pushed from this agent, copy this `extension/` directory over `browser-signal-watcher/extension/`.
