import type { ComponentAsset } from '../../../types/circuit';
import type { IcModel } from '../../../config/ttlModels';
import { IC_MODELS, TTL_MODELS } from '../../../config/ttlModels';
import { useState } from 'react';
import { Cable, GripVertical, Layers, Plus, Search } from 'lucide-react';
import { componentAssets, jumperCableAsset } from '../../../config/assets';
import { useCircuitStore } from '../../../store/usePhotoCircuitStore';
import { AssetImage } from './AssetImage';

export function PhotoPalette() {
  const [query, setQuery] = useState('');
  const [jumperFailed, setJumperFailed] = useState(false);
  const jumperSelected = useCircuitStore((s) => s.wireKind === 'jumper' && s.wiringMode);
  const mode = useCircuitStore((s) => s.mode);
  const locked = useCircuitStore((s) => s.workspaces[s.mode].power.on || s.calibration);
  const items = Object.values(componentAssets)
    .flatMap<ComponentAsset & { ic?: IcModel }>((a) =>
      a.id === 'ic-dip14'
        ? IC_MODELS.map((ic) => ({
            ...a,
            ic,
            label: ic,
            model: TTL_MODELS[ic].name,
          }))
        : [{ ...a, ic: undefined }],
    )
    .filter(
      (a) => a.mode === mode && `${a.label} ${a.model}`.toLowerCase().includes(query.toLowerCase()),
    );
  return (
    <aside className="photo-palette" aria-label="부품 팔레트">
      <div className="panel-heading">
        <Layers size={17} />
        <h2>부품 라이브러리</h2>
        <span>{Object.values(componentAssets).filter((a) => a.mode === mode).length}</span>
      </div>
      <p className="panel-description">클릭하거나 보드로 드래그하세요</p>
      <label className="palette-search">
        <Search size={16} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="부품 검색"
          aria-label="부품 검색"
        />
      </label>
      <div className="palette-category">
        {mode === 'sequence' ? '시퀀스 제어 부품' : '디지털 회로 부품'}
        <span>PNG ASSETS</span>
      </div>
      <div className="photo-palette-list">
        {items.map((asset) => (
          <button
            key={asset.id + (asset.ic ?? '')}
            className="photo-palette-card"
            draggable={!locked}
            disabled={locked}
            title={`${asset.label} 추가`}
            aria-label={`${asset.label} 추가`}
            onClick={() => useCircuitStore.getState().addComponent(asset.id, undefined, asset.ic)}
            onDragStart={(e) => {
              e.dataTransfer.setData('application/x-circuit-asset', asset.id);
              if (asset.ic) e.dataTransfer.setData('application/x-ic-model', asset.ic);
              e.dataTransfer.effectAllowed = 'copy';
            }}
          >
            <span className="palette-grip">
              <GripVertical size={12} />
            </span>
            <span className="photo-thumbnail">
              <AssetImage asset={asset} thumbnail />
            </span>
            <span className="palette-card-text">
              <strong>{asset.label}</strong>
              <small>{asset.model}</small>
            </span>
            <Plus size={14} />
          </button>
        ))}
        {items.length === 0 && <p className="palette-empty">검색 결과가 없습니다.</p>}
      </div>
      {mode === 'digital' && (
        <section className="wire-photo-tools">
          <h3>배선 도구</h3>
          <button
            className="photo-palette-card"
            disabled={locked}
            aria-pressed={jumperSelected}
            onClick={() => {
              const s = useCircuitStore.getState();
              s.setWireKind('jumper');
              s.setWiringMode(true);
            }}
          >
            <span className="photo-thumbnail">
              {jumperFailed ? (
                <Cable size={24} />
              ) : (
                <img
                  className="asset-photo"
                  src={jumperCableAsset.src}
                  alt="점퍼 케이블"
                  onError={() => setJumperFailed(true)}
                />
              )}
            </span>
            <span className="palette-card-text">
              <strong>점퍼 케이블</strong>
              <small>단자 사이를 드래그해 배선</small>
            </span>
          </button>
        </section>
      )}
      <div className="asset-guide">
        <strong>연결하며 익히는 회로 실습</strong>
        <p>
          부품을 배치한 뒤 단자 두 개를
          <br />
          차례로 클릭해 연결하세요.
        </p>
      </div>
    </aside>
  );
}
