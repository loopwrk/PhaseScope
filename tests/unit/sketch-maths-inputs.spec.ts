// @vitest-environment nuxt
import { describe, it, expect, vi } from 'vitest';
import katex from 'katex';
import { mountParamInputs } from '~/utils/sketch/maths-inputs';
import { extractParams, tagParamValues } from '~/utils/sketch/params';

const PREFIX = 'v0';
const TEX = 'A = 0.4, \\qquad f = 220';

function mount(tex = TEX, commit = vi.fn()) {
    const host = document.createElement('div');
    host.innerHTML = katex.renderToString(tagParamValues(tex, PREFIX), {
        displayMode: true,
        throwOnError: false,
        trust: (context: { command: string }) => context.command === '\\htmlId',
        strict: (code: string) => (code === 'htmlExtension' ? 'ignore' : 'warn'),
    });
    mountParamInputs(host, extractParams(tex), PREFIX, { commit });
    return { host, commit, inputs: [...host.querySelectorAll('input')] as HTMLInputElement[] };
}

describe('mountParamInputs', () => {
    it('puts one input per assignment, carrying its current value', () => {
        const { inputs } = mount();
        expect(inputs.map((i) => i.value)).toEqual(['0.4', '220']);
        expect(inputs.map((i) => i.getAttribute('aria-label'))).toEqual(['Parameter A', 'Parameter f']);
    });

    it('replaces the rendered literal rather than sitting beside it', () => {
        const { host } = mount();
        const slot = host.querySelector(`[id="${PREFIX}-param-A"]`)!;
        expect(slot.children).toHaveLength(1);
        expect(slot.textContent).toBe('');
    });

    it('commits a parsed number on change', () => {
        const { inputs, commit } = mount();
        inputs[1]!.value = '440';
        inputs[1]!.dispatchEvent(new Event('change'));
        expect(commit).toHaveBeenCalledWith('f', 440);
    });

    it('rejects junk and restores the previous value', () => {
        const { inputs, commit } = mount();
        inputs[0]!.value = 'not a number';
        inputs[0]!.dispatchEvent(new Event('change'));
        expect(commit).not.toHaveBeenCalled();
        expect(inputs[0]!.value).toBe('0.4');
    });

    it('rejects an emptied field', () => {
        const { inputs, commit } = mount();
        inputs[0]!.value = '   ';
        inputs[0]!.dispatchEvent(new Event('change'));
        expect(commit).not.toHaveBeenCalled();
        expect(inputs[0]!.value).toBe('0.4');
    });

    it('accepts negatives and decimals', () => {
        const { inputs, commit } = mount();
        inputs[0]!.value = '-2.75';
        inputs[0]!.dispatchEvent(new Event('change'));
        expect(commit).toHaveBeenCalledWith('A', -2.75);
    });

    it('does nothing when the equation has no assignments', () => {
        const { inputs } = mount('x[n] = A \\cos(2 \\pi f n T)');
        expect(inputs).toHaveLength(0);
    });
});

describe('mountParamInputs - dragging', () => {
    function pointer(type: string, props: Record<string, unknown> = {}): Event {
        return Object.assign(new Event(type, { bubbles: true, cancelable: true }), {
            button: 0,
            clientY: 0,
            pointerId: 1,
            ...props,
        });
    }

    it('scrubs the value and brackets the drag so the caller can hold its re-render', () => {
        const commit = vi.fn();
        const onScrubStart = vi.fn();
        const onScrubEnd = vi.fn();
        const host = document.createElement('div');
        host.innerHTML = katex.renderToString(tagParamValues(TEX, PREFIX), {
            displayMode: true,
            throwOnError: false,
            trust: (context: { command: string }) => context.command === '\\htmlId',
            strict: (code: string) => (code === 'htmlExtension' ? 'ignore' : 'warn'),
        });
        mountParamInputs(host, extractParams(TEX), PREFIX, { commit, onScrubStart, onScrubEnd });

        const field = host.querySelectorAll('input')[1] as HTMLInputElement; // f = 220
        field.dispatchEvent(pointer('pointerdown', { clientY: 200 }));
        field.dispatchEvent(pointer('pointermove', { clientY: 180 }));

        expect(onScrubStart).toHaveBeenCalledOnce();
        /* 20px up is 5 steps, and the step for 220 is 10 */
        expect(commit).toHaveBeenLastCalledWith('f', 270);
        /* the field shows the dragged value straight away - the equation
           itself is frozen for the length of the gesture */
        expect(field.value).toBe('270');

        field.dispatchEvent(pointer('pointerup', { clientY: 180 }));
        expect(onScrubEnd).toHaveBeenCalledOnce();
    });

    it('does not commit for a press that never moves', () => {
        const commit = vi.fn();
        const { inputs } = mount(TEX, commit);
        inputs[0]!.dispatchEvent(pointer('pointerdown', { clientY: 200 }));
        inputs[0]!.dispatchEvent(pointer('pointerup', { clientY: 200 }));
        expect(commit).not.toHaveBeenCalled();
    });
});

describe('mountParamInputs - locked', () => {
    it('shows a locked value but refuses to change it', () => {
        const commit = vi.fn();
        const host = document.createElement('div');
        host.innerHTML = katex.renderToString(tagParamValues(TEX, PREFIX), {
            displayMode: true,
            throwOnError: false,
            trust: (context: { command: string }) => context.command === '\\htmlId',
            strict: (code: string) => (code === 'htmlExtension' ? 'ignore' : 'warn'),
        });
        mountParamInputs(host, extractParams(TEX), PREFIX, { commit, locked: ['f'] });

        const [amp, freq] = [...host.querySelectorAll('input')] as HTMLInputElement[];
        expect(freq!.disabled).toBe(true);
        expect(freq!.value).toBe('220');
        expect(freq!.title).toBe('Locked while playing');

        freq!.value = '900';
        freq!.dispatchEvent(new Event('change'));
        expect(commit).not.toHaveBeenCalled();

        /* everything else stays live */
        expect(amp!.disabled).toBe(false);
        amp!.value = '0.9';
        amp!.dispatchEvent(new Event('change'));
        expect(commit).toHaveBeenCalledWith('A', 0.9);
    });

    it('leaves every field editable when nothing is locked', () => {
        const { inputs } = mount();
        expect(inputs.every((i) => !i.disabled)).toBe(true);
    });
});
