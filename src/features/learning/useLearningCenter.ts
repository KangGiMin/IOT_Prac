import { create } from 'zustand';
import type { ScopeChannelId } from '../scope/model';
import type { ScopeMenu, ScopeMetric } from '../scope/scopeActions';
export type LessonTab = 'scope' | 'kmap' | 'timing';
export const useLearningCenter = create<{
  tab:LessonTab;scopeId:string|null;scopeChannels:Record<string, ScopeChannelId>;
  photoMenu:{id:string; menu:ScopeMenu}|null; photoMetric:ScopeMetric;
  setTab:(tab:LessonTab)=>void;openScope:(id:string)=>void;setChannel:(id:string, channel:ScopeChannelId)=>void;
  showPhotoMenu:(id:string,menu:ScopeMenu)=>void;closePhotoMenu:()=>void;setPhotoMetric:(photoMetric:ScopeMetric)=>void;
}>(set=>({tab:'scope',scopeId:null,scopeChannels:{},photoMenu:null,photoMetric:'vpp',setTab:tab=>set({tab}),
  setChannel:(id,channel)=>set(s=>({scopeChannels:{...s.scopeChannels,[id]:channel}})),
  showPhotoMenu:(id,menu)=>set({photoMenu:{id,menu},scopeId:id}),
  closePhotoMenu:()=>set({photoMenu:null}),setPhotoMetric:photoMetric=>set({photoMetric}),
  openScope:scopeId=>{set({tab:'scope',scopeId,photoMenu:null});document.getElementById('learning-center')?.scrollIntoView({behavior:'smooth',block:'start'});},
}));
