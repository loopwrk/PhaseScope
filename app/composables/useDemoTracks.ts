export interface DemoTrack {
    id: string;
    name: string;
    file: string;
    corridorOrder: number;
    sphereOrder: number;
}

export function useDemoTracks() {
    const tracks = ref<DemoTrack[]>([]);
    const isLoading = ref(false);

    const fetchTracks = async () => {
        isLoading.value = true;
        try {
            const response = await fetch('/api/dev/audio-files');
            if (response.ok) {
                tracks.value = await response.json();
            }
        } catch (error) {
            console.warn('[useDemoTracks] Failed to fetch tracks:', error);
        } finally {
            isLoading.value = false;
        }
    };

    fetchTracks();

    const loadDemoTrack = async (track: DemoTrack): Promise<File> => {
        const response = await fetch(track.file);
        if (!response.ok) {
            throw new Error(`Failed to load demo track: ${track.name}`);
        }
        const blob = await response.blob();
        const ext = track.file.split('.').pop() ?? 'mp3';
        return new File([blob], `${track.name}.${ext}`, { type: blob.type });
    };

    return {
        tracks,
        isLoading,
        loadDemoTrack,
    };
}
