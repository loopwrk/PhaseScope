import { createSketch, duplicateName, type Sketch, type SketchSeed } from '~/utils/sketch/model';

export function useSketchStore() {
    const sketches = usePersistedState<Sketch[]>('sketch:library', () => []);

    function get(id: string): Sketch | undefined {
        return sketches.value.find((s) => s.id === id);
    }

    function create(seed: Omit<SketchSeed, 'id' | 'now'> = {}): Sketch {
        const sketch = createSketch({ id: crypto.randomUUID(), now: Date.now(), ...seed });
        sketches.value = [sketch, ...sketches.value];
        return sketch;
    }

    function update(id: string, patch: Partial<Omit<Sketch, 'id' | 'createdAt'>>): void {
        sketches.value = sketches.value.map((s) => (s.id === id ? { ...s, ...patch, updatedAt: Date.now() } : s));
    }

    function rename(id: string, name: string): void {
        update(id, { name: name.trim() || 'untitled' });
    }

    function duplicate(id: string): Sketch | undefined {
        const source = get(id);
        if (!source) return undefined;
        const now = Date.now();
        const copy: Sketch = {
            ...source,
            tabs: { ...source.tabs },
            id: crypto.randomUUID(),
            name: duplicateName(
                source.name,
                sketches.value.map((s) => s.name)
            ),
            createdAt: now,
            updatedAt: now,
        };
        sketches.value = [copy, ...sketches.value];
        return copy;
    }

    function remove(id: string): void {
        sketches.value = sketches.value.filter((s) => s.id !== id);
    }

    return { sketches, get, create, update, rename, duplicate, remove };
}
