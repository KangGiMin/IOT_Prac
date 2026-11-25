import { describe, expect, it } from 'vitest';
import { grayOrder, minimizeKMap, validateKGroup } from './kmap';
import type { KValue } from './kmap';
describe('Karnaugh mapping and exact cover',()=>{
  it('orders two-bit axes in Gray code and accepts wrapping corners',()=>{
    expect(grayOrder(2)).toEqual([0,1,3,2]);
    const values=Array.from({length:16},(_,i)=>[0,2,8,10].includes(i)?1:0) as KValue[];
    const group=validateKGroup([0,2,8,10],values,4,'sop');
    expect(group.error).toBeUndefined();expect(group.group!.term).toBe('¬B·¬D');
    const answer=minimizeKMap(values,4);expect(answer.groups).toHaveLength(1);expect(answer.expression).toBe('¬B·¬D');
  });
  it('rejects diagonals, L shapes, mixed output and X-only groups',()=>{
    expect(validateKGroup([0,3],[1,0,0,1],2,'sop').error).toContain('대각선');
    expect(validateKGroup([0,1,2],[1,1,1,0],2,'sop').error).toContain('거듭제곱');
    expect(validateKGroup([0,1],[1,0,1,0],2,'sop').error).toContain('1과 X');
    expect(validateKGroup([0,1],['X','X',0,0],2,'sop').error).toContain('X만');
  });
  it('uses optional dont-cares and forms the dual POS expression',()=>{
    expect(minimizeKMap([1,'X',0,0,1,'X',0,0],3).expression).toBe('¬B');
    expect(minimizeKMap([0,1,1,1],2,'pos').expression).toBe('(A + B)');
    expect(minimizeKMap([0,0,0,0],2).expression).toBe('0');
    expect(minimizeKMap([1,1,1,1],2).expression).toBe('1');
  });
  it('preserves every truth table for all 2- and 3-variable functions in both forms',()=>{
    for(const n of [2,3])for(let fn=0;fn<2**(2**n);fn++){
      const values=Array.from({length:2**n},(_,i)=>(fn>>i)&1) as KValue[];
      for(const mode of ['sop','pos'] as const){
        const result=minimizeKMap(values,n,mode);
        for(let i=0;i<values.length;i++){
          const covered=result.groups.some(g=>g.cells.includes(i));
          expect(mode==='sop'?Number(covered):Number(!covered)).toBe(values[i]);
        }
      }
    }
  });
  it('preserves specified values in varied 4-variable functions with dont-cares',()=>{
    let seed=123;
    for(let fn=0;fn<80;fn++){
      const values=Array.from({length:16},()=>{seed=(seed*1664525+1013904223)>>>0;return ([0,1,'X'] as const)[seed%3];});
      for(const mode of ['sop','pos'] as const){const result=minimizeKMap(values,4,mode);for(let i=0;i<16;i++)if(values[i]!=='X')expect(mode==='sop'?Number(result.groups.some(g=>g.cells.includes(i))):Number(!result.groups.some(g=>g.cells.includes(i)))).toBe(values[i]);}
    }
  });
});
