import { useEffect } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import { Cable, CircleHelp, LockKeyhole, MousePointer2, Scan } from 'lucide-react';
import { ComponentLibrary } from './components/ComponentLibrary';
import { ComponentNode } from './components/ComponentNode';
import { usePrototypeLabStore } from './store/usePrototypeLabStore';
import type { CircuitLabId } from './types';

const nodeTypes = { component: ComponentNode };

function Canvas({ lab }: { lab: CircuitLabId }) {
  const circuit = usePrototypeLabStore((s) => s.circuits[lab]);
  const powerOn = usePrototypeLabStore((s) => s.powerOn);
  const { changeNodes, changeEdges, connect } = usePrototypeLabStore();
  const { fitView } = useReactFlow();
  // Newly added parts are placed below existing rows; keep them visible.
  useEffect(() => {
    const timer = window.setTimeout(() => void fitView({ padding: 0.2, duration: 250 }), 50);
    return () => window.clearTimeout(timer);
  }, [circuit.nodes.length, fitView]);
  return (
    <div className={`canvas-container ${lab === 'breadboard' ? 'breadboard-canvas' : ''}`}>
      <div className="canvas-top-label">
        <span className="board-label">
          {lab === 'sequence' ? 'SEQUENCE CONTROL BOARD' : 'DIGITAL BREADBOARD'}
        </span>
        <span>{lab === 'sequence' ? 'DC 24V' : 'TTL · DC 5V'}</span>
      </div>
      {lab === 'breadboard' && (
        <div className="breadboard-rails" aria-hidden="true">
          <span>+ &nbsp; + &nbsp; + &nbsp; + &nbsp; + &nbsp; + &nbsp; + &nbsp; +</span>
          <span>− &nbsp; − &nbsp; − &nbsp; − &nbsp; − &nbsp; − &nbsp; − &nbsp; −</span>
        </div>
      )}
      <ReactFlow
        nodes={circuit.nodes}
        edges={circuit.edges}
        nodeTypes={nodeTypes}
        onNodesChange={(changes) => changeNodes(lab, changes)}
        onEdgesChange={(changes) => changeEdges(lab, changes)}
        onConnect={(connection) => connect(lab, connection)}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.25}
        maxZoom={1.5}
        nodesDraggable={!powerOn}
        nodesConnectable={!powerOn}
        deleteKeyCode={powerOn ? null : ['Backspace', 'Delete']}
        snapToGrid
        snapGrid={[10, 10]}
        connectionLineStyle={{ stroke: '#138573', strokeWidth: 2 }}
        proOptions={{ hideAttribution: false }}
        aria-label={
          lab === 'sequence' ? '시퀀스 제어 배선 작업 영역' : '디지털 브레드보드 배선 작업 영역'
        }
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.2} color="#c3ccc9" />
        <Controls showInteractive={false} />
      </ReactFlow>
      <div className="canvas-bottom-label">
        <span>
          {powerOn ? <LockKeyhole size={14} /> : <MousePointer2 size={14} />}
          {powerOn ? '전원 ON · 편집 잠금' : '선택 및 이동'}
        </span>
        <button onClick={() => void fitView({ padding: 0.2, duration: 250 })}>
          <Scan size={15} />
          전체 보기
        </button>
      </div>
    </div>
  );
}

export function Workbench({ lab }: { lab: CircuitLabId }) {
  const circuit = usePrototypeLabStore((s) => s.circuits[lab]);
  return (
    <div className="workbench-layout">
      <ComponentLibrary lab={lab} />
      <section className="workbench-main" aria-label="회로 실습">
        <div className="workbench-heading">
          <div>
            <div className="eyebrow">YOUR WORKSPACE</div>
            <h1>{lab === 'sequence' ? '시퀀스 제어 실습' : '디지털 브레드보드 실습'}</h1>
            <p>
              {lab === 'sequence'
                ? '부품을 배치하고 배선하며 제어 회로의 기초를 익혀 보세요.'
                : 'TTL IC와 디지털 소자를 배치하고 논리 회로를 구성해 보세요.'}
            </p>
          </div>
          <span className="outline-badge">자유 실습</span>
        </div>
        <div className="board-shell">
          <div className="board-toolbar">
            <div>
              <span className="small-square" />
              {lab === 'sequence' ? '제어 판넬' : '브레드보드'}
              <span className="version-tag">{lab === 'sequence' ? '배치 예제' : '배치 모드'}</span>
            </div>
            <span>
              <b>{circuit.nodes.length}</b> 부품 <i /> <b>{circuit.edges.length}</b> 배선
            </span>
          </div>
          <ReactFlowProvider>
            <Canvas lab={lab} />
          </ReactFlowProvider>
          <div className="board-footer">
            <Cable size={15} />
            <span>단자에서 다른 단자로 드래그하여 배선 · 선택 후 Delete로 삭제</span>
            <span className="grid-note">GRID 10</span>
          </div>
        </div>
        <div className="practice-note">
          <CircleHelp size={18} />
          <p>
            <strong>차근차근, 회로의 원리부터.</strong> 학습 가이드에서 부품의 역할과 실습 순서를
            확인하세요.
          </p>
          <span>UI 프로토타입 · 전기 시뮬레이션 미연결</span>
        </div>
      </section>
    </div>
  );
}
