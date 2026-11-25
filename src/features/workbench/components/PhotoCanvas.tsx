import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import type { Edge } from '@xyflow/react';
import {
  Cable,
  Crosshair,
  LockKeyhole,
  Maximize,
  MousePointer2,
} from 'lucide-react';
import { componentAssets } from '../../../config/assets';
import { useCircuitStore } from '../../../store/usePhotoCircuitStore';
import type { AssetId } from '../../../types/circuit';
import { PhotoComponentNode } from './PhotoComponentNode';
import type { PhotoNode } from './PhotoComponentNode';
import { PhotoWireEdge } from './PhotoWireEdge';
import { WiringLog } from './WiringLog';
import { WireInteractionClip } from './WireInteractionClip';
import { ScopePhotoMenu } from '../../scope/ScopePhotoMenu';

const nodeTypes = { photo: PhotoComponentNode };
const edgeTypes = { photoWire: PhotoWireEdge };
const movementKeys = new Set([
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
]);
function Canvas() {
  const interactionClipId = `wire-interactions-${useId().replace(/:/g, '')}`;
  const keyboardMove =
    useRef<ReturnType<typeof useCircuitStore.getState>['dragHistory']>(null);
  const [cursor, setCursor] = useState('crosshair');
  useEffect(() => {
    let live = true;
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 32;
      canvas.height = 96;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const scale = Math.min(32 / image.naturalWidth, 96 / image.naturalHeight);
      ctx.drawImage(
        image,
        0,
        0,
        image.naturalWidth * scale,
        image.naturalHeight * scale,
      );
      if (live) setCursor(`url("${canvas.toDataURL()}") 2 2, crosshair`);
    };
    image.src = componentAssets.screwdriver.src;
    return () => {
      live = false;
    };
  }, []);
  const mode = useCircuitStore((s) => s.mode);
  const finishKeyboardMove = () => {
    const group = keyboardMove.current;
    keyboardMove.current = null;
    if (group && useCircuitStore.getState().dragHistory === group)
      useCircuitStore.getState().finishDrag(group.id, mode);
  };
  const workspace = useCircuitStore((s) => s.workspaces[s.mode]);
  const calibration = useCircuitStore((s) => s.calibration);
  const selectedId = useCircuitStore((s) => s.selectedId);
  const selectedWireId = useCircuitStore((s) => s.selectedWireId);
  const wiringMode = useCircuitStore((s) => s.wiringMode);
  const wireColor = useCircuitStore((s) => s.wireColor);
  const faultWireSignature = useCircuitStore(
    (s) =>
      s.workspaces[s.mode].simulation.faults
        ?.flatMap((f) => f.wireIds)
        .join('|') ?? '',
  );
  const faultWireIds = useMemo(
    () => new Set(faultWireSignature ? faultWireSignature.split('|') : []),
    [faultWireSignature],
  );
  const { fitView, screenToFlowPosition } = useReactFlow<PhotoNode>();
  const nodes: PhotoNode[] = useMemo(
    () =>
      workspace.components.map((component) => {
        const asset = componentAssets[component.assetId];
        return {
          id: component.id,
          ariaLabel: `${component.label} (${component.id})`,
          type: 'photo',
          data: { component },
          position: component.position,
          selected: component.id === selectedId,
          draggable:
            asset.category !== 'board' && !calibration && !workspace.power.on,
          zIndex: asset.category === 'board' ? -1 : 2,
          style: { ...(component.displaySize ?? asset.size) },
        };
      }),
    [workspace.components, workspace.power.on, calibration, selectedId],
  );
  const edges: Edge[] = useMemo(
    () =>
      workspace.wires.map((wire) => ({
        id: wire.id,
        source: wire.from.componentId,
        sourceHandle: wire.from.pinId,
        target: wire.to.componentId,
        targetHandle: wire.to.pinId,
        data: { kind: wire.kind, mode, interactionClipId },
        type: 'photoWire',
        selected: wire.id === selectedWireId,
        zIndex: wire.id === selectedWireId ? 6 : 5,
        className: faultWireIds.has(wire.id) ? 'fault-wire' : undefined,
        style: {
          stroke: faultWireIds.has(wire.id) ? '#ef4444' : wire.color,
          strokeWidth:
            faultWireIds.has(wire.id) || wire.id === selectedWireId ? 4 : 2.5,
        },
        interactionWidth: 18,
      })),
    [workspace.wires, selectedWireId, faultWireIds, mode, interactionClipId],
  );
  useEffect(() => {
    const timeout = window.setTimeout(
      () => void fitView({ padding: 0.12, duration: 220 }),
      60,
    );
    return () => window.clearTimeout(timeout);
  }, [workspace.components.length, fitView]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLElement &&
        (event.target.closest('input, textarea, select, button') ||
          event.target.isContentEditable)
      )
        return;
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        useCircuitStore.getState().deleteSelection();
      }
      if (event.key === 'Escape') {
        useCircuitStore.getState().select(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
  return (
    <div
      onKeyDownCapture={(event) => {
        if (
          !movementKeys.has(event.key) ||
          !(event.target instanceof HTMLElement) ||
          !event.target.matches('.react-flow__node')
        )
          return;
        const s = useCircuitStore.getState();
        const id = event.target.dataset.id;
        const component = s.workspaces[mode].components.find(
          (c) => c.id === id,
        );
        if (
          s.mode !== mode ||
          !component ||
          s.selectedId !== id ||
          componentAssets[component.assetId].category === 'board'
        )
          return;
        if (!s.dragHistory) {
          s.beginDrag(component.id);
          keyboardMove.current = useCircuitStore.getState().dragHistory;
        }
      }}
      onKeyUpCapture={(event) => {
        if (movementKeys.has(event.key)) finishKeyboardMove();
      }}
      onBlurCapture={(event) => {
        if (
          event.target instanceof HTMLElement &&
          event.target.matches('.react-flow__node')
        )
          finishKeyboardMove();
      }}
      style={{ '--screwdriver-cursor': cursor } as React.CSSProperties}
      className={`photo-canvas ${calibration ? 'calibration-canvas' : ''} ${wiringMode && mode === 'sequence' && !workspace.power.on && !calibration ? 'screwdriver-cursor' : ''}`}
    >
      <ReactFlow<PhotoNode>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        connectionMode={ConnectionMode.Loose}
        elevateNodesOnSelect={false}
        onNodesChange={(changes) => {
          if (useCircuitStore.getState().mode !== mode) return;
          for (const change of changes) {
            if (change.type === 'position' && change.position)
              useCircuitStore
                .getState()
                .moveComponent(change.id, change.position);
            if (change.type === 'select' && change.selected)
              useCircuitStore.getState().select(change.id);
          }
        }}
        onNodeDragStart={(_, node) =>
          useCircuitStore.getState().beginDrag(node.id)
        }
        onNodeDragStop={(event, node) => {
          const pointer = 'changedTouches' in event ? event.changedTouches[0] : event;
          const dropPoint = node.data.component.assetId === 'resistor-330' && pointer
            ? screenToFlowPosition({ x: pointer.clientX, y: pointer.clientY }, { snapToGrid: false })
            : undefined;
          useCircuitStore.getState().finishDrag(node.id, mode, dropPoint);
        }}
        onEdgeContextMenu={(event, edge) => {
          event.preventDefault();
          const s = useCircuitStore.getState();
          s.selectWire(edge.id);
          s.deleteSelection();
        }}
        onNodeClick={(_, node) => useCircuitStore.getState().select(node.id)}
        onEdgeClick={(_, edge) =>
          useCircuitStore.getState().selectWire(edge.id)
        }
        onPaneClick={() => useCircuitStore.getState().select(null)}
        onConnect={(c) => {
          if (c.sourceHandle && c.targetHandle)
            useCircuitStore
              .getState()
              .connect(
                { componentId: c.source, pinId: c.sourceHandle },
                { componentId: c.target, pinId: c.targetHandle },
              );
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        }}
        onDrop={(e) => {
          e.preventDefault();
          const assetId = e.dataTransfer.getData('application/x-circuit-asset');
          if (!Object.hasOwn(componentAssets, assetId)) return;
          const asset = componentAssets[assetId as AssetId];
          if (asset.mode !== mode || workspace.power.on || calibration) return;
          const before = useCircuitStore.getState();
          const count = before.workspaces[mode].components.length;
          before.beginDrag('palette');
          const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY }, { snapToGrid: false });
          useCircuitStore.getState().addComponent(
            asset.id,
            {
              x: pos.x - asset.size.width / 2,
              y: pos.y - asset.size.height / 2,
            },
            (e.dataTransfer.getData(
              'application/x-ic-model',
            ) as import('../../../config/ttlModels').IcModel) || undefined,
          );
          const after = useCircuitStore.getState();
          const added = after.workspaces[mode].components.length > count ? after.selectedId : null;
          after.finishDrag(added ?? 'palette');
        }}
        fitView
        fitViewOptions={{ padding: 0.12 }}
        minZoom={0.25}
        maxZoom={3}
        snapToGrid
        snapGrid={[5, 5]}
        connectOnClick
        panOnDrag={[0, 1]}
        selectionOnDrag={false}
        nodesConnectable={!workspace.power.on && !calibration && wiringMode}
        deleteKeyCode={null}
        connectionLineStyle={{ stroke: wireColor, strokeWidth: 2.5 }}
        aria-label={`${mode === 'sequence' ? '시퀀스 제어' : '디지털 회로'} 배선 작업 영역`}
      >
        <WireInteractionClip id={interactionClipId} />
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#ced8d3"
        />
        <Controls showInteractive={false} aria-label="작업대 확대·축소" />
      </ReactFlow>
      {mode === 'digital' && <ScopePhotoMenu />}
      <div className="canvas-stamp">
        <span>
          {mode === 'sequence'
            ? 'SEQUENCE CONTROL BOARD'
            : 'DIGITAL CIRCUIT BOARD'}
        </span>
        <span>DC {workspace.power.voltage}V</span>
      </div>
      {calibration && (
        <div className="calibration-banner">
          <Crosshair size={15} />핀 좌표 디버그 · 이미지를 클릭하면 x%, y%가
          표시됩니다
        </div>
      )}
      <div className="canvas-mode-note">
        {calibration ? (
          <Crosshair size={14} />
        ) : workspace.power.on ? (
          <LockKeyhole size={14} />
        ) : (
          <MousePointer2 size={14} />
        )}
        {calibration
          ? '좌표 확인'
          : workspace.simulation.status === 'error'
            ? '보호 정지 · 오류 배선 삭제 가능'
            : workspace.power.on
              ? '전원 ON · 해석 중'
              : '선택 및 이동'}
      </div>
      <button
        className="fit-board"
        onClick={() => void fitView({ padding: 0.12, duration: 220 })}
      >
        <Maximize size={14} />
        전체 보기
      </button>
    </div>
  );
}

export function PhotoCanvas() {
  const mode = useCircuitStore((s) => s.mode);
  const workspace = useCircuitStore((s) => s.workspaces[s.mode]);
  return (
    <section className="photo-workspace" aria-label="실습 작업 공간">
      <div className="workspace-heading">
        <div>
          <p>YOUR WORKSPACE</p>
          <h1>
            {mode === 'sequence' ? '시퀀스 제어 실습' : '디지털 회로 실습'}
          </h1>
          <span>실제 부품을 배치하고, 나만의 회로를 연결해 보세요.</span>
        </div>
        <span className="practice-badge">
          <span />
          자유 실습
        </span>
      </div>
      <div className="photo-board-shell">
        <div className="photo-board-toolbar">
          <div>
            <span className="board-indicator" />
            {mode === 'sequence' ? '시퀀스 실습 판넬' : '디지털 실습 보드'}
            <span className="board-edit-label">배치 · 배선</span>
          </div>
          <span>
            <b>{workspace.components.length}</b> 부품
            <i />
            <b>{workspace.wires.length}</b> 배선
          </span>
        </div>
        <div className="photo-board-content" key={mode}>
          <ReactFlowProvider>
            <Canvas />
          </ReactFlowProvider>
          <WiringLog mode={mode} />
        </div>
        <div className="photo-board-footer">
          <Cable size={14} />
          <span>
            사진의 나사·단자 클릭 → 다른 나사·단자 클릭 또는 드래그로 배선
          </span>
          <span>선택 후 Delete로 삭제</span>
        </div>
      </div>
      <div className="workspace-footnote">
        <span>휠로 확대·축소 · 빈 공간을 드래그해 이동</span>
        <span>
          {workspace.simulation.nets?.length ?? 0} Nets · DC / TTL 해석
        </span>
      </div>
    </section>
  );
}
