import Link from 'next/link';

export default function Footer() {
    return (
        <footer className="border-t border-white/[0.05] py-20 px-8 bg-[#050505]">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
                <div className="flex items-center gap-4">
                    <span className="font-mono text-[10px] text-neutral-500 uppercase tracking-widest leading-none">
                        © 2026 Bit-Sign Protocol // Sovereignty as a Service
                    </span>
                </div>

                <div className="flex items-center gap-6">
                    <Link href="/docs" className="font-mono text-[10px] text-neutral-500 hover:text-white uppercase transition-colors">Documentation</Link>
                    <Link href="/privacy" className="font-mono text-[10px] text-neutral-500 hover:text-white uppercase transition-colors">Privacy</Link>
                    <Link href="/terms" className="font-mono text-[10px] text-neutral-500 hover:text-white uppercase transition-colors">Terms</Link>
                    <span className="font-mono text-[10px] text-neutral-700 uppercase">Ver 1.0.0-GENESIS</span>
                </div>
            </div>
        </footer>
    );
}
