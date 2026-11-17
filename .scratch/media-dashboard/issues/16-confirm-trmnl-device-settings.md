# Confirm TRMNL device settings

Type: task
Assignee: Yuyan Li
Status: resolved

## Question

Which TRMNL integration and device settings is this dashboard running under?

Human in the loop: the owner checks the TRMNL web dashboard and reports:

- Which plugin points at the dashboard URL (Screenshot, a private plugin, or something else).
- The device model and firmware version (four greys need 1.6 or later).
- The colour palette setting (it must be the 4-grey palette) and whether Maximum Compatibility is on (it must be off).

If a setting is wrong for four greys, change it and record that. The prototype depends on these.

## Answer

Reported by the owner from the TRMNL web dashboard on 2026-11-17. No setting needed changing.

- **Plugin**: Screenshot, set to `https://trmnl.yuyanli.dev`. This confirms the integration that [TRMNL image rendering](10-trmnl-image-rendering.md) inferred.
- **Device model**: TRMNL OG (2-bit). The 90,000-byte limit on the final image applies.
- **Firmware**: 1.8.18, above the 1.6 needed for four greys.
- **Colour palette**: "4 grays 2 bit".
- **Maximum Compatibility**: the owner could not find the setting, so it is assumed off, not confirmed. The prototype's on-device test will show it: if greys come out as black and white, look for this setting first.
- **Device refresh interval**: 15 minutes, confirmed by the owner, not the 30 minutes `CLAUDE.md` used to say (now corrected). It matters because the Spotlight is re-picked every device refresh.
