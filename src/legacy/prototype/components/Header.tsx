import { CircuitBoard, FlaskConical } from 'lucide-react';
import { usePrototypeLabStore } from '../store/usePrototypeLabStore';
import { labs } from '../labs';

export function Header() {
  const activeLab = usePrototypeLabStore((s) => s.activeLab);
  const setActiveLab = usePrototypeLabStore((s) => s.setActiveLab);
  return (
    <header className="app-header">
      <div className="brand">
        <span className="brand-icon">
          <CircuitBoard size={25} />
        </span>
        <div>
          <strong>
            CIRCUIT<span>LAB</span>
          </strong>
          <small>가상 전자공학 실습실</small>
        </div>
      </div>
      <nav className="main-tabs" role="tablist" aria-label="실습실 선택">
        {labs.map(({ id, label, shortLabel, icon: Icon }, index) => (
          <button
            key={id}
            role="tab"
            id={`tab-${id}`}
            aria-selected={activeLab === id}
            aria-controls={`panel-${id}`}
            tabIndex={activeLab === id ? 0 : -1}
            onClick={() => setActiveLab(id)}
            onKeyDown={(event) => {
              let target = index;
              if (event.key === 'ArrowRight') target = (index + 1) % labs.length;
              else if (event.key === 'ArrowLeft') target = (index + labs.length - 1) % labs.length;
              else if (event.key === 'Home') target = 0;
              else if (event.key === 'End') target = labs.length - 1;
              else return;
              event.preventDefault();
              setActiveLab(labs[target].id);
              document.getElementById(`tab-${labs[target].id}`)?.focus();
            }}
          >
            <Icon size={18} />
            <span className="tab-label-full">{label}</span>
            <span className="tab-label-short">{shortLabel}</span>
          </button>
        ))}
      </nav>
      <span className="header-tag">
        <FlaskConical size={15} />
        ENGINEERING LAB
      </span>
    </header>
  );
}
