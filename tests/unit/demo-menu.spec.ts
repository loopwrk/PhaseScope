import { describe, it, expect } from 'vitest';
import { buildDemoMenuItems } from '~/composables/useDemoMenu';

/* The demo menu's structure: how the flat, sorted track list folds into
   rows - group headings, the separator rules around them, and the tracks
   themselves. Group order is the caller's (the manifest's) responsibility;
   this builder only detects group boundaries. */

const track = (id: string, group: string) => ({ id, name: id.toUpperCase(), group });

describe('buildDemoMenuItems', () => {
    it('returns no rows for an empty track list', () => {
        expect(buildDemoMenuItems([])).toEqual([]);
    });

    it('opens a single group with heading + rule, no leading separator', () => {
        const items = buildDemoMenuItems([track('a', 'Fable'), track('b', 'Fable')]);
        expect(items).toEqual([
            { type: 'label', label: 'Fable' },
            { type: 'separator', class: expect.stringContaining('primary') },
            { label: 'A', value: 'a' },
            { label: 'B', value: 'b' },
        ]);
    });

    it('separates consecutive groups with a white rule before each new heading', () => {
        const items = buildDemoMenuItems([track('a', 'Fable'), track('b', 'Field')]);
        const labels = items.filter((i) => 'type' in i && i.type === 'label');
        const separators = items.filter((i) => 'type' in i && i.type === 'separator');
        expect(labels.map((l) => ('label' in l ? l.label : ''))).toEqual(['Fable', 'Field']);
        // red rule under each heading + one white rule between the groups
        expect(separators).toHaveLength(3);
        expect(items[3]).toEqual({ type: 'separator', class: expect.stringContaining('white') });
    });

    it('keeps tracks under their own heading in input order', () => {
        const items = buildDemoMenuItems([track('a', 'One'), track('b', 'Two'), track('c', 'Two')]);
        const rows = items.map((i) => ('value' in i ? i.value : (i as { type: string }).type));
        expect(rows).toEqual(['label', 'separator', 'a', 'separator', 'label', 'separator', 'b', 'c']);
    });

    it('starts a new group even when a group name reappears later (boundary detection only)', () => {
        // The manifest sorts groups contiguously; if a caller ever passes an
        // interleaved list, each boundary still gets its own heading.
        const items = buildDemoMenuItems([track('a', 'One'), track('b', 'Two'), track('c', 'One')]);
        const labels = items.filter((i) => 'type' in i && i.type === 'label');
        expect(labels).toHaveLength(3);
    });
});
