'use client';
import { useCallback, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import Modal from './Modal';
import {
  TEXT_SPEEDS,
  updateSettings,
  useSettings,
  type TextSpeed,
} from '../_libs/settings';
import { setSoundFromGesture } from '../_libs/sound';

const SPEED_LABELS: Record<TextSpeed, string> = {
  normal: 'Normal',
  fast: 'Fast',
  instant: 'Instant',
};

const CONTROL_FOCUS =
  'outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brown_03';

/**
 * All three settings are real: the motion override feeds every reader of
 * `useReducedMotionPref`, the pace feeds `TypingText`, and the sound toggle
 * feeds `_libs/sound.ts`.
 */
function SettingsPanel() {
  const settings = useSettings();
  const osReduced = useReducedMotion() ?? false;
  const reduced = osReduced || settings.reduceMotion;
  return (
    <div className="flex flex-col gap-4 text-lg">
      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          className={`h-5 w-5 accent-brown_01 ${CONTROL_FOCUS}`}
          checked={settings.reduceMotion}
          onChange={event =>
            updateSettings({ reduceMotion: event.target.checked })
          }
        />
        Reduce motion
      </label>
      {osReduced && (
        <p className="text-base">
          Your system already asks for reduced motion, so motion stays reduced
          whatever this is set to.
        </p>
      )}
      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          className={`h-5 w-5 accent-brown_01 ${CONTROL_FOCUS}`}
          checked={settings.sound}
          onChange={event => {
            const sound = event.target.checked;
            updateSettings({ sound });
            // This tick is a user gesture, which is the only moment an
            // AudioContext may be started. `useSound`'s sync would arrive a
            // commit too late and the first cue would be dropped.
            setSoundFromGesture(sound && !reduced);
          }}
        />
        Sound
      </label>
      {reduced && settings.sound && (
        <p className="text-base">
          Reduced motion keeps the app silent, so sound stays off while it is
          on.
        </p>
      )}
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2">Text speed</legend>
        {TEXT_SPEEDS.map(speed => (
          <label key={speed} className="flex items-center gap-3">
            <input
              type="radio"
              name="text-speed"
              value={speed}
              className={`h-5 w-5 accent-brown_01 ${CONTROL_FOCUS}`}
              checked={settings.textSpeed === speed}
              onChange={() => updateSettings({ textSpeed: speed })}
            />
            {SPEED_LABELS[speed]}
          </label>
        ))}
      </fieldset>
    </div>
  );
}

/** Everything the repo actually uses, and nothing it does not (README, package.json). */
function CreditsPanel() {
  return (
    <div className="flex flex-col gap-3 text-base">
      <p>
        <strong>Art.</strong> Every card, background and dialog plate — the full
        78-card deck included — is pixel art generated with OpenAI&rsquo;s
        DALL&middot;E for this project. Nothing is stock or licensed third-party
        art.
      </p>
      <p>
        <strong>Readings.</strong> Written live by an OpenAI model, from a
        self-populating pool once the monthly budget is spent.
      </p>
      <p>
        <strong>Type.</strong> Pixelify Sans by Stefie Justprince and Inter by
        Rasmus Andersson, both under the SIL Open Font License, served with
        next/font.
      </p>
      <p>
        <strong>Built with.</strong> Next.js, React, Motion, tRPC, TanStack
        Query, Tailwind CSS and Zod. Hosted on Vercel, with Upstash Redis for
        durable state.
      </p>
      <p>
        <strong>Made by</strong> Michael Bryce &mdash;{' '}
        <a
          href="https://github.com/wmbryce/pixel-fortune"
          target="_blank"
          rel="noreferrer"
          className={`underline ${CONTROL_FOCUS}`}
        >
          github.com/wmbryce/pixel-fortune
        </a>
        .
      </p>
    </div>
  );
}

type Open = 'settings' | 'credits' | null;

/**
 * The two triggers and their modals, shared by the welcome screen and the
 * tarot header. Both screens listen to the window — any key, any click — so
 * each trigger contains its own events: the keydown, and the click the
 * browser synthesises from Enter or Space, must open a modal without also
 * being an ambient "continue".
 */
export default function AppMenu() {
  const [open, setOpen] = useState<Open>(null);
  const close = useCallback(() => setOpen(null), []);

  const trigger = (name: Exclude<Open, null>, label: string) => (
    <button
      type="button"
      onClick={event => {
        event.stopPropagation();
        setOpen(name);
      }}
      onKeyDown={event => event.stopPropagation()}
      className="font-sans text-sm text-brown_02 hover:opacity-80 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brown_02"
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-row items-center gap-4">
      {trigger('settings', 'Settings')}
      {trigger('credits', 'Credits')}
      {open === 'settings' && (
        <Modal title="Settings" onClose={close}>
          <SettingsPanel />
        </Modal>
      )}
      {open === 'credits' && (
        <Modal title="Credits" onClose={close}>
          <CreditsPanel />
        </Modal>
      )}
    </div>
  );
}
