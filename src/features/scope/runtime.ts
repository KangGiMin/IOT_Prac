import { create } from 'zustand';
import type { ScopeCapture } from './scopeMath';
import type { ScopeChannelId } from './model';
export interface ScopeRecord {
  capture: ScopeCapture | null;
  status: string;
}
interface Runtime {
  records: Record<string, ScopeRecord>;
  references: Record<string, { capture: ScopeCapture; channel: ScopeChannelId } | null>;
  commands: Record<string, { type: 'force' | 'clear' | 'single'; nonce: number }>;
  publish: (id: string, record: ScopeRecord) => void;
  command: (id: string, type: 'force' | 'clear' | 'single') => void;
  reference: (id: string, capture: ScopeCapture | null, channel: ScopeChannelId) => void;
}
export const useScopeRuntime = create<Runtime>((set) => ({
  records: Object.create(null),
  commands: Object.create(null),
  references: Object.create(null),
  publish: (id, record) =>
    set((s) => ({ records: Object.assign(Object.create(null), s.records, { [id]: record }) })),
  command: (id, type) =>
    set((s) => ({
      commands: Object.assign(Object.create(null), s.commands, {
        [id]: { type, nonce: (s.commands[id]?.nonce ?? 0) + 1 },
      }),
    })),
  reference: (id, capture, channel) =>
    set((s) => ({
      references: Object.assign(Object.create(null), s.references, {
        [id]: capture ? { capture: structuredClone(capture), channel } : null,
      }),
    })),
}));
