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
                                className="object-contain filter grayscale invert group-hover:invert-0 transition-all duration-300"
                            />
                        </div>
                        <span className="font-mono text-xl tracking-tighter font-bold uppercase">Bit-Sign</span>
                    </Link>

                    <div className="hidden md:flex items-center gap-6">
                        {handle && <Link href="/user/documents" className="text-xs uppercase font-mono text-neutral-400 hover:text-white transition-colors">Documents</Link>}
                        <Link href="/docs" className="text-xs uppercase font-mono text-neutral-400 hover:text-white transition-colors">Docs</Link>
                        <Link href="/pricing" className="text-xs uppercase font-mono text-neutral-400 hover:text-white transition-colors">Pricing</Link>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {handle ? (
                        <Link
                            href="/user/account"
                            className="flex items-center gap-2 px-3 py-1.5 rounded-none border border-white/20 hover:border-white transition-all group"
                        >
                            <span className="font-mono text-[10px] text-neutral-400 group-hover:text-white transition-colors uppercase">Account</span>
                            <span className="font-mono text-[10px] text-white font-bold tracking-widest">${handle}</span>
                        </Link>
                    ) : (
                        <Link
                            href="/api/auth/handcash"
                            className="px-6 py-2 bg-white text-black font-mono text-xs font-bold uppercase hover:bg-neutral-200 transition-colors"
                        >
                            Login with HandCash
                        </Link>
                    )}
                </div>
            </div>
        </nav>
    );
}
