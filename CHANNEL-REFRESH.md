# Cross-referencing the YouTube channel

After an upload session, this is how the app finds out about the new videos.
Four files and three commands.

## What the files are

| File | What it is | Edited by |
| --- | --- | --- |
| `scripts/channel-videos.json` | A snapshot of every video on the channel — title and id. | Refreshed from YouTube (below). |
| `lib/exercise-videos.ts` | Which video belongs to which exercise. | By hand, one line each. |
| `EXERCISE-VIDEO-STATUS.md` | The report: what has footage, what still needs recording, and which uploads nothing is using yet. | Generated. Never edit. |
| `docs/VIDEO-LINKING-REVIEW.md` | The decision list: near misses with both spellings, uploads nothing opens, and what is still to film. | Generated. Never edit. |

## The three commands

```bash
npm run video-status
```

Rewrites the report. Run it after changing either of the first two files.

```bash
npm run video-review
```

Rewrites the decision list. Run it after the same two files, and after any
change to the library, because it names every exercise that has no footage.

```bash
npm run check
```

The gate. It fails if a mapped exercise name does not exist, if a link is not a
YouTube video, or if the report is out of date — so a typo can never quietly
become a dead button. It also fails if a link points at a video that
is not in the snapshot, if an exercise whose name IS an upload's title has not
been given it, or if a link was made on a near miss without being written down
in `VIDEO_LINKS_DECIDED_BY_HAND`.

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

## What exact means

The bulk of the table is filled by matching an exercise name against a video
title with nothing between them: trim the spaces, ignore the capitals, and that
is all. "Door Frame Rows" is NOT a match for the upload called "Doorframe Rows",
and "Tibialis Raise" is NOT a match for "Seated Tib Raises". Those go on the
decision list instead, with both spellings shown, because a near miss is a guess
about which movement was filmed and only somebody who has watched it can say.

A link that is genuinely a judgement goes in `VIDEO_LINKS_DECIDED_BY_HAND` in
the same file, with the title of the video it was given. That is how somebody
says out loud that they watched it. Without that line the gate refuses the link.

Nothing is ever attached on a guess. An exercise with no video runs a YouTube
search on its own name, which is what the app has always done, and is far better
than a red "watch the demo" button that plays the wrong movement.
