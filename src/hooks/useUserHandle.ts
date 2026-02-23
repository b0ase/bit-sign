'use client';

import { useState, useEffect } from 'react';

export function useUserHandle() {
    const [handle, setHandle] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const getHandleFromCookie = () => {
            const name = "handcash_handle=";
            const decodedCookie = decodeURIComponent(document.cookie);
            const ca = decodedCookie.split(';');
            for (let i = 0; i < ca.length; i++) {
                let c = ca[i];
                while (c.charAt(0) === ' ') {
                    c = c.substring(1);
                }
                if (c.indexOf(name) === 0) {
                    const val = c.substring(name.length, c.length);
                    setHandle(val);
                    break;
                }
            }
            setLoading(false);
        };

        getHandleFromCookie();
    }, []);

    const logout = () => {
        // Use server-side logout to properly clear domain-scoped cookies
        window.location.href = '/api/auth/logout';
    };

    return { handle, loading, logout };
}
