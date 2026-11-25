import type { LogicGate } from '../../types/circuit';
export type LogicBit = 0 | 1 | 'X';
export type LogicNode = {type:'constant';value:0|1}|{type:'variable';name:string}|{type:'not';child:LogicNode}|{type:'binary';op:'&'|'|'|'^';left:LogicNode;right:LogicNode};
export const gateExpressions:Record<LogicGate,string>={AND:'A & B',OR:'A | B',NOT:'!A',NAND:'!(A & B)',NOR:'!(A | B)',XOR:'A ^ B',XNOR:'!(A ^ B)'};
export function parseLogicExpression(source:string):LogicNode {
  if(source.length>300)throw new Error('논리식은 300자 이내로 입력하세요.');
  const tokens=source.replace(/\s/g,'').replace(/[¬~]/g,'!').replace(/[·*]/g,'&').replace(/\+/g,'|').replace(/⊕/g,'^').split('');
  let i=0;
  const unary=():LogicNode=>{
    const token=tokens[i++];
    if(token==='!')return {type:'not',child:unary()};
    if(token==='('){const result=or();if(tokens[i++]!==')')throw new Error('닫는 괄호 )가 필요합니다.');return result;}
    if(token==='0'||token==='1')return {type:'constant',value:Number(token) as 0|1};
    if(token&&/^[A-D]$/.test(token))return {type:'variable',name:token};
    throw new Error('A~D, 0/1, !, &, |, ^, 괄호를 사용하세요.');
  };
  const and=():LogicNode=>{let result=unary();while(tokens[i]==='&'){i++;result={type:'binary',op:'&',left:result,right:unary()};}return result;};
  const xor=():LogicNode=>{let result=and();while(tokens[i]==='^'){i++;result={type:'binary',op:'^',left:result,right:and()};}return result;};
  const or=():LogicNode=>{let result=xor();while(tokens[i]==='|'){i++;result={type:'binary',op:'|',left:result,right:xor()};}return result;};
  if(!tokens.length)throw new Error('논리식을 입력하세요.');
  const tree=or();if(i!==tokens.length)throw new Error('연산자 또는 괄호 위치를 확인하세요.');return tree;
}
export function expressionVariables(node:LogicNode):string[] {
  if(node.type==='variable')return [node.name];
  if(node.type==='constant')return [];
  if(node.type==='not')return expressionVariables(node.child);
  return [...new Set([...expressionVariables(node.left),...expressionVariables(node.right)])].sort();
}
export function evaluateLogic(node:LogicNode,inputs:Record<string,LogicBit>):LogicBit {
  if(node.type==='constant')return node.value;
  if(node.type==='variable')return inputs[node.name]??'X';
  if(node.type==='not'){const value=evaluateLogic(node.child,inputs);return value==='X'?'X':value===0?1:0;}
  const a=evaluateLogic(node.left,inputs),b=evaluateLogic(node.right,inputs);
  if(node.op==='&')return a===0||b===0?0:a===1&&b===1?1:'X';
  if(node.op==='|')return a===1||b===1?1:a===0&&b===0?0:'X';
  return a==='X'||b==='X'?'X':a===b?0:1;
}
export interface TimingEvent {t:number;value:LogicBit}
export function timingEvents(values:readonly LogicBit[],step:number,delay=0):TimingEvent[] {
  const events:TimingEvent[]=delay>0?[{t:0,value:'X'}]:[];
  values.forEach((value,i)=>{if(!events.length||events.at(-1)!.value!==value)events.push({t:i*step+delay,value});});
  return events;
}
export function timingValue(events:readonly TimingEvent[],t:number):LogicBit {
  let value:LogicBit='X';for(const event of events){if(event.t>t)break;value=event.value;}return value;
}
