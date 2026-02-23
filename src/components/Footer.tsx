import Link from 'next/link';

export default function Footer() {
    return (
        <footer className="border-t border-white/[0.05] py-16 px-8 bg-[#050505]">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <span className="text-sm text-neutral-500">
                        &copy; 2026 Bit-Sign
                    </span>
                </div>

                <div className="flex items-center gap-6">
                    <Link href="/docs" className="text-sm text-neutral-500 hover:text-white transition-colors">Documentation</Link>
                    <Link href="/privacy" className="text-sm text-neutral-500 hover:text-white transition-colors">Privacy</Link>
                    <Link href="/terms" className="text-sm text-neutral-500 hover:text-white transition-colors">Terms</Link>
                </div>
            </div>
        </footer>
    );
}
