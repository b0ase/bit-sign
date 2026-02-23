'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Image from 'next/image';

export default function Navbar() {
    const [handle, setHandle] = useState<string | null>(null);

    useEffect(() => {
        // Read handle from cookie
        const cookies = document.cookie.split('; ');
        const handleCookie = cookies.find(row => row.startsWith('handcash_handle='));
        if (handleCookie) {
            setHandle(handleCookie.split('=')[1]);
        }
    }, []);

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.05] bg-[#050505]/80 backdrop-blur-md">
            <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                <div className="flex items-center gap-8">
                    <Link href="/" className="flex items-center gap-2 group">
                        <div className="w-8 h-8 relative">
                            <Image
                                src="/bit-sign-icon.png"
                                alt="Bit-Sign"
                                fill
                                className="object-contain"
                            />
                        </div>
                        <span className="text-lg tracking-tight font-semibold">Bit-Sign</span>
                    </Link>

                    <div className="hidden md:flex items-center gap-6">
                        {handle && <Link href="/user/documents" className="text-sm text-neutral-400 hover:text-white transition-colors">Documents</Link>}
                        <Link href="/docs" className="text-sm text-neutral-400 hover:text-white transition-colors">Docs</Link>
                        <Link href="/pricing" className="text-sm text-neutral-400 hover:text-white transition-colors">Pricing</Link>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {handle ? (
                        <>
                            <Link
                                href="/user/account"
                                className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-white/20 hover:border-white transition-all group"
                            >
                                <span className="text-sm text-neutral-400 group-hover:text-white transition-colors">Account</span>
                                <span className="text-sm text-white font-medium">${handle}</span>
                            </Link>
                            <a
                                href="/api/auth/logout"
                                className="px-3 py-1.5 text-sm text-zinc-600 hover:text-red-400 transition-colors"
                            >
                                Sign Out
                            </a>
                        </>
                    ) : (
                        <a
                            href="/api/auth/handcash"
                            className="px-5 py-2 bg-white text-black text-sm font-medium rounded-md hover:bg-neutral-200 transition-colors"
                        >
                            Sign in with HandCash
                        </a>
                    )}
                </div>
            </div>
        </nav>
    );
}
