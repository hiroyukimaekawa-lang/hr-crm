export interface PinnedStudent {
  id: number;
  name: string;
}

const KEY = 'pinned_student';
const EVT = 'pinned-student-updated';

export const getPinnedStudent = (): PinnedStudent | null => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.id !== 'number') return null;
    return { id: parsed.id, name: String(parsed.name || '') };
  } catch {
    return null;
  }
};

export const setPinnedStudent = (value: PinnedStudent) => {
  localStorage.setItem(KEY, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent(EVT));
};

export const clearPinnedStudent = () => {
  localStorage.removeItem(KEY);
  window.dispatchEvent(new CustomEvent(EVT));
};

export const pinnedStudentEventName = EVT;

