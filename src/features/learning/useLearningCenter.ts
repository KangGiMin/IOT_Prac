import { create } from 'zustand';
export type LessonTab = 'scope' | 'kmap' | 'timing';
export const useLearningCenter = create<{
  tab:LessonTab;scopeId:string|null;scopeChannel:'ch1'|'ch2';
  setTab:(tab:LessonTab)=>void;openScope:(id:string)=>void;setChannel:(id:'ch1'|'ch2')=>void;
}>(set=>({tab:'scope',scopeId:null,scopeChannel:'ch1',setTab:tab=>set({tab}),setChannel:scopeChannel=>set({scopeChannel}),
  openScope:scopeId=>{set({tab:'scope',scopeId});document.getElementById('learning-center')?.scrollIntoView({behavior:'smooth',block:'start'});},
}));
