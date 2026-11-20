import { create } from "zustand";

export type Lesson = "kmap" | "scope" | "logic";
interface TheoryState {
  lesson: Lesson;
  cells: boolean[];
  setLesson: (lesson: Lesson) => void;
  toggleCell: (index: number) => void;
}
export const useTheoryStore = create<TheoryState>()((set) => ({
  lesson: "kmap",
  cells: [false, true, false, true],
  setLesson: (lesson) => set({ lesson }),
  toggleCell: (index) =>
    set((s) => ({
      cells: s.cells.map((value, i) => (i === index ? !value : value)),
    })),
}));
