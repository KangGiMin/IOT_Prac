import { useId } from 'react';
import type { AssetId, CircuitComponent, LocalPin } from '../../types/circuit';
import { deviceDefinitions } from './definitions';

interface Props {
  assetId: AssetId;
  settings?: CircuitComponent['settings'];
  energized?: boolean;
  preview?: boolean;
}

/** All equipment is vector geometry. No raster images, SVG images, or foreignObject. */
export function DeviceSvg({ assetId, settings, energized = false, preview = false }: Props) {
  const uid = useId().replace(/:/g, '');
  const definition = deviceDefinitions[assetId];
  const [, , width, height] = definition.viewBox;
  const fill = (name: string) => `url(#${uid}-${name})`;
  const text = (x: number, y: number, value: string, size = 9, color = '#263340', anchor: 'start' | 'middle' | 'end' = 'start') => <text key={`${x}:${y}:${value}`} x={x} y={y} fontSize={size} fill={color} textAnchor={anchor}>{value}</text>;
  const screw = (x: number, y: number, key: string | number) => <g key={key} transform={`translate(${x} ${y})`}><circle r="4.5" fill={fill('metal')} stroke="#69737e" /><path d="M -2.5 0 H 2.5" stroke="#505966" strokeWidth="1.2" /></g>;
  const knob = (x: number, y: number, r = 17) => <g transform={`translate(${x} ${y})`}><circle r={r + 2} fill="#b4bbc0" /><circle r={r} fill={fill('knob')} stroke="#e9ebe9" strokeWidth="2" /><path d={`M 0 ${-r + 3} v 6`} stroke="#65717b" strokeWidth="2" />{Array.from({ length: 16 }, (_, i) => <path key={i} d={`M 0 ${r - 2} v 2`} stroke="#aab0b0" transform={`rotate(${i * 22.5})`} />)}</g>;
  const panel = (model: string, title: string) => <>
    <rect x="2" y="2" width={width - 4} height={height - 4} rx="8" fill={fill('housing')} stroke="#9aa5b0" strokeWidth="2" />
    <rect x="7" y="7" width={width - 14} height={height - 14} rx="4" fill="#f7f8f9" stroke="#c4ccd3" />
    {screw(14, 14, 'tl')}{screw(width - 14, height - 14, 'br')}
    {text(20, 22, 'SysI  ' + model, 10)}{text(width / 2, height - 15, title, 9, '#273543', 'middle')}
  </>;
  let body;
  switch (assetId) {
    case 'panel-board':
      body = <>
        <rect x="3" y="3" width="1094" height="614" rx="12" fill="#424c56" />
        <rect x="16" y="13" width="1068" height="594" rx="5" fill={fill('metal')} stroke="#929faa" strokeWidth="3" />
        {Array.from({ length: 13 }, (_, i) => <g key={i} transform={`translate(42 ${28 + i * 44})`}><rect width="1016" height="38" rx="1" fill={fill('rail')} stroke="#9daab6" /><path d="M 0 2 H 1016" stroke="#f9fcff" strokeWidth="2" /><path d="M 0 37 H 1016" stroke="#6b7884" /></g>)}
        <rect x="21" y="21" width="17" height="578" fill={fill('rail')} stroke="#97a3ac" /><rect x="1062" y="21" width="17" height="578" fill={fill('rail')} stroke="#97a3ac" />
        {[0, 1067].map((x) => <g key={x} transform={`translate(${x} 226)`}><path d="M 0 0 L 23 -10 L 33 0 V 130 L 23 140 L 0 130 Z" fill="#252c33" stroke="#111820" /><rect x="9" y="12" width="13" height="106" rx="4" fill="#171e26" />{screw(17, 0, 'a')}{screw(17, 130, 'b')}</g>)}
      </>;
      break;
    case 'pilot-lamp':
    case 'pb-switch': {
      const lamp = assetId === 'pilot-lamp';
      body = <>{panel(lamp ? 'N-2260-06' : 'N-2260-03', lamp ? 'PILOT LAMP UNIT' : 'PUSH BUTTON UNIT')}
        <rect x={lamp ? 43 : 21} y="30" width={lamp ? 74 : 118} height="24" rx="2" fill="#252a2d" stroke="#151c22" />
        {lamp ? <>{text(58, 70, '+', 12, '#253440', 'middle')}{text(102, 70, '−', 12, '#253440', 'middle')}<path d="M 65 64 H 73 M 87 64 H 95" stroke="#39444e" /><circle cx="80" cy="64" r="6" fill="none" stroke="#39444e" /><path d="M 76 60 L 84 68 M 76 68 L 84 60" stroke="#39444e" /></> : <>{text(48, 68, 'NO', 9, '#2e3a45', 'middle')}{text(112, 68, 'NC', 9, '#2e3a45', 'middle')}</>}
        <circle cx="80" cy="118" r="41" fill={fill('metal')} stroke="#8a949e" />
        <circle cx="80" cy="118" r="34" fill="#303946" stroke="#f0f4f7" strokeWidth="2" />
        {energized && lamp && <circle cx="80" cy="118" r="36" fill="#ffd42a" filter={fill('glow')} opacity=".8" />}
        <circle cx="80" cy={settings?.pressed ? 120 : 118} r={settings?.pressed ? 27 : 30} fill={fill(lamp ? 'amber' : 'blue')} stroke={lamp ? '#9c7c08' : '#1749a2'} strokeWidth="2" />
        <ellipse cx="73" cy="106" rx="17" ry="9" fill="white" opacity={lamp ? '.25' : '.2'} />
        {lamp && <><circle cx="80" cy="118" r="21" fill="none" stroke="#fff1a9" opacity=".5" /><circle cx="80" cy="118" r="8" fill="#dab121" opacity=".6" /></>}
        {text(80, 167, lamp ? 'DC 24V' : settings?.pressed ? 'PRESSED' : 'NO / NC', 8, '#727d87', 'middle')}
      </>;
      break;
    }
    case 'relay-socket':
      body = <>{panel('N-2260-11', 'RELAY UNIT · 14P')}
        <rect x="109" y="24" width="94" height="152" rx="3" fill="#252b30" stroke="#14191f" />
        {Array.from({ length: 20 }, (_, i) => <rect key={i} x={119 + i % 4 * 21} y={56 + Math.floor(i / 4) * 18} width="11" height="10" rx="1" fill="#10171c" stroke="#47515a" />)}
        {[0, 1, 2, 3].map((i) => <g key={i} transform={`translate(${25 + i * 20} 64)`}><path d="M 0 0 V 24 M 0 24 L -5 45 M 0 50 V 66 M -7 24 H 0 M -7 24 V 40" stroke="#3f4d56" fill="none" strokeWidth="1.3" />{text(0, -5, String(i + 1), 7, '#3e4b55', 'middle')}{text(0, 77, String(i + 9), 7, '#3e4b55', 'middle')}</g>)}
        <path d="M 24 159 H 43 V 151 H 71 V 167 H 43 V 159 M 71 159 H 92" stroke="#475560" fill="none" />
        {text(22, 177, '13(−)   24VDC   14(+)', 7)}
      </>;
      break;
    case 'relay-body':
      body = <>
        <rect x="7" y="125" width="86" height="10" rx="2" fill="#343c43" />
        {[20, 39, 61, 80].map((x) => <path key={x} d={`M ${x} 130 v 9`} stroke={fill('metal')} strokeWidth="5" />)}
        <rect x="6" y="6" width="88" height="122" rx="4" fill={fill('glass')} stroke="#8598a9" strokeWidth="2" />
        <rect x="15" y="15" width="70" height="102" fill="#273746" opacity=".3" />
        <path d="M 20 20 L 28 62 M 80 20 L 71 63 M 38 20 L 35 70 M 63 20 L 65 70" stroke="#d2d8db" strokeWidth="5" fill="none" />
        <rect x="34" y="64" width="32" height="51" rx="5" fill="#734c32" stroke="#232e36" strokeWidth="3" />
        {Array.from({ length: 17 }, (_, i) => <path key={i} d={`M 36 ${67 + i * 2.6} H 64`} stroke={i % 2 ? '#bd8453' : '#61432e'} strokeWidth="1.3" />)}
        <path d="M 13 11 H 86 V 36 L 13 92 Z" fill="white" opacity=".12" />
        {text(50, 123, 'DC 24V', 8, '#dae5ec', 'middle')}
      </>;
      break;
    case 'timer-at8n': {
      const angle = -135 + (settings?.timerSeconds ?? 3) / 10 * 270;
      body = <>
        <rect x="2" y="2" width="176" height="196" rx="7" fill={fill('housing')} stroke="#9ca9b3" strokeWidth="2" />
        <rect x="7" y="7" width="166" height="185" rx="2" fill="#f2f1e9" stroke="#c5c6bf" />
        {text(15, 22, 'POWER', 8)}{text(143, 22, 'OUT', 8)}
        <circle cx="25" cy="33" r="4" fill="#46534e" /><circle cx="152" cy="33" r="4" fill="#46534e" />
        <circle cx="90" cy="107" r="71" fill={fill('metal')} stroke="#7d8995" />
        <circle cx="90" cy="107" r="64" fill="#242c34" stroke="#e5e7e5" strokeWidth="2" />
        {Array.from({ length: 51 }, (_, i) => <path key={i} d={`M 90 45 V ${i % 5 === 0 ? 54 : 49}`} stroke="#d1d7db" strokeWidth={i % 5 === 0 ? 1.5 : .7} transform={`rotate(${-135 + i * 5.4} 90 107)`} />)}
        {Array.from({ length: 6 }, (_, i) => { const a = (-135 + i * 54) * Math.PI / 180; return text(90 + Math.sin(a) * 48, 110 - Math.cos(a) * 48, String(i * 2), 9, '#f5f5ef', 'middle'); })}
        <circle cx="90" cy="107" r="31" fill={fill('metal')} stroke="#e7eaed" strokeWidth="3" />
        <circle cx="90" cy="107" r="23" fill="none" stroke="#76818b" />
        <path d="M 90 107 V 52" stroke="#d53133" strokeWidth="2.5" transform={`rotate(${angle} 90 107)`} />
        <circle cx="90" cy="107" r="5" fill="#c4cbd0" stroke="#71808b" />
        {text(90, 156, 'sec', 9, '#ecefe9', 'middle')}{text(16, 186, 'AT8N', 12)}{text(162, 186, 'Autonics', 10, '#263340', 'end')}
      </>;
      break;
    }
    case 'breadboard':
      body = <>
        <rect x="2" y="2" width="556" height="296" rx="10" fill="#27313b" stroke="#101820" strokeWidth="2" />
        <rect x="24" y="14" width="512" height="272" rx="3" fill={fill('plastic')} stroke="#bfc6cc" />
        <rect x="30" y="65" width="500" height="61" fill="#edf0ed" stroke="#d2d7d4" /><rect x="30" y="153" width="500" height="61" fill="#edf0ed" stroke="#d2d7d4" />
        <rect x="32" y="133" width="496" height="10" rx="2" fill="#c7ccca" /><path d="M 32 133 H 528" stroke="#a3aba9" />
        {[22, 246].map((y) => <g key={y}><path d={`M 39 ${y} H 519`} stroke="#d6494c" /><path d={`M 39 ${y + 29} H 519`} stroke="#3985c5" />{text(31, y + 12, '+', 9, '#c94146', 'middle')}{text(31, y + 27, '−', 9, '#3979b9', 'middle')}</g>)}
        {Array.from({ length: 10 }, (_, i) => text(32, 78 + i * 12 + (i >= 5 ? 28 : 0), 'abcdefghij'[i], 6, '#63716e', 'middle'))}
        {Array.from({ length: 30 }, (_, i) => text(47 + i * 16, 61, String(i + 1), 5, '#5e6b68', 'middle'))}
        <rect x="7" y="223" width="11" height="62" fill="#f0c928" rx="1" />
        <text x="15" y="278" fontSize="7" fill="#222e36" transform="rotate(-90 15 278)">E·CALL EIC-108</text>
      </>;
      break;
    case 'power-supply':
      body = <>
        <rect x="2" y="2" width="306" height="186" rx="13" fill={fill('housing')} stroke="#929fa8" strokeWidth="2" />
        <rect x="8" y="8" width="294" height="177" rx="8" fill="#e8ebe7" stroke="#c2c9c5" />
        <rect x="65" y="11" width="181" height="18" rx="2" fill="#f5f7f1" stroke="#b7c2b9" />
        {text(72, 23, 'EZ DIGITAL', 9)}{text(166, 23, 'GP-4303TP', 9)}
        <rect x="77" y="36" width="156" height="74" rx="2" fill={fill('lcd')} stroke="#adb5b3" strokeWidth="3" />
        {text(155, 48, 'MULTIPLE OUTPUT POWER SUPPLY', 5, '#a1bcb2', 'middle')}
        {text(89, 73, settings?.voltage.toFixed(1).padStart(4, '0') ?? '05.0', 24, '#83bf9f')}{text(213, 73, 'V', 10, '#d4e6d7')}
        {text(89, 99, '—.—', 21, '#5c7469')}{text(213, 99, 'A', 10, '#a8c2b0')}
        {knob(38, 52, 19)}{knob(38, 99, 19)}{knob(273, 52, 19)}{knob(273, 99, 19)}
        {text(38, 80, 'SLAVE', 7, '#3d4b46', 'middle')}{text(273, 80, 'MASTER', 7, '#3d4b46', 'middle')}
        <path d="M 12 127 H 298" stroke="#b4bdb8" />
        <rect x="126" y="116" width="15" height="7" rx="1" fill="#d8ddd6" stroke="#7f8983" /><circle cx="155" cy="119" r="3" fill="#934b45" /><rect x="171" y="116" width="15" height="7" rx="1" fill="#d8ddd6" stroke="#7f8983" />
        {knob(33, 157, 11)}{text(33, 178, 'POWER', 6, '#3d4b46', 'middle')}
        {text(127, 138, '−', 10, '#263b34', 'middle')}{text(168, 138, 'GND', 7, '#263b34', 'middle')}{text(209, 138, '+', 10, '#263b34', 'middle')}
        <rect x="270" y="148" width="11" height="22" rx="2" fill="#4b5553" stroke="#a1aaa1" />{text(275, 142, 'USB', 6, '#3d4b46', 'middle')}
      </>;
      break;
    case 'oscilloscope':
      body = <>
        <rect x="2" y="2" width="316" height="181" rx="13" fill={fill('housing')} stroke="#a0a7aa" strokeWidth="2" />
        <rect x="9" y="9" width="302" height="165" rx="6" fill="#edece4" stroke="#c7c5bc" />
        <rect x="17" y="15" width="34" height="13" fill="#f2d231" />{text(20, 25, 'RIGOL', 9)}{text(57, 25, 'DS5152C', 11)}{text(122, 24, 'DIGITAL OSCILLOSCOPE', 5)}
        <rect x="18" y="36" width="168" height="119" rx="5" fill="#303838" />
        <rect x="25" y="44" width="154" height="104" rx="2" fill="#0a1e39" />
        {Array.from({ length: 11 }, (_, i) => <path key={'v' + i} d={`M ${33 + i * 13.8} 56 V 135`} stroke="#23405e" strokeWidth=".5" />)}
        {Array.from({ length: 7 }, (_, i) => <path key={'h' + i} d={`M 33 ${56 + i * 13} H 171`} stroke="#23405e" strokeWidth=".5" />)}
        {text(32, 52, 'CH1   -- V', 6, '#d5bd4d')}{text(32, 144, 'NO SIGNAL · ENGINE PENDING', 5, '#91b2d0')}
        {[0, 1, 2, 3].map((i) => <g key={i}><rect x={202 + i % 2 * 41} y={20 + Math.floor(i / 2) * 15} width="25" height="9" rx="2" fill={fill('knob')} stroke="#9daba8" /></g>)}
        <rect x="286" y="22" width="17" height="21" rx="2" fill="#6d8990" />
        {knob(220, 78, 12)}{knob(271, 78, 12)}{knob(220, 119, 18)}{knob(271, 119, 18)}
        <rect x="191" y="64" width="14" height="9" rx="2" fill="#e5c63f" /><rect x="191" y="80" width="14" height="9" rx="2" fill="#46aed6" />
        {text(211, 144, 'CH1', 7, '#2f3d46', 'middle')}{text(252, 144, 'CH2', 7, '#2f3d46', 'middle')}
        <rect x="18" y="163" width="16" height="8" rx="2" fill={fill('knob')} stroke="#a4aba4" />
      </>;
      break;
    case 'led-red':
      body = <>
        <path d="M 25 47 L 22 96 M 40 47 L 43 96" fill="none" stroke={fill('metal')} strokeWidth="3" />
        {energized && <ellipse cx="32.5" cy="29" rx="23" ry="27" fill="#ff3535" opacity=".7" filter={fill('glow')} />}
        <path d="M 17 45 V 25 A 15.5 18 0 0 1 48 25 V 45 Z" fill={fill('red')} stroke="#b51b2b" strokeWidth="1.5" />
        <path d="M 26 44 V 31 H 38 V 44" fill="none" stroke="#e3978f" strokeWidth="2" opacity=".7" />
        <rect x="14" y="44" width="37" height="6" rx="2" fill="#dd3447" stroke="#a42135" /><ellipse cx="26" cy="22" rx="4" ry="8" fill="#ffccc2" opacity=".6" />
        {text(17, 108, 'A', 7)}{text(44, 108, 'K', 7)}
      </>;
      break;
    case 'resistor-330':
      body = <>
        <path d="M 12 49 V 30 Q 12 22 25 22 H 120 Q 133 22 133 30 V 49" fill="none" stroke={fill('metal')} strokeWidth="3" />
        <rect x="43" y="12" width="59" height="21" rx="8" fill="#d4bf8c" stroke="#a18e5b" />
        <path d="M 48 14 H 96" stroke="#f4e4b8" strokeWidth="3" opacity=".7" />
        {['#d87024', '#d87024', '#734123', '#b29439'].map((color, i) => <rect key={i} x={54 + i * 12} y="12" width="5" height="21" fill={color} />)}
        {text(72, 61, '330 Ω', 8, '#53616c', 'middle')}
      </>;
      break;
    case 'ic-dip14':
      body = <>
        {definition.pins.map((pin) => <path key={pin.id} d={`M ${pin.position.x} ${pin.position.y} V ${pin.position.y < 50 ? 35 : 65}`} stroke={fill('metal')} strokeWidth="8" />)}
        <rect x="9" y="27" width="192" height="46" rx="3" fill="#242b32" stroke="#10161d" strokeWidth="2" />
        <path d="M 10 42 A 8 8 0 0 1 10 58" fill="#10161d" stroke="#535e67" />
        <path d="M 13 29 H 197" stroke="#58626b" />
        <circle cx="28" cy="63" r="3" fill="#0c141b" />
        {text(105, 48, '74LS00P', 14, '#bbc0be', 'middle')}{text(105, 63, 'QUAD NAND · 14 PIN', 7, '#7d898e', 'middle')}
        {definition.pins.map((pin) => <text key={pin.id} x={pin.position.x} y={pin.position.y < 50 ? 8 : 99} fontSize="6" textAnchor="middle" fill="#546574">{pin.id}</text>)}
      </>;
      break;
    case 'switch-3pin':
      body = <>
        <path d="M 25 58 V 85 M 45 58 V 85 M 65 58 V 85" stroke={fill('metal')} strokeWidth="4" />
        <rect x="10" y="35" width="70" height="28" rx="3" fill={fill('metal')} stroke="#78858f" strokeWidth="2" />
        <rect x="25" y="40" width="40" height="17" rx="2" fill="#252d35" />
        <rect x={settings?.switchOn ? 47 : 28} y="13" width="15" height="38" rx="1" fill="#303942" stroke="#161f28" />
        {screw(17, 48, 'left')}{screw(73, 48, 'right')}{text(45, 98, '1    COM    2', 7, '#53616c', 'middle')}
      </>;
      break;
    case 'screwdriver':
      body = <><path d="M 25 5 V 112" stroke={fill('metal')} strokeWidth="5" /><path d="M 23 5 L 22 0 H 28 L 27 5" fill="#7e8c96" /><rect x="16" y="103" width="18" height="42" rx="5" fill={fill('glass')} stroke="#a7b6bf" /><rect x="12" y="140" width="26" height="56" rx="7" fill={fill('red')} stroke="#9a2432" />{[18, 25, 32].map((x) => <path key={x} d={`M ${x} 151 V 184`} stroke="#fa7c7d" opacity=".5" />)}</>;
  }
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox={definition.viewBox.join(' ')} width={preview ? '100%' : width} height={preview ? '100%' : height} overflow="visible" aria-hidden="true" focusable="false" style={{ display: 'block', pointerEvents: 'none' }}>
    <defs>
      <linearGradient id={`${uid}-metal`} x1="0" y1="0" x2=".8" y2="1"><stop stopColor="#f5f8fc" /><stop offset=".25" stopColor="#a9b5c1" /><stop offset=".48" stopColor="#e8edf2" /><stop offset=".7" stopColor="#7d8c9a" /><stop offset="1" stopColor="#dce3e9" /></linearGradient>
      <linearGradient id={`${uid}-rail`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#eff4f9" /><stop offset=".3" stopColor="#ccd7e2" /><stop offset=".8" stopColor="#aebbc9" /><stop offset="1" stopColor="#e5ecf3" /></linearGradient>
      <linearGradient id={`${uid}-housing`} x2="1" y2="1"><stop stopColor="#f8f9f8" /><stop offset=".55" stopColor="#d7ddde" /><stop offset="1" stopColor="#b4bfc6" /></linearGradient>
      <linearGradient id={`${uid}-glass`} x2="1" y2="1"><stop stopColor="#e3f0fb" stopOpacity=".6" /><stop offset=".5" stopColor="#768ea0" stopOpacity=".42" /><stop offset="1" stopColor="#d5e6f2" stopOpacity=".66" /></linearGradient>
      <linearGradient id={`${uid}-plastic`} x2="0" y2="1"><stop stopColor="#fffef9" /><stop offset="1" stopColor="#e4e8e5" /></linearGradient>
      <linearGradient id={`${uid}-lcd`} x2="0" y2="1"><stop stopColor="#091a15" /><stop offset="1" stopColor="#162c25" /></linearGradient>
      <radialGradient id={`${uid}-knob`} cx=".35" cy=".25" r=".8"><stop stopColor="#f9f8ee" /><stop offset=".75" stopColor="#d2d2c6" /><stop offset="1" stopColor="#a0a69f" /></radialGradient>
      <radialGradient id={`${uid}-amber`} cx=".38" cy=".3" r=".7"><stop stopColor={energized ? '#fffaca' : '#f1dc6f'} /><stop offset=".6" stopColor={energized ? '#ffda24' : '#c7a91c'} /><stop offset="1" stopColor="#80680a" /></radialGradient>
      <radialGradient id={`${uid}-blue`} cx=".35" cy=".25" r=".8"><stop stopColor="#2d87ff" /><stop offset=".6" stopColor="#1352c7" /><stop offset="1" stopColor="#09277e" /></radialGradient>
      <radialGradient id={`${uid}-red`} cx=".3" cy=".2" r=".85"><stop stopColor="#ff9b8b" /><stop offset=".45" stopColor={energized ? '#ff313c' : '#dc3045'} /><stop offset="1" stopColor="#8f162c" /></radialGradient>
      <filter id={`${uid}-glow`} x="-70%" y="-70%" width="240%" height="240%"><feGaussianBlur stdDeviation="7" /></filter>
    </defs>
    <g fontFamily="Arial, 'Malgun Gothic', sans-serif" fontWeight="500">{body}{definition.pins.map((pin) => <Terminal key={pin.id} pin={pin} metal={fill('metal')} />)}</g>
  </svg>;
}

function Terminal({ pin, metal }: { pin: LocalPin; metal: string }) {
  const { x, y } = pin.position;
  if (pin.style === 'hole') return <g transform={`translate(${x} ${y})`}><rect x="-2.9" y="-2.6" width="5.8" height="5.2" rx=".8" fill="#b2bcb6" /><rect x="-1.7" y="-1.6" width="3.4" height="3.2" rx=".6" fill="#34403c" /></g>;
  if (pin.style === 'lead') return <circle cx={x} cy={y} r="2.6" fill={metal} stroke="#65747d" strokeWidth=".7" />;
  if (pin.style === 'socket') return <g transform={`translate(${x} ${y})`}><circle r="12" fill={metal} stroke="#9ca7ad" /><circle r="9.5" fill={pin.id === 'plus' ? '#c72f35' : pin.id === 'gnd' ? '#158660' : pin.id.startsWith('ch') ? '#ac9d78' : '#303a40'} /><circle r="5.5" fill="#172329" stroke="#9ba5a2" strokeWidth="1.2" /><circle r="2.5" fill="#070f14" /></g>;
  return <g transform={`translate(${x} ${y})`}><rect x="-9" y="-9" width="18" height="18" rx="2" fill="#292f33" stroke="#10191e" /><circle r="6.8" fill={metal} stroke="#747d80" /><circle r="4.5" fill="none" stroke="#e9e4d7" strokeWidth=".9" /><path d="M -3.4 2 L 3.4 -2" stroke="#414b52" strokeWidth="1.7" /></g>;
}
