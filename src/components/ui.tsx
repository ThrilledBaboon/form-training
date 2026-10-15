import {
  useEffect,
  useRef,
  useState,
  useId,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
  type ButtonHTMLAttributes,
} from 'react';
import { useApp } from '../lib/context';
import { X, ArrowUpRight, Dumbbell, Plus, Minus } from 'lucide-react';
export function Button({
  children,
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
}) {
  const { pending } = useApp();
  const saving = props.type === 'submit' && pending;
  return (
    <button
      className={`button ${variant} ${className}`}
      {...props}
      disabled={props.disabled || saving}
    >
      {saving ? 'Saving…' : children}
    </button>
  );
}
export function AsyncButton({
  onAction,
  children,
  ...props
}: Omit<Parameters<typeof Button>[0], 'onClick'> & { onAction: () => Promise<unknown> }) {
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  return (
    <Button
      {...props}
      disabled={busy || props.disabled}
      onClick={async () => {
        if (lock.current) return;
        lock.current = true;
        setBusy(true);
        try {
          await onAction();
        } finally {
          lock.current = false;
          setBusy(false);
        }
      }}
    >
      {busy ? 'Saving…' : children}
    </Button>
  );
}
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>;
}
export function PageTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        <span className="eyebrow">{eyebrow || 'YOUR TRAINING, IN FOCUS'}</span>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function SectionTitle({
  title,
  sub,
  action,
}: {
  title: string;
  sub?: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-title">
      <div>
        <h2>{title}</h2>
        {sub && <p>{sub}</p>}
      </div>
      {action}
    </div>
  );
}
export function Empty({
  title,
  children,
  action,
  compact = false,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`empty ${compact ? 'compact' : ''}`}>
      <div className="empty-icon">
        <Dumbbell size={22} />
      </div>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current!;
    d.showModal();
    return () => d.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? 'wide' : ''}`}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="modal-header">
        <h2>{title}</h2>
        <Button variant="ghost" aria-label="Close dialog" onClick={onClose}>
          <X size={20} />
        </Button>
      </div>
      <div className="modal-body">{children}</div>
    </dialog>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {isValidElement(children)
        ? cloneElement(children as ReactElement<{ id?: string; 'aria-describedby'?: string }>, {
            id,
            'aria-describedby': hint ? id + '-hint' : undefined,
          })
        : children}
      {hint && <small id={id + '-hint'}>{hint}</small>}
    </div>
  );
}
export function Badge({ children, color = '' }: { children: ReactNode; color?: string }) {
  return <span className={`badge ${color}`}>{children}</span>;
}
export function Metric({
  label,
  value,
  unit,
  icon,
  foot,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  icon: ReactNode;
  foot?: string;
}) {
  return (
    <Card className="metric">
      <div className="metric-top">
        <span>{label}</span>
        <span className="metric-icon">{icon}</span>
      </div>
      <div className="metric-value">
        {value}
        <small>{unit}</small>
      </div>
      <p>{foot || 'Based on completed working sets'}</p>
    </Card>
  );
}
export function LinkButton({ to, children }: { to: string; children: ReactNode }) {
  return (
    <a className="text-link" href={`#/${to}`}>
      {children}
      <ArrowUpRight size={16} />
    </a>
  );
}
export function Numeric({
  label,
  value,
  onChange,
  step = 1,
  min = 0,
  max = 1e6,
  compact = false,
}: {
  label: string;
  value: number | undefined;
  onChange: (n: number | undefined) => void;
  step?: number;
  min?: number;
  max?: number;
  compact?: boolean;
}) {
  const [raw, setRaw] = useState(value === undefined ? '' : String(Number(value.toFixed(4))));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setRaw(value === undefined ? '' : String(Number(value.toFixed(4))));
  }, [value]);
  const change = (n: number | undefined) => {
    if (n !== undefined && (!Number.isFinite(n) || n < min || n > max)) return;
    setRaw(n === undefined ? '' : String(Number(n.toFixed(4))));
    onChange(n);
  };
  return (
    <div className={`numeric ${compact ? 'small' : ''}`}>
      <span className="numeric-caption">
        {label.includes('assistance')
          ? 'Assistance'
          : label.includes('load')
            ? 'Load'
            : label.includes('distance')
              ? 'Distance'
              : label.includes('duration')
                ? 'Time'
                : 'Reps'}
        {label.includes('(') ? ' · ' + label.slice(label.lastIndexOf('(') + 1, -1) : ''}
      </span>
      <button
        type="button"
        aria-label={`Decrease ${label}`}
        onClick={() => change(Math.max(min, (value || 0) - step))}
      >
        <Minus size={13} />
      </button>
      <input
        aria-label={label}
        inputMode="decimal"
        type="number"
        min={min}
        max={max}
        step="any"
        value={raw}
        onFocus={() => {
          focused.current = true;
        }}
        onBlur={() => {
          focused.current = false;
          setRaw(value === undefined ? '' : String(Number(value.toFixed(4))));
        }}
        onChange={(e) => {
          setRaw(e.target.value);
          if (e.target.value === '') onChange(undefined);
          else {
            const n = Number(e.target.value);
            if (Number.isFinite(n) && n >= min && n <= max) onChange(n);
          }
        }}
      />
      <button
        type="button"
        aria-label={`Increase ${label}`}
        onClick={() => change(Math.min(max, (value || 0) + step))}
      >
        <Plus size={13} />
      </button>
    </div>
  );
}
export function Delta({ value, unit = '' }: { value: number; unit?: string }) {
  return (
    <span className={value > 0 ? 'positive' : value < 0 ? 'negative' : 'muted'}>
      {value > 0 ? '+' : ''}
      {Number(value.toFixed(1))}
      {unit}
    </span>
  );
}
