# SplitPack Invite Links

Statische GitHub-Pages-Seite fuer SplitPack Invite Links unter `links.splitpack.de`.

## URLs

- Invite Link: `https://links.splitpack.de/join/<tripId>`
- iOS Universal Links: `/.well-known/apple-app-site-association`
- Android App Links: `/.well-known/assetlinks.json`

## Deployment

Der GitHub-Actions-Workflow deployed automatisch bei jedem Push auf `main` zu GitHub Pages.

1. GitHub Pages im Repository aktivieren und als Quelle `GitHub Actions` auswaehlen.
2. DNS beim Domain-Anbieter setzen:

   ```text
   links CNAME <github-user>.github.io
   ```

3. App mit der finalen Associated-Domains-Konfiguration fuer `applinks:links.splitpack.de` neu bauen und releasen.
4. Android `assetlinks.json` mit dem SHA-256-Fingerprint des Release- oder Play-App-Signing-Zertifikats finalisieren.

Hinweis: Die iOS-Datei `.well-known/apple-app-site-association` nutzt die Apple Team ID `5P4LKN6KLB` im Format `<TEAM_ID>.com.splitpack.app`. Die App Store Connect App ID `6766931002` ist nur fuer den Store-Link geeignet.

## Dateien

- `CNAME` - Custom Domain fuer GitHub Pages
- `.nojekyll` - stellt sicher, dass `.well-known` ausgeliefert wird
- `.well-known/apple-app-site-association` - iOS Universal Links fuer `/join/*`
- `.well-known/assetlinks.json` - Android App Links fuer `com.splitpack.app`
- `404.html` - statischer Fallback fuer `/join/<tripId>` mit Deep Link auf `splitpack://join/<tripId>` und Store-Fallback
- `index.html` - minimale Info-Seite
- `impressum.html` - Impressum
- `datenschutz.html` - Datenschutzerklaerung
