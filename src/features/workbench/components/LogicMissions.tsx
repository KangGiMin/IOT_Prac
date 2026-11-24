import { useState } from "react";
import { ListChecks } from "lucide-react";
import { useCircuitStore } from "../../../store/usePhotoCircuitStore";
import { logicMissions } from "../data/logicMissions";
import {
  gradeLogicMission,
  type MissionGrade,
} from "../../../engine/missionGrader";
import { LogicSymbol } from "./LogicSymbol";
export function LogicMissions() {
  const [selected, setSelected] = useState(logicMissions[0].id);
  const [a, setA] = useState<string | null>(null),
    [b, setB] = useState<string | null>(null),
    [led, setLed] = useState<string | null>(null);
  const [graded, setGraded] = useState<{
    signature: string;
    result: MissionGrade;
  } | null>(null);
  const state = useCircuitStore(),
    w = state.workspaces.digital;
  const mission = logicMissions.find((item) => item.id === selected)!;
  const switches = w.components.filter((c) => c.assetId === "switch-3pin"),
    leds = w.components.filter((c) => c.assetId === "led-red");
  const bindings = {
    a: a ?? switches[0]?.id ?? "",
    b: b ?? switches.find((c) => c.id !== (a ?? switches[0]?.id))?.id ?? "",
    led: led ?? leds[0]?.id ?? "",
  };
  const signature = JSON.stringify({
    mission: selected,
    bindings,
    components: w.components,
    wires: w.wires,
  });
  const result = graded?.signature === signature ? graded.result : null;
  return (
    <section
      className="inspector-section logic-missions"
      aria-label="6대 논리회로 실습 미션 및 자동 채점"
    >
      <div className="panel-heading">
        <ListChecks size={17} />
        <h2>6대 논리회로 실습 미션</h2>
      </div>
      <p className="panel-description">
        미션을 선택하고 실제 LED 동작을 검증하세요.
      </p>
      <div className="gate-picker" role="group" aria-label="논리회로 선택">
        {logicMissions.map((item) => (
          <button
            key={item.id}
            aria-pressed={item.id === selected}
            onClick={() => setSelected(item.id)}
          >
            {item.id}
          </button>
        ))}
      </div>
      <div className="mission-detail">
        <h3>{mission.title}</h3>
        <LogicSymbol gate={mission.id} />
        <code>{mission.formula}</code>
        <p>{mission.goal}</p>
        <p>
          <strong>권장 IC</strong> · {mission.recommended}
        </p>
      </div>
      <details className="mission-hint" key={selected}>
        <summary>배선 힌트 펼치기</summary>
        <p>{mission.hint}</p>
        <p>
          입력 스위치의 1번=0V, 2번=+5V, COM=입력입니다. LED는 330Ω과 직렬로
          연결하세요.
        </p>
      </details>
      {state.mode === "digital" ? (
        <>
          <div className="mission-bindings">
            <label>
              A 입력
              <select
                aria-label="미션 A 입력"
                value={bindings.a}
                onChange={(e) => setA(e.target.value)}
              >
                <option value="">스위치 선택</option>
                {switches.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label} · {c.id.slice(-6)}
                  </option>
                ))}
              </select>
            </label>
            {mission.inputs === 2 && (
              <label>
                B 입력
                <select
                  aria-label="미션 B 입력"
                  value={bindings.b}
                  onChange={(e) => setB(e.target.value)}
                >
                  <option value="">스위치 선택</option>
                  {switches.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label} · {c.id.slice(-6)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              Y 출력 LED
              <select
                aria-label="미션 출력 LED"
                value={bindings.led}
                onChange={(e) => setLed(e.target.value)}
              >
                <option value="">LED 선택</option>
                {leds.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label} · {c.id.slice(-6)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            className="component-control"
            onClick={() =>
              setGraded({
                signature,
                result: gradeLogicMission(w, mission, bindings),
              })
            }
          >
            회로 검증하기
          </button>
          <p className="mission-stage-note">
            복사한 회로에 테스트 전원을 공급합니다. 현재 전원·스위치 상태는
            유지합니다.{" "}
            {mission.inputs === 1
              ? "NOT는 입력 0과 1, 두 행을 검사합니다."
              : "00·01·10·11 네 행을 검사합니다."}
          </p>
        </>
      ) : (
        <button
          className="component-control"
          onClick={() => state.setMode("digital")}
        >
          디지털 회로에서 실습하기
        </button>
      )}
      <table className="mission-truth-table">
        <caption>{mission.id} 진리표와 LED 검증</caption>
        <thead>
          <tr>
            <th>A</th>
            {mission.inputs === 2 && <th>B</th>}
            <th>목표 Y</th>
            <th>실제 Y</th>
            <th>결과</th>
          </tr>
        </thead>
        <tbody>
          {mission.truthTable.map((row, index) => {
            const grade = result?.rows[index];
            return (
              <tr
                key={`${row.a}-${row.b ?? ""}`}
                className={
                  grade ? (grade.passed ? "grade-pass" : "grade-fail") : ""
                }
              >
                <td>{row.a}</td>
                {mission.inputs === 2 && <td>{row.b}</td>}
                <td>{row.output}</td>
                <td>{grade?.actual ?? "—"}</td>
                <td title={grade?.hints.join(" ")}>
                  {grade ? (grade.passed ? "성공" : "실패") : "대기"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div aria-live="polite">
        {result ? (
          <>
            <p className="mission-grade-score">
              {result.score}점 ·{" "}
              {result.passed ? "모든 입력 조합 성공" : "배선을 확인하세요"}
            </p>
            {result.hints.length > 0 && (
              <ul className="mission-grade-hints">
                {result.hints.map((hint) => (
                  <li key={hint}>{hint}</li>
                ))}
              </ul>
            )}
          </>
        ) : (
          graded && (
            <p className="mission-stage-note">
              회로 또는 검증 대상이 변경되었습니다. 다시 검증하세요.
            </p>
          )
        )}
      </div>
    </section>
  );
}
