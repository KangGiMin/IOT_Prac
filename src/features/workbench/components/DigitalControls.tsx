import { IC_MODELS, TTL_MODELS, icModel } from '../../../config/ttlModels';
import { breadboardPinById, insertedPins } from '../../../config/digitalPins';
import type { CircuitComponent } from '../../../types/circuit';
import { useCircuitStore } from '../../../store/usePhotoCircuitStore';
import { useLearningCenter } from '../../learning/useLearningCenter';
export function DigitalControls({ component: c }: { component: CircuitComponent }) {
  const s = useCircuitStore(),
    locked = s.calibration || s.workspaces[s.mode].power.on;
  if (c.assetId === 'ic-dip14')
    return (
      <>
        <label className="setting-field">
          <span id="ttl-model-label">TTL IC 모델</span>
          <select
            aria-labelledby="ttl-model-label"
            disabled={locked}
            value={icModel(c)}
            onChange={(e) =>
              s.updateSettings(c.id, {
                icModel: e.target.value as (typeof IC_MODELS)[number],
              })
            }
          >
            {IC_MODELS.map((model) => (
              <option key={model} value={model}>
                {model} · {TTL_MODELS[model].name}
              </option>
            ))}
          </select>
        </label>
        {icModel(c) === '7406' && (
          <label className="setting-field">
            <input
              type="checkbox"
              disabled={locked}
              checked={c.settings.openCollector ?? false}
              onChange={(e) => s.updateSettings(c.id, { openCollector: e.target.checked })}
            />{' '}
            오픈컬렉터 모드
          </label>
        )}
        <p className="panel-description">
          {c.insertion
            ? `브레드보드 ${c.insertion.bank + 1}구역 · ${c.insertion.column}열 장착`
            : '중앙 홈으로 드래그해 장착하세요.'}
        </p>
        {icModel(c) === '7406' && (
          <p className="panel-description">
            기본 NOT는 학습용 능동 HIGH 출력입니다. 실제 오픈컬렉터 모드에서는 HIGH를 만들 외부 풀업
            저항이 필요합니다.
          </p>
        )}
      </>
    );
  if (c.insertion?.row) {
    const holes = Object.values(insertedPins(c)).map(
      ({ pinId }) => breadboardPinById.get(pinId)?.label ?? pinId,
    );
    return <p className="panel-description">브레드보드 장착 · {holes.join(' · ')}</p>;
  }
  if (c.assetId === 'oscilloscope')
    return (
      <>
        <button
          className="component-control"
          disabled={s.calibration || c.settings.scopePowered === false}
          onClick={() =>
            s.updateSettings(c.id, {
              scopeRunning: c.settings.scopeRunning === false,
            })
          }
        >
          {c.settings.scopeRunning === false ? 'RUN' : 'STOP'}
        </button>
        <button
          className="component-control"
          onClick={() => useLearningCenter.getState().openScope(c.id)}
        >
          확장 계측·사용법 열기
        </button>
      </>
    );
  if (c.assetId === 'power-supply')
    return (
      <button
        className="component-control"
        disabled={s.calibration}
        aria-pressed={c.settings.outputEnabled !== false}
        onClick={() =>
          s.updateSettings(c.id, {
            outputEnabled: c.settings.outputEnabled === false,
          })
        }
      >
        OUTPUT {c.settings.outputEnabled === false ? 'OFF' : 'ON'}
      </button>
    );
  return null;
}
