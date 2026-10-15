import { useEffect, useState } from 'react';
import { Timer as TimerIcon, Pause, Play, RotateCcw, X, Plus, Minus } from 'lucide-react';
import { useApp } from '../lib/context';
import { db } from '../lib/db';
import { changeTimer } from '../lib/actions';
import { Button, AsyncButton } from './ui';
import type { Timer } from '../lib/model';
export const remainingMs = (timer: Timer, at = Date.now()) =>
  timer.endAt === undefined ? timer.pausedMs || 0 : Math.max(0, timer.endAt - at);
export function RestTimer() {
  const { data, run, toast } = useApp();
  const timer = data.timer;
  const [clock, setClock] = useState(Date.now());
  useEffect(() => {
    if (!timer) return;
    const tick = () => setClock(Date.now());
    const interval = setInterval(tick, 500);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [!!timer]);
  const remaining = timer ? remainingMs(timer, clock) : 0;
  useEffect(() => {
    if (!timer?.endAt || remaining > 0 || timer.notified) return;
    void run(async () => {
      const shouldNotify = await db.transaction('rw', db.timers, async () => {
        const current = await db.timers.get('rest');
        if (!current || current.notified || current.endAt !== timer.endAt) return false;
        await db.timers.update('rest', { notified: true });
        return true;
      });
      if (!shouldNotify) return;
      if (data.settings.vibration) navigator.vibrate?.([200, 100, 200]);
      if (data.settings.sound) {
        try {
          const a = new AudioContext();
          void a.resume().catch(() => {});
          const o = a.createOscillator();
          const g = a.createGain();
          o.connect(g);
          g.connect(a.destination);
          o.frequency.value = 660;
          g.gain.value = 0.1;
          o.start();
          o.stop(a.currentTime + 0.2);
          setTimeout(() => void a.close(), 500);
        } catch {
          /* Browser may require an unlocked audio context. */
        }
      }
      toast('Rest complete. Ready when you are.');
    });
  }, [remaining, timer?.endAt, timer?.notified, data.settings.sound, data.settings.vibration]);
  if (!timer) return null;
  const seconds = Math.ceil(remaining / 1000);
  return (
    <aside className={`rest-timer ${remaining === 0 ? 'finished' : ''}`} aria-label="Rest timer">
      <div className="timer-info">
        <TimerIcon size={20} />
        <span>
          <strong>
            {timer.endAt ? (remaining === 0 ? 'Rest complete' : 'Rest timer') : 'Timer paused'}
          </strong>
          <small>{timer.exerciseName || 'Take a breath'}</small>
        </span>
      </div>
      <output role="timer" aria-label="Rest time remaining">
        {String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}
      </output>
      <div className="timer-buttons">
        <AsyncButton
          variant="ghost"
          aria-label="Subtract 15 seconds"
          onAction={() => run(() => changeTimer('subtract'))}
        >
          <Minus size={16} />
        </AsyncButton>
        <AsyncButton
          variant="ghost"
          aria-label={timer.endAt ? 'Pause timer' : 'Resume timer'}
          onAction={() => run(() => changeTimer('toggle'))}
        >
          {timer.endAt ? <Pause size={16} /> : <Play size={16} />}
        </AsyncButton>
        <AsyncButton
          variant="ghost"
          aria-label="Add 15 seconds"
          onAction={() => run(() => changeTimer('add'))}
        >
          <Plus size={16} />
        </AsyncButton>
        <AsyncButton
          variant="ghost"
          aria-label="Reset timer"
          onAction={() => run(() => changeTimer('reset'))}
        >
          <RotateCcw size={15} />
        </AsyncButton>
        <AsyncButton
          variant="ghost"
          aria-label="Skip timer"
          onAction={() => run(() => db.timers.delete('rest'))}
        >
          <X size={17} />
        </AsyncButton>
      </div>
    </aside>
  );
}
