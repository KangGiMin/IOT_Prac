export type KValue = 0 | 1 | 'X';
export type KMode = 'sop' | 'pos';
export interface KGroup {
  cells: number[];
  mask: number;
  pattern: string;
  term: string;
  literals: number;
}
export const grayOrder = (bits: number) =>
  Array.from({ length: 2 ** bits }, (_, i) => i ^ (i >> 1));
export function mapLayout(variables: number) {
  const rowBits = Math.floor(variables / 2),
    colBits = variables - rowBits;
  return { rowBits, colBits, rows: grayOrder(rowBits), cols: grayOrder(colBits) };
}
export function groupTerm(cells: number[], variables: number, mode: KMode): KGroup {
  const pattern = Array.from({ length: variables }, (_, bit) => {
    const values = new Set(cells.map((index) => (index >> (variables - bit - 1)) & 1));
    return values.size === 1 ? String([...values][0]) : '-';
  }).join('');
  const literals = [...pattern].flatMap((bit, i) =>
    bit === '-' ? [] : [`${(mode === 'sop' ? bit === '0' : bit === '1') ? '¬' : ''}${'ABCD'[i]}`],
  );
  return {
    cells: [...cells].sort((a, b) => a - b),
    mask: cells.reduce((mask, i) => mask | (1 << i), 0),
    pattern,
    term: literals.length
      ? mode === 'sop'
        ? literals.join('·')
        : `(${literals.join(' + ')})`
      : mode === 'sop'
        ? '1'
        : '0',
    literals: literals.length,
  };
}
function rectangles(variables: number, mode: KMode) {
  const { rows, cols, colBits } = mapLayout(variables),
    groups = new Map<number, KGroup>();
  for (let height = 1; height <= rows.length; height *= 2)
    for (let width = 1; width <= cols.length; width *= 2)
      for (let y = 0; y < rows.length; y++)
        for (let x = 0; x < cols.length; x++) {
          const cells: number[] = [];
          for (let dy = 0; dy < height; dy++)
            for (let dx = 0; dx < width; dx++)
              cells.push((rows[(y + dy) % rows.length] << colBits) | cols[(x + dx) % cols.length]);
          const group = groupTerm(cells, variables, mode);
          groups.set(group.mask, group);
        }
  return [...groups.values()];
}
export function validateKGroup(
  cells: number[],
  values: readonly KValue[],
  variables: number,
  mode: KMode,
): { group?: KGroup; error?: string } {
  const unique = [...new Set(cells)];
  if (!unique.length) return { error: '묶을 칸을 선택하세요.' };
  if (unique.some((i) => !Number.isInteger(i) || i < 0 || i >= values.length))
    return { error: '맵 밖의 칸이 포함되어 있습니다.' };
  if ((unique.length & (unique.length - 1)) !== 0)
    return { error: '묶음 크기는 1·2·4·8·16처럼 2의 거듭제곱이어야 합니다.' };
  const target = mode === 'sop' ? 1 : 0;
  if (unique.some((i) => values[i] !== target && values[i] !== 'X'))
    return { error: `${mode.toUpperCase()}에서는 ${target}과 X만 묶을 수 있습니다.` };
  if (!unique.some((i) => values[i] === target))
    return { error: 'X만으로 만든 묶음은 필요하지 않습니다. 실제 출력 칸을 포함하세요.' };
  const mask = unique.reduce((m, i) => m | (1 << i), 0);
  const group = rectangles(variables, mode).find((g) => g.mask === mask);
  return group
    ? { group }
    : { error: '대각선·L자 묶음은 안 됩니다. 가장자리 연결을 포함한 직사각형으로 선택하세요.' };
}
export function combineTerms(groups: readonly KGroup[], mode: KMode) {
  if (!groups.length) return mode === 'sop' ? '0' : '1';
  if (groups.some((g) => g.literals === 0)) return mode === 'sop' ? '1' : '0';
  return groups.map((g) => g.term).join(mode === 'sop' ? ' + ' : ' · ');
}
/** Exact cover for up to four variables: fewest terms, then fewest literals. */
export function minimizeKMap(values: readonly KValue[], variables: number, mode: KMode = 'sop') {
  if (![2, 3, 4].includes(variables) || values.length !== 2 ** variables)
    throw new Error('2~4변수 맵이 필요합니다.');
  const target = mode === 'sop' ? 1 : 0;
  const needed = values.reduce<number>((mask, v, i) => (v === target ? mask | (1 << i) : mask), 0);
  if (!needed)
    return { groups: [] as KGroup[], expression: mode === 'sop' ? '0' : '1', literals: 0 };
  const valid = rectangles(variables, mode).filter(
    (g) =>
      (g.mask & needed) !== 0 && g.cells.every((i) => values[i] === target || values[i] === 'X'),
  );
  const primes = valid.filter(
    (g) =>
      !valid.some(
        (other) => other.cells.length > g.cells.length && (g.mask & other.mask) === g.mask,
      ),
  );
  const memo = new Map<number, KGroup[]>();
  const cost = (groups: KGroup[]) => groups.reduce((sum, g) => sum + g.literals, 0);
  const solve = (covered: number): KGroup[] => {
    covered &= needed;
    if (covered === needed) return [];
    const cached = memo.get(covered);
    if (cached) return cached;
    const first = Array.from({ length: values.length }, (_, i) => 1 << i).find(
      (bit) => needed & bit && !(covered & bit),
    )!;
    let best: KGroup[] | undefined;
    for (const group of primes.filter((g) => (g.mask & first) !== 0)) {
      const answer = [group, ...solve(covered | group.mask)];
      if (
        !best ||
        answer.length < best.length ||
        (answer.length === best.length && cost(answer) < cost(best))
      )
        best = answer;
    }
    memo.set(covered, best!);
    return best!;
  };
  const groups = solve(0);
  return { groups, expression: combineTerms(groups, mode), literals: cost(groups) };
}
