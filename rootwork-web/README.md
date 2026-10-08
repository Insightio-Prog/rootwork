# Rootwork (web)

A family-tree viewer/editor that runs entirely in the browser. It ships **empty**:
there is no family data in this repo. Each person opens the site and imports the
backup file (`Rootwork-backup.zip`) you give them. Their tree, photos and life stories
stay in *their* browser (localStorage + IndexedDB) and are never uploaded.

## Claude (optional)
Claude features (Ask Claude, evidence review, to-do scan) go through a Cloudflare
Pages Function at `/api/claude`. It only answers people who enter the family password
(Settings, then Unlock). Two secrets are needed, set in the Cloudflare dashboard
(Pages, your project, Settings, Variables and Secrets), **never in the repo**:

| Name | What |
|---|---|
| `ANTHROPIC_API_KEY` | your Anthropic API key |
| `FAMILY_PASSWORD` | the password you give family |

## Develop
```
npm install
npm run dev                   # app only (Claude needs the Function)
npm run build                 # builds the viewer template + the site into dist/
npx wrangler pages dev dist   # app + /api/claude, with secrets in .dev.vars
```
`.dev.vars` (git-ignored):
```
ANTHROPIC_API_KEY=sk-ant-...
FAMILY_PASSWORD=something-memorable
```

## Deploy (Cloudflare Pages)
Build command `npm run build`, output directory `dist`, Node 22 (see `.node-version`).
