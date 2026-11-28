export const supplyTrackingModes = ['independent', 'series', 'parallel'] as const;
export const auxiliaryVoltages = [2.5, 3.3, 5] as const;
export type SupplyTracking = (typeof supplyTrackingModes)[number];

export interface SupplySettings {
  ch2Voltage: number;
  ch1Limit: number;
  ch2Limit: number;
  auxiliaryVoltage: (typeof auxiliaryVoltages)[number];
  tracking: SupplyTracking;
}

const defaults: SupplySettings = {
  ch2Voltage: 5,
  ch1Limit: 3,
  ch2Limit: 3,
  auxiliaryVoltage: 5,
  tracking: 'independent',
};

export const getSupplySettings = (settings?: SupplySettings): Readonly<SupplySettings> =>
  settings ?? defaults;

export function parseSupplySettings(input: unknown): SupplySettings {
  const s = input as Partial<SupplySettings> | null;
  const inRange = (value: unknown, max: number): value is number =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max;
  if (
    !s ||
    !inRange(s.ch2Voltage, 30) ||
    !inRange(s.ch1Limit, 3) ||
    !inRange(s.ch2Limit, 3) ||
    !supplyTrackingModes.includes(s.tracking as SupplyTracking) ||
    !auxiliaryVoltages.includes(s.auxiliaryVoltage as SupplySettings['auxiliaryVoltage'])
  )
    throw new Error('파워서플라이 채널 설정이 올바르지 않습니다.');
  return {
    ch2Voltage: s.ch2Voltage,
    ch1Limit: s.ch1Limit,
    ch2Limit: s.ch2Limit,
    tracking: s.tracking!,
    auxiliaryVoltage: s.auxiliaryVoltage!,
  };
}
