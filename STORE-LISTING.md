# Grow: store listing copy

Everything App Store Connect and Google Play Console ask for, written out ready
to paste. Nothing in this file is read by the app, so changing it cannot affect
the build, the RevenueCat keys or anything on Replit.

Numbers in the copy are the real ones as at 2026-08-30, taken from the code:
**707** distinct exercises, **10** session types, **19** pain areas you can flag.
If those change, the paywall updates itself but this file does not, so re-run
`npx tsx -e "..."` or just check the paywall before a submission.

One thing deliberately NOT claimed anywhere below: a video for every exercise.
Only 103 of them have a recorded video today. The red button runs a YouTube
search for the rest, so "a demonstration is one tap away" is true and "video for
every exercise" is not.

---

## App Store

### App name (30 characters)

```
Grow: Strength & Rehab
```

22 characters. The name is the heaviest thing Apple ranks on, so it carries the
two words people actually search. `Grow: Performance & Rehab` (25) matches the
wordmark inside the app if you would rather keep them identical, but "Strength"
is searched roughly ten times more often than "Performance".

### Subtitle (30 characters)

```
Strength training around pain
```

29 characters. This is the whole positioning in four words: everyone else does
one or the other.

### Promotional text (170 characters, editable without a review)

```
Sore shoulder? The session changes. Grow builds a real strength programme around what you lifted last time and what hurts today, written by a sports physiotherapist.
```

165 characters. This field can be changed any time without submitting a new
build, so it is the right place for a seasonal line or a launch message later.

### Description (4000 characters)

```
Most training apps make you choose. Either it plans a proper strength programme and ignores the fact that your shoulder hurts, or it is a rehab app full of resistance bands that never gets you back under a bar.

Grow does both. It is a strength and conditioning programme that adapts around pain, written by a practising sports physiotherapist.

IT TRAINS AROUND PAIN, NOT THROUGH IT

Before you start, Grow asks three questions: how you slept, how you feel, and whether anything is sore. Say your left knee is sore and the session changes. What would aggravate it comes out. Gentle work for that knee goes in. A limit comes with it, so you know what too far looks like. Not a lighter session. A different one.

19 areas of the body can be flagged, and every one has rehab work behind it.

THE WEIGHT MOVES ITSELF

Every load is worked out from what you actually lifted last time, not from a plan written once and never updated. Clear your reps and it climbs. Fall short and it holds. Come back from three weeks off and it meets you where you are, then builds again.

Reps rise before weight does, which is the reason progress keeps going instead of stalling in month two.

WHATEVER KIT YOU HAVE, IN WHATEVER TIME YOU HAVE

Tell Grow what is in your gym, your garage or your hotel room, and how long you have got. Thirty minutes gets you a warm-up, your main lift and an accessory. An hour gets the lot. Machine taken? Swap any exercise for the same movement with different kit, in two taps.

IT NOTICES THINGS AND SAYS SO

A lift that has stalled three sessions running. A personal best you did not clock. An ache you have now flagged five times in ten weeks, which is worth someone looking at. Grow tells you what it has spotted and what to do about it.

AND YOU CAN HAND THE WHOLE THING OVER

Every pain report, every session, every load, in one summary you can send to your own physiotherapist or coach. Turning up to an appointment with ten weeks of data beats trying to remember when it started.

WHAT IS INSIDE

707 exercises, each with written cues and a demonstration one tap away
10 kinds of session, from a heavy squat day to ten minutes of mobility
19 areas you can flag as sore, each with its own rehab work
1RM tracking, personal bests, muscle coverage and your full history
Plate maths done for you, in kilos or pounds
Stop halfway through a session and pick it up later the same day

WHO IT IS FOR

People who want to keep lifting and have something that keeps flaring up. Anyone coming back from an injury who is finished with printed sheets of exercises they never do. Anyone who was handed a programme once and has been running it unchanged ever since.

WRITTEN BY A PHYSIOTHERAPIST

Every exercise, rep range, alternative and safety limit in Grow was chosen by a practising sports physiotherapist rather than assembled from a generic library. That is the difference you cannot see in a screenshot and feel in the first week.

Grow is not a medical device. It does not diagnose or treat anything, and it will tell you to get something looked at rather than pretend it can assess it for you.
```

Roughly 3100 characters, so there is room to add to it. The first three lines are
the only part shown before somebody taps "more", which is why the choice they
are making is in sentence one.

### Keywords (100 characters, comma separated, no spaces)

```
physio,rehab,injury,strength,gym,workout,lifting,prehab,mobility,knee,shoulder,back,pain,1rm,program
```

100 characters, the maximum. Words already in the name and subtitle are left out on purpose:
Apple indexes those separately and repeating them wastes the field. The body
parts are there because "shoulder pain workout" is exactly what somebody types.

### What's New (first release)

```
First release.

Grow builds a strength session around two things: what you lifted last time, and what is sore today. Answer three questions, get a session that works around it, and let the weight move itself from there.

Written by a practising sports physiotherapist.
```

### Support and marketing URLs

Both are required. `https://growperformance.app` is already the fallback the app
uses for its legal pages, so the same domain should serve a support page with a
real email address on it before submission.

### Age rating

Answer yes to "Infrequent/Mild Medical or Treatment Information". Grow gives
exercise guidance and pain limits, and under-declaring this is a common reason
for a rating reset after release.

---

## Google Play

### Short description (80 characters)

```
Strength training that adapts around your pain. Built by a physiotherapist.
```

75 characters.

### Full description (4000 characters)

Use the App Store description above unchanged. Play renders the line breaks the
same way, and running two different descriptions means maintaining two.

---

## The subscription disclosure

Apple requires the following to be visible before purchase: what the
subscription is called, how long a period lasts, the price, and links to Terms
of Use and a Privacy Policy. All four are already on the paywall inside the app,
read live from the store, which is the safest place for them because they cannot
go stale.

Do NOT paste a price into any of the text above. The moment a price is
hardcoded in a store listing it is wrong for every country except one, and it
stays wrong after any price change. The app has a contract test that fails if a
price string appears in the paywall or profile source for exactly this reason.

If a reviewer asks for the disclosure in the description as well, add this block
at the very end and nowhere else:

```
Grow is an auto-renewing subscription. Payment is charged to your Apple ID at confirmation of purchase. It renews automatically unless cancelled at least 24 hours before the end of the current period. Manage or cancel in your account settings after purchase. Any unused part of a free trial is forfeited when a subscription is purchased.

Terms of Use: https://growperformance.app/terms
Privacy Policy: https://growperformance.app/privacy
```

---

## Screenshots, in the order they should run

The first two are the only ones most people see.

1. A session mid-flight with a pain flag showing, captioned "Sore knee? The session changes."
2. The exercise card with the suggested weight, captioned "The weight moves itself."
3. The readiness questions, captioned "Three questions. Then train."
4. The stats screen with a 1RM trend climbing, captioned "Proof it is working."
5. The physio summary, captioned "Hand it to your physio in one tap."

Caption every screenshot. An uncaptioned screenshot of a dark app is a wasted
slot, and slots one and two are where the install is won or lost.
