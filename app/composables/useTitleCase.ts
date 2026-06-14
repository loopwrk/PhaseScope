export const useTitleCase = () => {
    const toTitleCase = (s: string): string =>
        s
            .split(/[^a-zA-Z0-9]+/)
            .filter(Boolean)
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');

    return { toTitleCase };
};
