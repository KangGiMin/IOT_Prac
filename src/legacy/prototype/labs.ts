import { BookOpen, CircuitBoard, Workflow } from 'lucide-react';
import type { LabId } from './types';

export const labs = [
  {
    id: 'sequence',
    label: '시퀀스 제어 패널',
    icon: Workflow,
    shortLabel: '시퀀스 제어',
  },
  {
    id: 'breadboard',
    label: '디지털 브레드보드',
    icon: CircuitBoard,
    shortLabel: '브레드보드',
  },
  {
    id: 'theory',
    label: '이론 & 계측기 학습',
    icon: BookOpen,
    shortLabel: '이론 & 계측기',
  },
] satisfies {
  id: LabId;
  label: string;
  icon: typeof Workflow;
  shortLabel: string;
}[];
