import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { useCircuitStore } from '../../../store/usePhotoCircuitStore';

export function CircuitFaultPanel() {
  const state = useCircuitStore();
  const simulation = state.workspaces[state.mode].simulation;
  const faults = simulation.faults ?? [];
  return (
    <section
      className={`inspector-section circuit-fault-panel ${faults.length ? 'has-faults' : ''}`}
      aria-label="회로 해석 및 오류 원인"
    >
      <div className="panel-heading">
        {faults.length ? <AlertTriangle size={17} /> : <ShieldCheck size={17} />}
        <h2>{faults.length ? '보호 정지 · 오류 원인' : '회로 해석 상태'}</h2>
      </div>
      {faults.length ? (
        <>
          <ol className="circuit-fault-list" role="alert">
            {faults.map((fault, index) => (
              <li key={`${fault.code}-${index}`}>
                <strong>{fault.code}</strong>
                <p>{fault.message}</p>
                {fault.wireIds.length > 0 && (
                  <button onClick={() => state.selectWire(fault.wireIds[0])}>
                    관련 전선 선택 ({fault.wireIds.length}개)
                  </button>
                )}
              </li>
            ))}
          </ol>
          <p className="fault-repair-note">
            오류가 해소될 때까지 모든 출력을 차단합니다. 선택한 오류 배선은 전원 ON 중에도 삭제할 수
            있습니다.
          </p>
        </>
      ) : (
        <p className="panel-description">
          {simulation.status === 'running'
            ? 'DC 24V / TTL 5V 회로를 실시간으로 해석하고 있습니다.'
            : '배선을 검사했습니다. 메인 전원을 켜면 동작합니다.'}
        </p>
      )}
      <p className="net-count">
        {simulation.nets?.length ?? 0} Nets · {simulation.energizedComponents.length}개 부품 동작
      </p>
      {!!simulation.warnings?.length && (
        <ul className="solver-warnings">
          {simulation.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
