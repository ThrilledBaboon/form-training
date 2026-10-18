import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type DragEvent,
} from 'react';

type Gesture = {
  id: string;
  pointerId: number;
  handle: HTMLButtonElement;
  startX: number;
  startY: number;
  x: number;
  y: number;
  moving: boolean;
  target?: string;
};

/** Pointer capture keeps the same handle working with mouse, pen and touch. */
export function useWidgetDrag(enabled: boolean, onDrop: (source: string, target: string) => void) {
  const gesture = useRef<Gesture | undefined>(undefined);
  const drop = useRef(onDrop);
  drop.current = onDrop;
  const [drag, setDrag] = useState<{ id: string; target?: string }>();

  function update(current: Gesture) {
    if (!current.moving && Math.hypot(current.x - current.startX, current.y - current.startY) < 6)
      return;
    current.moving = true;
    const hit = document
      .elementFromPoint(current.x, current.y)
      ?.closest<HTMLElement>('.workspace-widget');
    const grid = current.handle.closest('.widget-grid');
    current.target = hit && hit.closest('.widget-grid') === grid ? hit.dataset.widgetId : undefined;
    setDrag((old) =>
      old?.id === current.id && old.target === current.target
        ? old
        : { id: current.id, target: current.target },
    );
  }

  function clear() {
    const current = gesture.current;
    gesture.current = undefined;
    if (current?.handle.hasPointerCapture(current.pointerId))
      current.handle.releasePointerCapture(current.pointerId);
    setDrag(undefined);
  }

  useEffect(() => {
    if (!enabled) clear();
  }, [enabled]);

  useEffect(() => {
    if (!drag) return;
    let frame: number;
    const scroll = () => {
      const current = gesture.current;
      if (!current) return;
      // Scroll a long page while a held handle reaches the viewport edge.
      const edge = 90;
      const bottom = window.innerHeight - edge;
      const delta =
        current.y < edge
          ? -Math.min(20, (edge - current.y) / 3)
          : current.y > bottom
            ? Math.min(20, (current.y - bottom) / 3)
            : 0;
      if (delta && current.x >= 0 && current.x <= window.innerWidth) {
        window.scrollBy(0, delta);
        update(current);
      }
      frame = requestAnimationFrame(scroll);
    };
    frame = requestAnimationFrame(scroll);
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        clear();
      }
    };
    window.addEventListener('keydown', escape);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('keydown', escape);
    };
  }, [!!drag]);

  useEffect(
    () => () => {
      const current = gesture.current;
      gesture.current = undefined;
      if (current?.handle.hasPointerCapture(current.pointerId))
        current.handle.releasePointerCapture(current.pointerId);
    },
    [],
  );

  return {
    drag,
    handleProps: (id: string) => ({
      onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => {
        if (!enabled || event.button !== 0 || !event.isPrimary) return;
        event.preventDefault();
        event.currentTarget.focus({ preventScroll: true });
        event.currentTarget.setPointerCapture(event.pointerId);
        gesture.current = {
          id,
          pointerId: event.pointerId,
          handle: event.currentTarget,
          startX: event.clientX,
          startY: event.clientY,
          x: event.clientX,
          y: event.clientY,
          moving: false,
        };
      },
      onPointerMove: (event: ReactPointerEvent<HTMLButtonElement>) => {
        const current = gesture.current;
        if (!current || current.pointerId !== event.pointerId) return;
        current.x = event.clientX;
        current.y = event.clientY;
        update(current);
      },
      onPointerUp: (event: ReactPointerEvent<HTMLButtonElement>) => {
        const current = gesture.current;
        if (!current || current.pointerId !== event.pointerId) return;
        current.x = event.clientX;
        current.y = event.clientY;
        update(current);
        const target = current.target;
        clear();
        if (enabled && current.moving && target && target !== current.id)
          drop.current(current.id, target);
      },
      onPointerCancel: clear,
      onLostPointerCapture: () => {
        if (gesture.current?.id === id) clear();
      },
      onDragStart: (event: DragEvent<HTMLButtonElement>) => event.preventDefault(),
    }),
  };
}
