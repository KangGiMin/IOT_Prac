import { IC_MODELS, TTL_MODELS, icModel } from "../../../config/ttlModels";
import type { CircuitComponent } from "../../../types/circuit";
import { useCircuitStore } from "../../../store/usePhotoCircuitStore";
export function DigitalControls({
  component: c,
}: {
  component: CircuitComponent;
}) {
  const s = useCircuitStore(),
    locked = s.calibration || s.workspaces[s.mode].power.on;
  if (c.assetId === "ic-dip14")
    return (
      <>
        <label className="setting-field">
          TTL IC 모델
          <select
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
        {icModel(c) === "7406" && (
          <label className="setting-field">
            <input
              type="checkbox"
              disabled={locked}
              checked={c.settings.openCollector ?? false}
              onChange={(e) =>
                s.updateSettings(c.id, { openCollector: e.target.checked })
              }
            />{" "}
            오픈컬렉터 모드
          </label>
        )}
        <p className="panel-description">
          {c.insertion
            ? `브레드보드 ${c.insertion.bank + 1}구역 · ${c.insertion.column}열 장착`
            : "중앙 홈으로 드래그해 장착하세요."}
        </p>
        {icModel(c) === "7406" && (
          <p className="panel-description">
            기본 NOT는 학습용 능동 HIGH 출력입니다. 실제 오픈컬렉터 모드에서는
            HIGH를 만들 외부 풀업 저항이 필요합니다.
          </p>
        )}
      </>
    );
  if (c.assetId === "oscilloscope")
    return (
      <button
        className="component-control"
        disabled={s.calibration}
        onClick={() =>
          s.updateSettings(c.id, {
            scopeRunning: c.settings.scopeRunning === false,
          })
        }
      >
        {c.settings.scopeRunning === false ? "RUN" : "STOP"}
      </button>
    );
  if (c.assetId === "power-supply")
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
        OUTPUT {c.settings.outputEnabled === false ? "OFF" : "ON"}
      </button>
    );
  return null;
}
