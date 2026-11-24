import { icModel, TTL_MODELS } from './ttlModels';
import type { CircuitComponent, PhotoPinDefinition } from '../types/circuit';
export function pinTooltip(c:CircuitComponent,pin:PhotoPinDefinition):string {
  if(c.assetId!=='ic-dip14')return `Pin ${pin.id}: ${pin.label}`;
  if(pin.id==='14')return 'Pin 14: VCC (+5V)';
  if(pin.id==='7')return 'Pin 7: GND (0V)';
  const model=icModel(c),gates=TTL_MODELS[model].gates;
  const output=gates.findIndex(g=>g.output===pin.id);
  if(output>=0)return `Pin ${pin.id}: ${model} Gate ${output+1} Y (OUTPUT)`;
  const input=gates.findIndex(g=>g.inputs.includes(pin.id));
  return `Pin ${pin.id}: ${model} Gate ${input+1} ${'ABC'[gates[input]?.inputs.indexOf(pin.id)??0]} (INPUT)`;
}
