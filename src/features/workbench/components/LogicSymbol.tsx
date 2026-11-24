import type { LogicGate } from '../../../types/circuit';
export function LogicSymbol({gate}:{gate:LogicGate}) {
  const invert=['NAND','NOT','XNOR','NOR'].includes(gate),exclusive=gate==='XOR'||gate==='XNOR',or=['OR','NOR','XOR','XNOR'].includes(gate);
  return <svg className="logic-symbol" viewBox="0 0 160 80" role="img" aria-label={`${gate} 논리 기호`}>
    <g fill="#eff8f2" stroke="#397b5a" strokeWidth="2" strokeLinecap="round">
      {gate==='NOT'?<><path d="M30 40H55M55 15L110 40L55 65Z"/></>:<><path d="M25 25H60M25 55H60"/>{or?<path d="M50 15Q85 12 112 40Q85 68 50 65Q73 40 50 15Z"/>:<path d="M55 15H85A25 25 0 0 1 85 65H55Z"/>}</>}
      {exclusive&&<path d="M43 15Q66 40 43 65" fill="none"/>}
      {invert&&<circle cx="116" cy="40" r="4" fill="white"/>}<path d={`M${invert?120:112} 40H139`}/>
    </g><g fill="#397b5a" fontSize="13" fontFamily="monospace"><text x="10" y={gate==='NOT'?44:29}>A</text>{gate!=='NOT'&&<text x="10" y="59">B</text>}<text x="144" y="44">Y</text></g>
  </svg>;
}
