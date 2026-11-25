import { describe, expect, it } from 'vitest';
import { evaluateLogic, expressionVariables, gateExpressions, parseLogicExpression, timingEvents, timingValue } from './timing';
import { logicMissions } from '../workbench/data/logicMissions';
describe('logic timing calculations',()=>{
  it.each(logicMissions)('matches every $id truth row',mission=>{
    const tree=parseLogicExpression(gateExpressions[mission.id]);
    for(const row of mission.truthTable)expect(evaluateLogic(tree,{A:row.a,B:row.b??0})).toBe(row.output);
  });
  it('honors precedence, parentheses and all four custom inputs without eval',()=>{
    const tree=parseLogicExpression('!(A & B) | C ^ D');
    expect(expressionVariables(tree)).toEqual(['A','B','C','D']);
    expect(evaluateLogic(tree,{A:1,B:1,C:1,D:0})).toBe(1);
    expect(evaluateLogic(parseLogicExpression('A | B & C'),{A:1,B:0,C:0})).toBe(1);
    for(const bad of ['A || B','alert(1)','A & (B','A B',''])expect(()=>parseLogicExpression(bad)).toThrow();
  });
  it('propagates only logically undetermined X values',()=>{
    expect(evaluateLogic(parseLogicExpression('A & B'),{A:0,B:'X'})).toBe(0);
    expect(evaluateLogic(parseLogicExpression('A | B'),{A:1,B:'X'})).toBe(1);
    expect(evaluateLogic(parseLogicExpression('A ^ B'),{A:1,B:'X'})).toBe('X');
  });
  it('shifts output transitions and retains the unknown initial interval',()=>{
    const events=timingEvents([0,1,1,0],1,.5);
    expect(events).toEqual([{t:0,value:'X'},{t:.5,value:0},{t:1.5,value:1},{t:3.5,value:0}]);
    expect(timingValue(events,.25)).toBe('X');expect(timingValue(events,1.4)).toBe(0);expect(timingValue(events,1.5)).toBe(1);
  });
});
