const STUDIO_ASSET_BASE = 'https://nationalarchivesusar.github.io/communications-studio/';

export function studioContentSecurityPolicy() {
  return [
    "default-src 'none'",
    "script-src 'self' https://nationalarchivesusar.github.io",
    "style-src 'self' https://nationalarchivesusar.github.io 'unsafe-inline'",
    "img-src 'self' https: data: blob:",
    "connect-src 'self'",
    "font-src 'self' https: data:",
    "media-src 'self' https: blob:",
    "object-src 'none'",
    'base-uri https://nationalarchivesusar.github.io',
    "frame-ancestors 'none'",
    "form-action 'self' https://discord.com https://apis.roblox.com https://www.roblox.com"
  ].join('; ');
}

export function renderStudioPage() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="theme-color" content="#17365d" />
  <meta name="description" content="USAR Communications Studio — compose and preview Discord Components V2 announcements." />
  <title>USAR Communications Studio</title>
  <base href="${STUDIO_ASSET_BASE}" />
  <link rel="stylesheet" href="./styles-1.css" />
  <link rel="stylesheet" href="./styles-2.css" />
  <link rel="stylesheet" href="./styles-3.css" />
  <link rel="stylesheet" href="./styles-4.css" />
  <link rel="stylesheet" href="./styles-5.css" />
  <link rel="stylesheet" href="./styles-6.css" />
  <link rel="stylesheet" href="./styles-7.css" />
  <link rel="stylesheet" href="./styles-8.css" />
  <link rel="stylesheet" href="./styles-9.css" />
  <link rel="stylesheet" href="./styles-10.css" />
  <link rel="stylesheet" href="./styles-11.css?v=20260818-2200" />
</head>
<body>
  <div id="app" aria-live="polite"></div>
  <noscript><div class="noscript">Communications Studio requires JavaScript.</div></noscript>
  <script src="./config.js"></script>
  <script src="./app-1.js"></script>
  <script src="./app-2.js?v=20260818-2142"></script>
  <script src="./app-3.js"></script>
  <script src="./app-4.js"></script>
  <script src="./app-5.js"></script>
  <script src="./app-6.js"></script>
  <script src="./app-7.js"></script>
  <script src="./app-8.js"></script>
  <script src="./app-9.js"></script>
  <script src="./app-10.js?v=20260818-2142"></script>
  <script src="./auth-ui.js?v=20260818-2142"></script>
  <script src="./app-11.js?v=20260818-2142"></script>
  <script src="./app-12.js"></script>
  <script src="./policy.js"></script>
  <script src="./policy-migrations.js"></script>
  <script src="./identity-policy.js?v=20260818-2200"></script>
  <script src="./identity-logo-preview.js?v=20260819-0057"></script>
  <script src="./routing-policy.js"></script>
  <script src="./routing-policy-fix.js?v=20260819-0023"></script>
  <script src="./studio-framing.js?v=20260818-2200"></script>
  <script src="./studio-framing-2.js?v=20260818-2335"></script>
  <script src="./studio-framing-3.js?v=20260818-2344"></script>
  <script src="./studio-framing-4.js?v=20260819-0007"></script>
  <script src="./ulpa-identity.js?v=20260829-0118"></script>
  <script src="./studio-export.js?v=20260818-2200"></script>
  <script src="./studio-publish.js?v=20260818-2358"></script>
  <script src="./app-13.js?v=20260818-2142"></script>
</body>
</html>`;
}
