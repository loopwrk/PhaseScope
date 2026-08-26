/* Inline param inputs for the equation above the canvas.

   tagParamValues() leaves a \htmlId slot around each assignment's
   numeric literal; this swaps that literal for a real input so the
   number in the equation is the control, not a readout of one. Commits
   go back through the maths source, which is what keeps the equation,
   the PARAMS bar and the next RUN reading the same value.

   Typing commits on `change` (blur or enter), never per keystroke: every
   commit re-renders the whole KaTeX block, so committing as you type
   would pull the field out from under the caret. Dragging is the
   exception - it commits continuously, so the canvas follows the value
   under the pointer, and asks the caller to hold the re-render until the
   drag ends. */

import { attachNumberScrub } from './number-scrub';
import { paramValueId, type SketchParam } from './params';

export interface ParamInputOptions {
    commit: (name: string, value: number) => void;
    /* Parameter names that cannot be edited right now. A locked field still
       shows its value - it just refuses to change it. */
    locked?: readonly string[];
    /* Bracket a drag so the caller can hold off re-rendering the equation
       - re-rendering mid-drag would destroy the element being dragged. */
    onScrubStart?: () => void;
    onScrubEnd?: () => void;
}

/* Enough room for the digits plus a little breathing space, so the
   field reads as a field without dwarfing a two-character value. */
function fieldWidth(value: string): string {
    return `${Math.max(2, value.length) + 1}ch`;
}

export function mountParamInputs(
    root: ParentNode,
    params: readonly SketchParam[],
    idPrefix: string,
    options: ParamInputOptions
): void {
    for (const param of params) {
        /* Attribute selector, not #id - the prefix comes from useId() and
           needn't be a bare CSS identifier. */
        const slot = root.querySelector(`[id="${paramValueId(idPrefix, param.name)}"]`);
        if (!slot) continue;

        const printed = String(param.value);
        const input = document.createElement('input');
        /* The field is written to from three directions - typing, dragging
           and arrow keys - so keep text and width in one place. */
        const show = (value: number) => {
            input.value = String(value);
            input.style.width = fieldWidth(input.value);
        };
        input.type = 'text';
        input.inputMode = 'decimal';
        input.className = 'sketch-param-input';
        input.value = printed;
        input.style.width = fieldWidth(printed);
        input.setAttribute('aria-label', `Parameter ${param.name}`);

        if (options.locked?.includes(param.name)) {
            input.disabled = true;
            input.title = 'Locked while playing';
            slot.replaceChildren(input);
            continue;
        }

        input.addEventListener('change', () => {
            const next = Number(input.value.trim());
            /* Junk never reaches the source - put the old value back so the
               field can't sit there disagreeing with the equation. */
            if (input.value.trim() === '' || !Number.isFinite(next)) {
                input.value = printed;
                input.style.width = fieldWidth(printed);
                return;
            }
            show(next);
            options.commit(param.name, next);
        });
        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') input.blur();
            if (event.key === 'Escape') {
                input.value = printed;
                input.blur();
            }
        });

        /* Drag up/down on the number to scrub it. Writes straight through
           on every step - the equation is held from re-rendering until the
           drag ends, so this element survives the whole gesture. */
        attachNumberScrub(input, {
            read: () => {
                const current = Number(input.value);
                return Number.isFinite(current) ? current : param.value;
            },
            write: (value) => {
                show(value);
                options.commit(param.name, value);
            },
            onStart: options.onScrubStart,
            onEnd: options.onScrubEnd,
        });

        slot.replaceChildren(input);
    }
}
