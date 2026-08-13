# Cross-referencing the YouTube channel

After an upload session, this is how the app finds out about the new videos.
Two files and two commands.

## What the files are

| File | What it is | Edited by |
| --- | --- | --- |
| `scripts/channel-videos.json` | A snapshot of every video on the channel — title and id. | Refreshed from YouTube (below). |
| `lib/exercise-videos.ts` | Which video belongs to which exercise. | By hand, one line each. |
| `EXERCISE-VIDEO-STATUS.md` | The report: what has footage, what still needs recording, and which uploads nothing is using yet. | Generated. Never edit. |

## The two commands

```bash
npm run video-status
```

Rewrites the report. Run it after changing either of the first two files.

```bash
npm run check
```

The gate. It fails if a mapped exercise name does not exist, if a link is not a
YouTube video, or if the report is out of date — so a typo can never quietly
become a dead button.

## Refreshing the snapshot after uploading

YouTube shows a cookie wall in the UK, and the channel grid only ever loads a
handful of tiles when it is driven automatically, so the reliable way to read
the full list is YouTube's own API from inside the page.

1. Open `https://www.youtube.com/@GrowPerformanceRehabilitation/videos` and
   clear the consent banner.
2. Open the browser console and run:

```js
(async () => {
  const key = ytcfg.get('INNERTUBE_API_KEY'), ctx = ytcfg.get('INNERTUBE_CONTEXT');
  const post = (b) => fetch(`/youtubei/v1/browse?key=${key}&prettyPrint=false`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ context: ctx, ...b }) }).then(r => r.json());
  const out = new Map();
  const collect = (n) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) return n.forEach(collect);
    const lv = n.shortsLockupViewModel;
    if (lv) {
      const id = lv.onTap?.innertubeCommand?.reelWatchEndpoint?.videoId;
      const t = lv.overlayMetadata?.primaryText?.content || lv.accessibilityText;
      if (id && t) out.set(id, t);
    }
    if (n.videoRenderer?.videoId) {
      out.set(n.videoRenderer.videoId,
        n.videoRenderer.title?.runs?.[0]?.text || n.videoRenderer.title?.simpleText || '');
    }
    for (const k of Object.keys(n)) collect(n[k]);
  };
  const token = (n) => { let t = null; const w = (x) => {
    if (!x || typeof x !== 'object' || t) return;
    if (Array.isArray(x)) return x.forEach(w);
    if (x.continuationCommand?.token) { t = x.continuationCommand.token; return; }
    for (const k of Object.keys(x)) w(x[k]); }; w(n); return t; };
  for (const params of ['EgZ2aWRlb3PyBgQKAjoA', 'EgZzaG9ydHPyBgUKA5oBAA==']) {
    let res = await post({ browseId: 'UCp7CeSgTe519dmGuCxgMFJg', params });
    collect(res);
    let tok = token(res), guard = 0;
    while (tok && guard++ < 20) {
      res = await post({ continuation: tok });
      const before = out.size; collect(res); tok = token(res);
      if (out.size === before && guard > 2) break;
    }
  }
  copy(JSON.stringify([...out].map(([id, title]) => ({ id, title })), null, 2));
  console.log(out.size + ' videos copied to the clipboard');
})()
```

3. Paste the result into the `videos` array of `scripts/channel-videos.json` and
   update `capturedOn`.
4. `npm run video-status`, then read the **"Uploads not yet used by the app"**
   section. Everything new lands there.

## What to do with a new upload

Three possibilities, and the report tells you which:

- **The app already has that exercise** — add one line to `lib/exercise-videos.ts`
  and it is done.
- **The app does not have it** — the exercise needs adding to
  `lib/exercise-db.ts` first, correctly categorised and tiered, and then mapped.
- **Two videos could claim one exercise** (two takes of the same movement, or a
  wide- and close-grip pair against a single generic entry) — pick one, or split
  the app's exercise in two.

Nothing is ever attached on a guess. An exercise with no video runs a YouTube
search on its own name, which is what the app has always done, and is far better
than a red "watch the demo" button that plays the wrong movement.
