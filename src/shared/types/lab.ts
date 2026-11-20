import type { Edge, Node } from "@xyflow/react";

export type LabId = "sequence" | "breadboard" | "theory";
export type CircuitLabId = Exclude<LabId, "theory">;
export type ComponentKind =
  | "supply"
  | "stop"
  | "start"
  | "relay"
  | "lamp"
  | "timer"
  | "ic"
  | "resistor"
  | "led"
  | "logic";
export type ComponentData = {
  kind: ComponentKind;
  label: string;
  code: string;
  detail: string;
};
export type ComponentNode = Node<ComponentData, "component">;
export interface Circuit {
  nodes: ComponentNode[];
  edges: Edge[];
}
export interface CatalogItem extends ComponentData {
  description: string;
}
