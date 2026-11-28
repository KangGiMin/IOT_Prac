import type { ComponentKind } from '../types';

export function ComponentSymbol({ kind }: { kind: ComponentKind }) {
  return (
    <svg
      viewBox="0 0 80 54"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {kind === 'supply' ? (
        <>
          <rect x="15" y="8" width="50" height="38" rx="5" />
          <path d="M24 21h12m-6-6v12m17-6h10M25 36h30" />
        </>
      ) : kind === 'start' || kind === 'stop' ? (
        <>
          <path d="M5 36h23m24 0h23M28 29v14m24-14v14M40 8v12m-10-12h20" />
          <path d={kind === 'stop' ? 'M28 29h24M40 20v9' : 'M30 24h20M40 20v4'} />
        </>
      ) : kind === 'relay' || kind === 'timer' ? (
        <>
          <path d="M5 27h14m42 0h14" />
          <rect x="19" y="10" width="42" height="34" rx="2" />
          <path d="M25 38 55 16" />
          {kind === 'timer' && <circle cx="40" cy="27" r="9" />}
        </>
      ) : kind === 'lamp' || kind === 'led' ? (
        <>
          <path d="M5 27h16m38 0h16" />
          <circle cx="40" cy="27" r="18" />
          <path d="m28 15 24 24m0-24L28 39" />
        </>
      ) : kind === 'resistor' ? (
        <>
          <path d="M4 27h17m38 0h17" />
          <rect x="21" y="17" width="38" height="20" rx="2" />
          <path d="M31 17v20m8-20v20m10-20v20" />
        </>
      ) : kind === 'ic' ? (
        <>
          <rect x="19" y="10" width="42" height="34" rx="4" />
          <path d="M35 10a5 5 0 0 0 10 0" />
          {[20, 29, 38].map((y) => (
            <path key={y} d={`M12 ${y}h7m42 0h7`} />
          ))}
          <text
            x="40"
            y="33"
            textAnchor="middle"
            stroke="none"
            fill="currentColor"
            fontSize="13"
            fontFamily="monospace"
          >
            74
          </text>
        </>
      ) : (
        <>
          <path d="M5 38h20m30 0h20M25 38 51 18" />
          <circle cx="25" cy="38" r="3" />
          <circle cx="55" cy="38" r="3" />
        </>
      )}
    </svg>
  );
}
