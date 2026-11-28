import { Monitor, Moon, Sun } from 'lucide-react';
import { isThemePreference, useTheme } from '../theme';

export function ThemeControl() {
  const { preference, setPreference } = useTheme();
  const Icon = preference === 'system' ? Monitor : preference === 'dark' ? Moon : Sun;
  return (
    <label className="theme-control">
      <Icon size={17} aria-hidden="true" />
      <span>화면 테마</span>
      <select
        aria-label="화면 테마"
        value={preference}
        onChange={(event) => {
          if (isThemePreference(event.target.value)) setPreference(event.target.value);
        }}
      >
        <option value="light">라이트 모드</option>
        <option value="dark">다크 모드</option>
        <option value="system">시스템 설정</option>
      </select>
    </label>
  );
}
