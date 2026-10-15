import { heatColor } from '../lib/calc';
import { muscleName, type Muscle } from '../lib/model';
export function Anatomy({
  values = {},
  max = 12,
  selected,
  onSelect,
  small = false,
}: {
  values?: Partial<Record<Muscle, number>>;
  max?: number;
  selected?: Muscle;
  onSelect?: (m: Muscle) => void;
  small?: boolean;
}) {
  const region = (m: Muscle, d: string, transform?: string) => (
    <path
      key={m + d + transform}
      d={d}
      transform={transform}
      fill={heatColor(values[m] || 0, max)}
      stroke={selected === m ? 'var(--green)' : 'var(--anatomy-stroke)'}
      strokeWidth={selected === m ? 2.5 : 1.2}
      strokeLinejoin="round"
      tabIndex={onSelect ? 0 : undefined}
      role={onSelect ? 'button' : undefined}
      aria-label={`${muscleName(m)}, ${(values[m] || 0).toFixed(1)} contribution`}
      onClick={() => onSelect?.(m)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect?.(m);
        }
      }}
      className={onSelect ? 'muscle-region' : ''}
    >
      <title>
        {muscleName(m)} · {(values[m] || 0).toFixed(1)}
      </title>
    </path>
  );
  const pair = (m: Muscle, d: string) => (
    <>
      {region(m, d)}
      {region(m, d, 'translate(220 0) scale(-1 1)')}
    </>
  );
  const silhouette = (
    <path
      d="M95 57L94 70 75 78Q63 79 57 99L43 152 34 186 26 226Q22 242 30 246L43 224 53 190 69 158 73 128 79 173 78 207 66 258 69 304 72 342 67 379 76 386 92 382 95 349 103 307 110 262 117 307 125 349 128 382 144 386 153 379 148 342 151 304 154 258 142 207 141 173 147 128 151 158 167 190 177 224 190 246Q198 242 194 226L186 186 177 152 163 99Q157 79 145 78L126 70 125 57"
      fill="var(--anatomy-body)"
      stroke="var(--anatomy-stroke)"
      strokeWidth="1.4"
    />
  );
  const head = (
    <>
      <ellipse
        cx="110"
        cy="35"
        rx="22"
        ry="28"
        fill="var(--anatomy-body)"
        stroke="var(--anatomy-stroke)"
        strokeWidth="1.4"
      />
      <path
        d="M96 58Q110 68 124 58M95 70L110 80 125 70"
        fill="none"
        stroke="var(--anatomy-stroke)"
      />
    </>
  );
  return (
    <svg
      className={`anatomy ${small ? 'small' : ''}`}
      viewBox="0 0 470 420"
      aria-label="Original front and back muscle map"
    >
      <g transform="translate(10 9)">
        {silhouette}
        {head}
        {pair('chest', 'M106 84Q89 79 76 90L78 119Q95 128 107 114Z')}
        {pair('front_delts', 'M74 85Q60 85 58 104L56 120 73 111 76 92Z')}
        {pair('side_delts', 'M56 119L52 136 58 139 70 115Z')}
        {pair('biceps', 'M72 117Q63 119 58 141L57 158 66 155 75 132Z')}
        {pair('triceps', 'M54 136L48 158 52 169 58 153Z')}
        {pair('forearms', 'M51 166L40 189 33 221 39 222 49 199 59 171Z')}
        {pair(
          'abs',
          'M108 126L93 129 95 140 108 140ZM108 144L95 145 97 158 108 158ZM108 162L97 163 100 177 108 183Z',
        )}
        {pair('obliques', 'M82 128L90 133 96 179 105 194 87 183 80 158Z')}
        {pair(
          'quads',
          'M82 207Q69 231 75 265L83 298 95 279 104 233 105 213ZM101 240L96 278 88 301 99 303 106 269Z',
        )}
        {pair('adductors', 'M106 198L90 193 86 205 108 240Z')}
        {pair('abductors', 'M80 190L74 212 78 225 87 206Z')}
        {pair('calves', 'M75 313L78 342 84 361 90 339 96 310 88 318Z')}
        <text x="110" y="409" textAnchor="middle">
          FRONT
        </text>
      </g>
      <g transform="translate(248 9)">
        {silhouette}
        {head}
        {pair('traps', 'M107 70L96 66 91 76 75 83 91 99 108 114Z')}
        {pair('rear_delts', 'M75 86Q61 85 58 107L57 119 77 110 84 100Z')}
        {pair('side_delts', 'M56 120L52 137 59 138 72 116Z')}
        {pair('upper_back', 'M106 117L88 103 79 116 90 140 107 145Z')}
        {pair('lats', 'M79 123L78 147 88 176 104 181 102 149Z')}
        {pair('erectors', 'M108 130L102 144 103 184 108 195Z')}
        {pair('triceps', 'M73 118L61 125 54 154 60 168 69 152 78 132Z')}
        {pair('forearms', 'M52 171L40 194 34 221 39 223 51 201 60 173Z')}
        {pair('glutes', 'M105 193Q91 184 81 195L77 218Q86 236 108 223Z')}
        {pair('hamstrings', 'M78 230L74 260 82 294 91 296 106 231 96 236 87 274 88 242Z')}
        {pair('adductors', 'M107 232L98 264 100 292 109 263Z')}
        {pair('abductors', 'M78 191L73 207 76 222 82 204Z')}
        {pair('calves', 'M79 308Q70 330 80 350L87 343 92 322 98 310 89 308 86 331 83 309Z')}
        <text x="110" y="409" textAnchor="middle">
          BACK
        </text>
      </g>
    </svg>
  );
}
