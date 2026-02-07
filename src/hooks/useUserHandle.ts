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
        document.cookie = "handcash_auth_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        document.cookie = "handcash_handle=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        setHandle(null);
        window.location.reload();
    };

    return { handle, loading, logout };
}
