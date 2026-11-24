import type { PercentPoint, Size } from '../../../types/circuit';

/** object-fit: contain geometry shared by pins and coordinate calibration. */
export function containBounds(frame: Size, natural: Size) {
  const ratio = Math.min(frame.width / natural.width, frame.height / natural.height);
  const width = natural.width * ratio;
  const height = natural.height * ratio;
  return { x: (frame.width - width) / 2, y: (frame.height - height) / 2, width, height };
}

export function percentAt(clientX: number, clientY: number, rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>): PercentPoint {
  const percent = (value: number) => Math.round(Math.max(0, Math.min(100, value)) * 100) / 100;
  return { x: percent((clientX - rect.left) / rect.width * 100), y: percent((clientY - rect.top) / rect.height * 100) };
}

export const formatCoordinates = (position: PercentPoint) => `{ x: ${position.x}, y: ${position.y} }`;
