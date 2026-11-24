import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { App } from './App';
import { useCircuitStore } from '../store/usePhotoCircuitStore';
import { createPhotoWorkspace } from '../features/workbench/data/photoCircuits';
import { DeviceSvg } from '../components/devices/DeviceSvg';
import { deviceDefinitions } from '../components/devices/definitions';

// Static markup has no subscriptions. Read the configured test workspace instead
// of Zustand's immutable server-initial snapshot; production hooks stay intact.
vi.mock('../store/usePhotoCircuitStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../store/usePhotoCircuitStore')>();
  const store = actual.useCircuitStore;
  const readSnapshot = ((selector?: (state: ReturnType<typeof store.getState>) => unknown) =>
    selector ? selector(store.getState()) : store.getState()) as typeof store;
  return { ...actual, useCircuitStore: Object.assign(readSnapshot, store) };
});

beforeEach(() => {
  useCircuitStore.setState({
    mode: 'sequence', calibration: false, sample: null, selectedId: null, selectedWireId: null,
    workspaces: { sequence: createPhotoWorkspace('sequence'), digital: createPhotoWorkspace('digital') },
  });
});
afterEach(() => vi.restoreAllMocks());

describe('PNG workbench layout', () => {
  it('offers Light, Dark and System appearance in the header', () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain('aria-label="화면 테마"');
    expect(html).toContain('<option value="light">라이트 모드</option>');
    expect(html).toContain('<option value="dark">다크 모드</option>');
    expect(html).toContain('<option value="system" selected="">시스템 설정</option>');
  });
  it('offers six TTL models and changes the scope control between RUN and STOP',()=>{
    const s=useCircuitStore.getState();s.setMode('digital');s.select('dig-scope');
    const running=renderToStaticMarkup(<App/>);
    for(const model of ['7400','7402','7406','7408','7411','7486'])expect(running).toContain(`>${model}</strong>`);
    expect(running).toContain('>STOP</button>');
    s.updateSettings('dig-scope',{scopeRunning:false});
    expect(renderToStaticMarkup(<App/>)).toContain('>RUN</button>');
  });
  it('presents the exact short cause, affected wire selection and a protection banner', () => {
    const store = useCircuitStore.getState();
    store.connect({ componentId: 'seq-board', pinId: 'plus' }, { componentId: 'seq-board', pinId: 'minus' });
    store.togglePower();
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain('POWER_SHORT');
    expect(html).toContain('부하 없이 직접 단락');
    expect(html).toContain('관련 전선 선택');
    expect(html).toContain('시퀀스 제어 · 보호 정지');
    expect(html).toContain('경고음 활성화');
  });
  it('exposes both modes, header controls, PNG palette, canvas and six missions', () => {
    const html = renderToStaticMarkup(<App />);
    for (const label of ['시퀀스 제어', '디지털 회로', '메인 전원', '전선 색상', '핀 좌표 디버그 모드', '부품 팔레트', '실습 작업 공간', '선택 부품', '6대 논리회로 실습 미션']) {
      expect(html).toContain(label);
    }
    expect(html).toContain('panel-board.png');
    expect(html).toMatch(/<img\b/);
    for (const gate of ['AND', 'OR', 'NOT', 'NAND', 'XNOR', 'XOR']) expect(html).toContain(`>${gate}</button>`);
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('uses the requested IC filename in digital mode and keeps calibration copyable', () => {
    useCircuitStore.getState().setMode('digital');
    useCircuitStore.getState().toggleCalibration();
    useCircuitStore.getState().setSample({ assetId: 'ic-dip14', componentId: 'dig-ic', position: { x: 25.5, y: 75 }, copied: false });
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain('ic-14pin.png');
    expect(html).not.toContain('ic-dip14.png');
    expect(html).toContain('x: 25.50%, y: 75.00%');
    expect(html).toContain('aria-label="보정 좌표"');
  });
});

describe('retained SVG device compatibility', () => {
  it('can still render every legacy SVG device with its declared viewBox', () => {
    for (const definition of Object.values(deviceDefinitions)) {
      const html = renderToStaticMarkup(<DeviceSvg assetId={definition.id} />);
      expect(html).toContain(`viewBox="${definition.viewBox.join(' ')}"`);
      expect(html).not.toMatch(/NaN|undefined/);
    }
  });
});
