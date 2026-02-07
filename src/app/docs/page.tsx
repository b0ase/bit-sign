export default function DocsPage() {
    return (
        <div className="min-h-screen p-6 pt-24 pb-24 max-w-7xl mx-auto space-y-16">
            <header className="border-b border-white/10 pb-8">
                <h1 className="text-6xl font-mono font-bold tracking-tighter mb-4 uppercase">Verification Protocol</h1>
                <p className="text-neutral-500 font-mono tracking-[0.2em] uppercase text-sm">Industrial Multi-factor Attestation</p>
            </header>

            <section className="space-y-6">
                <h2 className="text-2xl font-mono font-bold uppercase border-l-4 border-white pl-4">The DNA Model</h2>
                <div className="space-y-4 font-mono text-sm text-neutral-400 leading-relaxed">
                    <p>
                        Bit-Sign is an industrial-grade layer for **Digital DNA.** By combining a HandCash cryptographic handshake with multi-factor biological evidence—such as passport photos, video statements, and hand-written signatures—we create a verifiable identity token.
                    </p>
                    <p>
                        This **DNA Token** is transactable and uniquely yours. It serves as the portable on-chain root for secure commit notifications, IP registration, and shareholder staking across the b0ase ecosystem.
                    </p>
                </div>
            </section>

            <section className="space-y-6">
                <h2 className="text-2xl font-mono font-bold uppercase border-l-4 border-white pl-4">How It Works</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 font-mono text-sm leading-relaxed">
                    <div className="border border-white/10 p-6 space-y-4 bg-white/5">
                        <h3 className="font-bold text-white uppercase">1. Client-Side Integrity</h3>
                        <p className="text-neutral-400">
                            All sensitive operations—file hashing, encryption key derivation, and document locking—happen entirely in your browser. bit-sign.online never sees your plaintext data.
                        </p>
                    </div>
                    <div className="border border-white/10 p-6 space-y-4 bg-white/5">
                        <h3 className="font-bold text-white uppercase">2. HandCash Witnessing</h3>
                        <p className="text-neutral-400">
                            We leverage the HandCash Pay SDK to trigger signing requests. Your signature is the master key that locks and unlocks your secure assets on-chain.
                        </p>
                    </div>
                </div>
            </section>

            <section className="space-y-6">
                <h2 className="text-2xl font-mono font-bold uppercase border-l-4 border-white pl-4">Permission Scopes</h2>
                <div className="space-y-4 font-mono text-sm text-neutral-400 leading-relaxed">
                    <p>When you authorize Bit-Sign via HandCash, we request the following minimum viable permissions:</p>
                    <ul className="list-disc list-inside space-y-2 text-white">
                        <li><span className="text-neutral-400 uppercase">USER_PUBLIC_PROFILE:</span> To display your handle and avatar.</li>
                        <li><span className="text-neutral-400 uppercase">USER_PRIVATE_PROFILE:</span> To link your persistent identity across the ecosystem.</li>
                        <li><span className="text-neutral-400 uppercase">PAY:</span> To facilitate the $0.01 attestation fee and signature trigger.</li>
                        <li><span className="text-neutral-400 uppercase">SIGN_DATA:</span> Essential for the Safe Box feature to derive encryption keys locally.</li>
                    </ul>
                </div>
            </section>

            <section className="space-y-6">
                <h2 className="text-2xl font-mono font-bold uppercase border-l-4 border-white pl-4">Storage Policy</h2>
                <div className="border border-red-900/20 p-8 bg-red-950/5">
                    <p className="font-mono text-xs text-red-500 uppercase font-bold mb-2 tracking-widest">Crucial Information</p>
                    <p className="font-mono text-sm text-neutral-300 leading-relaxed">
                        **WE NEVER STORE YOUR SIGNATURES OR KEYS.** Bit-Sign is an interface. The data is on the blockchain; the keys are in your wallet. If you lose access to your HandCash account, you lose access to the Safe Box. There is no password reset for sovereignty.
                    </p>
                </div>
            </section>
        </div>
    );
}
