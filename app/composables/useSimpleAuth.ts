const AUTH_KEY = 'phasefold_auth';
const CHECK = 'MUN5eVQqMmJ4enVVJA==';
const EXPIRY_DAYS = 7;

const decode = (s: string): string => {
    if (import.meta.server) return '';
    return atob(s);
};

export const useSimpleAuth = () => {
    const isAuthenticated = useState<boolean>('auth', () => false);

    const checkAuth = (): boolean => {
        if (import.meta.server) return false;
        const stored = localStorage.getItem(AUTH_KEY);
        if (!stored) return false;

        try {
            const { expiry } = JSON.parse(stored);
            if (expiry && Date.now() < expiry) {
                isAuthenticated.value = true;
                return true;
            }
            localStorage.removeItem(AUTH_KEY);
        } catch {
            localStorage.removeItem(AUTH_KEY);
        }
        return false;
    };

    const login = (password: string): boolean => {
        if (import.meta.server) return false;
        if (password === decode(CHECK)) {
            const expiry = Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000;
            localStorage.setItem(AUTH_KEY, JSON.stringify({ expiry }));
            isAuthenticated.value = true;
            return true;
        }
        return false;
    };

    const logout = () => {
        if (import.meta.server) return;
        localStorage.removeItem(AUTH_KEY);
        isAuthenticated.value = false;
    };

    return {
        isAuthenticated,
        checkAuth,
        login,
        logout,
    };
};
