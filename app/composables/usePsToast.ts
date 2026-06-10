import { useToast } from '@nuxt/ui/composables';

/* usePsToast - branded wrapper over Nuxt UI's useToast. Each kind maps to a
   Nuxt UI colour + glyph, and the toast is skinned to the PhaseScope look:
   a notch silhouette, a coloured status rail down the left edge, a mono
   uppercase title, and the kind's icon. Toasts render in <UApp>'s toaster.

   Usage:  const { show } = usePsToast(); show('success', 'Track loaded'); */

type Kind = 'info' | 'success' | 'warning' | 'error' | 'live';
type UiColor = 'info' | 'success' | 'warning' | 'error' | 'primary';

const KIND: Record<Kind, { color: UiColor; icon: string; rail: string }> = {
    info: { color: 'info', icon: 'i-lucide-info', rail: 'border-(--info)' },
    success: { color: 'success', icon: 'i-lucide-check', rail: 'border-(--success)' },
    warning: { color: 'warning', icon: 'i-lucide-triangle-alert', rail: 'border-(--warning)' },
    error: { color: 'error', icon: 'i-lucide-x', rail: 'border-(--error)' },
    live: { color: 'primary', icon: 'i-lucide-radio', rail: 'border-(--scope-magenta)' },
};

export function usePsToast() {
    const toast = useToast();

    function show(kind: Kind, title: string, description?: string) {
        const k = KIND[kind];
        return toast.add({
            title,
            description,
            color: k.color,
            icon: k.icon,
            ui: {
                root: `rounded-none border-l-2 [clip-path:var(--clip-notch)] bg-(--surface-elevated) ${k.rail}`,
                title: 'font-mono uppercase tracking-label text-(--text)',
                description: 'text-(--text-muted)',
                icon: kind === 'live' ? 'text-(--scope-magenta)' : '',
            },
        });
    }

    return { show, toast };
}
