# SplitPack Invite Links

Statische GitHub-Pages-Seite fuer SplitPack Invite Links unter `links.splitpack.de`.

## URLs

- Invite Link: `https://links.splitpack.de/join/<tripId>`
- KegelChef Transfer Link: `https://links.splitpack.de/kc/<token>`
- KegelChef Transfer API: `https://links.splitpack.de/api/kegelchef/transfers`
- iOS Universal Links: `/.well-known/apple-app-site-association`
- Android App Links: `/.well-known/assetlinks.json`

## Deployment

Der GitHub-Actions-Workflow deployed die statischen Seiten bei jedem Push auf `main` zu GitHub Pages.
Der KegelChef-Transfer-Service laeuft separat als Cloudflare Worker auf denselben Host-Pfaden
`/kc/*` und `/api/kegelchef/*`.

1. GitHub Pages im Repository aktivieren und als Quelle `GitHub Actions` auswaehlen.
2. DNS beim Domain-Anbieter setzen:

   ```text
   links CNAME <github-user>.github.io
   ```

3. Apps mit der finalen Associated-Domains-Konfiguration fuer `applinks:links.splitpack.de` neu bauen und releasen.
4. Android `assetlinks.json` mit den SHA-256-Fingerprints der Release- oder Play-App-Signing-Zertifikate finalisieren.
5. Cloudflare Worker konfigurieren:

   ```text
   wrangler kv namespace create CONFIG_TRANSFERS
   wrangler kv namespace create CONFIG_TRANSFERS --preview
   ```

   Die ausgegebenen IDs in `wrangler.toml` eintragen und anschliessend mit
   `npm run worker:deploy` deployen. Der Worker speichert KegelChef-Konfigurationen
   maximal 7 Tage und liefert nur kurze Token-Links aus.

Hinweis: Die iOS-Datei `.well-known/apple-app-site-association` nutzt die Apple Team ID `5P4LKN6KLB` im Format `<TEAM_ID>.com.splitpack.app`. Die App Store Connect App ID `6766931002` ist nur fuer den Store-Link geeignet.
KegelChef ist unter derselben Team ID als `5P4LKN6KLB.com.kegelchef.app` hinterlegt.

## Dateien

- `CNAME` - Custom Domain fuer GitHub Pages
- `.nojekyll` - stellt sicher, dass `.well-known` ausgeliefert wird
- `.well-known/apple-app-site-association` - iOS Universal Links fuer `/join/*` und `/kc/*`
- `.well-known/assetlinks.json` - Android App Links fuer `com.splitpack.app` und `com.kegelchef.app`
- `404.html` - statischer Fallback fuer `/join/<tripId>` mit App-Fallback
- `worker/src/index.js` - KegelChef-Kurzlink-API und Browser-Fallback fuer `/kc/<token>`
- `index.html` - minimale Info-Seite
- `impressum.html` - Impressum
- `datenschutz.html` - Datenschutzerklaerung
