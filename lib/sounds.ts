import { Platform } from 'react-native';

/**
 * The achievement unlock chime.
 *
 * WHY THIS FILE IS SO DEFENSIVE
 * ─────────────────────────────
 * This is the app's first native audio dependency, and it exists to play a
 * half-second noise when a badge unlocks. That is the least important thing in
 * the app, attached to one of the more fragile kinds of dependency — and this
 * app's whole recent history is native modules and modals taking the entire
 * screen down. The rule here is that nothing in this file may ever be able to
 * break anything else:
 *
 *   - expo-audio is required LAZILY and inside a try. If the module is missing
 *     (someone pulled without running npm install), or the native side is not
 *     present in whatever Expo Go build is being used, playback silently does
 *     not happen and the badge still unlocks.
 *   - Every call is wrapped. A rejected promise from the audio system must not
 *     surface as an unhandled rejection during a celebration.
 *   - One player, created once and reused. Creating a player per unlock leaks
 *     native objects, and badges can unlock several at a time.
 *
 * The worst outcome this file is allowed to produce is silence.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let player: any = null;
let unavailable = false;

/** Set false to mute. Read from the store by the caller, not here. */
function getPlayer() {
  if (unavailable) return null;
  if (player) return player;
  try {
    // Lazy, and by require rather than import: a top-level import of a missing
    // native module throws at module-evaluation time, which on this app's
    // startup path means a white screen rather than a missing sound.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createAudioPlayer, setAudioModeAsync } = require('expo-audio');
    // Playing over other audio rather than interrupting it: nobody wants their
    // music to duck for a badge.
    setAudioModeAsync?.({ playsInSilentMode: false, shouldPlayInBackground: false })?.catch?.(
      () => {}
    );
    player = createAudioPlayer(require('../assets/sounds/achievement.wav'));
    return player;
  } catch {
    unavailable = true;
    return null;
  }
}

/**
 * Plays the unlock chime. Safe to call from anywhere, including inside a
 * render-triggered effect, and safe to call when nothing is available to play.
 */
export function playAchievementSound(): void {
  if (Platform.OS === 'web') return;
  try {
    const p = getPlayer();
    if (!p) return;
    // Rewind first: badges can unlock in a run, and a player already mid-sound
    // otherwise ignores the second call entirely.
    p.seekTo?.(0)?.catch?.(() => {});
    p.play?.();
  } catch {
    // Deliberately swallowed — see the note at the top of this file.
  }
}
