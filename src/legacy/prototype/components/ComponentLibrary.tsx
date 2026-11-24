import { useState } from 'react';
import { BookOpen, Plus, Search, Shapes } from 'lucide-react';
import { catalog } from '../data/catalog';
import { usePrototypeLabStore } from '../store/usePrototypeLabStore';
import { ComponentSymbol } from './ComponentSymbol';
import type { CircuitLabId } from '../types';

export function ComponentLibrary({ lab }: { lab: CircuitLabId }) {
  const [query, setQuery] = useState('');
  const powerOn = usePrototypeLabStore((s) => s.powerOn);
  const addComponent = usePrototypeLabStore((s) => s.addComponent);
  const items = catalog[lab].filter((item) =>
    `${item.label} ${item.detail} ${item.description}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <aside className="component-library">
      <div className="sidebar-title">
        <Shapes size={18} />
        <h2>부품 라이브러리</h2>
        <span>{catalog[lab].length}</span>
      </div>
      <label className="search-field">
        <Search size={16} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="부품 검색"
          aria-label="부품 검색"
        />
      </label>
      <div className="library-category">
        {lab === 'sequence' ? '제어 부품' : '디지털 소자'}
        <span>클릭하여 추가</span>
      </div>
      <div className="component-list">
        {items.map((item) => (
          <button
            key={item.label}
            className="component-card"
            disabled={powerOn}
            onClick={() => addComponent(lab, item)}
            title={
              powerOn ? '전원을 끄고 부품을 추가하세요' : `${item.label} 추가`
            }
          >
            <div className={`component-icon kind-${item.kind}`}>
              <ComponentSymbol kind={item.kind} />
            </div>
            <div>
              <strong>{item.label}</strong>
              <small>{item.detail}</small>
            </div>
            <Plus size={15} className="add-icon" />
          </button>
        ))}
        {items.length === 0 && (
          <p className="empty-search">검색한 부품이 없습니다.</p>
        )}
      </div>
      <div className="library-help">
        <BookOpen size={18} />
        <strong>처음 실습하시나요?</strong>
        <p>
          부품을 추가하고 단자를 연결해
          <br />
          나만의 회로를 구성해 보세요.
        </p>
        <button
          onClick={() => usePrototypeLabStore.getState().setGuideOpen(true)}
        >
          실습 가이드 보기
        </button>
      </div>
    </aside>
  );
}
