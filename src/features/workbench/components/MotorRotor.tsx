import { useId } from 'react';
import { componentAssets } from '../../../config/assets';
import { sequenceScrewGeometry } from '../../../config/sequencePins';

const { width, height } = sequenceScrewGeometry['motor-unit'].image;
const shaft = { x: 602, y: 766 };

/** Compose the photographed blades over the stationary face while the motor runs. */
export function MotorRotor({ reverse = false }: { reverse?: boolean }) {
  const id = useId();
  const ref = (layer: string) => `#${id}-${layer}`;
  const clip = (layer: string) => `url(${ref(layer)})`;
  return (
    <svg
      aria-hidden="true"
      className="motor-rotor"
      data-reverse={reverse}
      viewBox={`0 0 ${width} ${height}`}
    >
      <defs>
        <image
          id={id + '-photo'}
          href={componentAssets['motor-unit'].src}
          width={width}
          height={height}
        />
        <linearGradient id={id + '-face'} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#e2e5ed" />
          <stop offset=".58" stopColor="#dee2eb" />
          <stop offset="1" stopColor="#dadde7" />
        </linearGradient>
        <radialGradient id={id + '-housing'}>
          <stop stopColor="#252628" />
          <stop offset=".92" stopColor="#202122" />
          <stop offset="1" stopColor="#38393a" />
        </radialGradient>
        <clipPath id={id + '-original-blades'}>
          <path d="M364 698 676 621 727 788 587 801 440 734Z" />
          <path d="M225 1016 577 779 607 801 484 1189Q336 1157 225 1016Z" />
          <path d="M644 814 740 798 869 1100 819 1136 675 903Z" />
          <circle cx="514" cy="685" r="58" />
          <circle cx="696" cy="841" r="58" />
        </clipPath>
        <filter id={id + '-face-edge'}>
          <feGaussianBlur stdDeviation="5" />
        </filter>
        <mask id={id + '-face-under-blades'}>
          <path
            d="M128 764 450 628Q491 600 545 619L694 604 751 773Q778 796 782 849L907 1146C685 1332 137 1247 128 764Z"
            fill="white"
            filter={clip('face-edge')}
          />
        </mask>
        <clipPath id={id + '-fixed-details'}>
          <circle cx="404" cy="818" r="48" />
          <circle cx="798" cy="819" r="47" />
          <rect x="510" y="1124" width="296" height="42" />
        </clipPath>
        <clipPath id={id + '-shaft'}>
          <circle cx={shaft.x} cy={shaft.y} r="48" />
        </clipPath>
      </defs>
      <g mask={clip('face-under-blades')}>
        <rect width={width} height={height} fill={clip('face')} />
        <circle cx="600" cy="760" r="162" fill={clip('housing')} stroke="#464748" strokeWidth="4" />
        <use href={ref('photo')} clipPath={clip('fixed-details')} />
      </g>
      <g className="motor-blades" style={{ transformOrigin: `${shaft.x}px ${shaft.y}px` }}>
        <g
          transform={`translate(${shaft.x} ${shaft.y}) scale(.84) translate(${-shaft.x} ${-shaft.y})`}
        >
          <use href={ref('photo')} clipPath={clip('original-blades')} />
        </g>
      </g>
      <use href={ref('photo')} clipPath={clip('shaft')} />
    </svg>
  );
}
