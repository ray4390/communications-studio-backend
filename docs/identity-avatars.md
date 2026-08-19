# Publishing identity avatars

Communications Studio assigns a server-owned avatar to every publishing identity. The browser cannot choose or override the webhook avatar used for a live publication.

The production mapping lives in `src/identity-logos.js` and currently covers all 40 publishing identities. Sources are official seals, emblems, badges, or agency marks mirrored through Wikimedia Commons image redirects at a fixed 512px render size.

Special cases:

- `us_military` uses the Joint Chiefs of Staff seal as the joint-service mark.
- `uscp_oig` uses the United States Capitol Police emblem because the OIG does not have a distinct public emblem in the source catalog.
- HSI, FPS, and DCIS use their service-specific badge/emblem artwork rather than a generic parent-department seal.

Adding a new publishing identity requires adding a corresponding mapping. `test/identity-logos.test.js` enforces complete coverage.
