import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useCircuitStore } from '../../store/usePhotoCircuitStore';
import {
  exportCircuitFile,
  MAX_CIRCUIT_FILE_BYTES,
} from '../../engine/circuitFile';
export function LearningToolbar() {
  const state = useCircuitStore(
      useShallow(({ workspaces: _workspaces, ...state }) => state),
    ),
    fileInput = useRef<HTMLInputElement>(null),
    history = state.histories[state.mode];
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLElement &&
        (event.target.closest('input,textarea,select') ||
          event.target.isContentEditable)
      )
        return;
      const s = useCircuitStore.getState(),
        key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && key === 'z') {
        event.preventDefault();
        if (event.shiftKey) s.redo();
        else s.undo();
      } else if ((event.ctrlKey || event.metaKey) && key === 'y') {
        event.preventDefault();
        s.redo();
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        s.deleteSelection();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  const save = () => {
    try {
      const s = useCircuitStore.getState(),
        source = exportCircuitFile(s.mode, s.workspaces),
        url = URL.createObjectURL(
          new Blob([source], { type: 'application/json' }),
        );
      const a = document.createElement('a');
      a.href = url;
      a.download = 'iot-circuit-lab.json';
      document.body.append(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      useCircuitStore.setState({
        notice: `저장 실패: ${error instanceof Error ? error.message : '회로 파일을 만들 수 없습니다.'}`,
      });
    }
  };
  return (
    <div className="learning-toolbar" role="group" aria-label="학습 편의 기능">
      <button
        disabled={!history.past.length || !!state.dragHistory}
        onClick={state.undo}
        title="Ctrl+Z"
      >
        실행 취소 <kbd>Ctrl+Z</kbd>
      </button>
      <button
        disabled={!history.future.length || !!state.dragHistory}
        onClick={state.redo}
        title="Ctrl+Y"
      >
        다시 실행 <kbd>Ctrl+Y</kbd>
      </button>
      <span className="tool-separator" />
      <button onClick={save}>회로 JSON 저장</button>
      <button onClick={() => fileInput.current?.click()}>
        회로 JSON 불러오기
      </button>
      <input
        ref={fileInput}
        className="sr-only"
        type="file"
        accept=".json,application/json"
        aria-label="회로 JSON 파일"
        onChange={async (event) => {
          const input = event.currentTarget,
            file = input.files?.[0];
          if (!file) return;
          try {
            if (file.size > MAX_CIRCUIT_FILE_BYTES)
              throw new Error('회로 파일은 1MB 이하여야 합니다.');
            const source = await file.text();
            useCircuitStore.getState().importJson(source);
          } catch (error) {
            useCircuitStore.setState({
              notice: `불러오기 실패: ${error instanceof Error ? error.message : '파일을 읽을 수 없습니다.'}`,
            });
          } finally {
            input.value = '';
          }
        }}
      />
      <span className="tool-separator" />
      <span className="preset-label">예제 회로</span>
      <button onClick={() => state.loadPreset('self-hold')}>
        시퀀스 · 자기유지
      </button>
      <button onClick={() => state.loadPreset('nand')}>
        디지털 · 7400 NAND
      </button>
    </div>
  );
}
