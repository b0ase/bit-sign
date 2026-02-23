export default function DocsPage() {
    return (
        <div className="min-h-screen p-6 pt-24 pb-24 max-w-7xl mx-auto space-y-16">
            <header className="border-b border-white/10 pb-8">
                <h1 className="text-4xl font-bold tracking-tight mb-3">Documentation</h1>
                <p className="text-zinc-400 text-base">How Bit-Sign verification works</p>
            </header>

            <section className="space-y-6">
                <h2 className="text-xl font-semibold border-l-4 border-white pl-4">Identity Verification</h2>
                <div className="space-y-4 text-sm text-zinc-400 leading-relaxed">
                    <p>
                        Bit-Sign creates a verifiable identity token by combining a HandCash cryptographic handshake with multi-factor evidence &mdash; passport photos, video statements, and hand-drawn signatures.
                    </p>
                    <p>
                        This identity token is portable and uniquely yours. It serves as an on-chain root for secure commit signing, IP registration, and document verification.
                    </p>
                </div>
            </section>

            <section className="space-y-6">
                <h2 className="text-xl font-semibold border-l-4 border-white pl-4">How It Works</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm leading-relaxed">
                    <div className="border border-white/10 p-6 space-y-4 bg-white/5 rounded-md">
                        <h3 className="font-semibold text-white">1. Client-Side Encryption</h3>
                        <p className="text-zinc-400">
                            All sensitive operations &mdash; file hashing, encryption key derivation, and document locking &mdash; happen entirely in your browser. Bit-Sign never sees your plaintext data.
                        </p>
                    </div>
                    <div className="border border-white/10 p-6 space-y-4 bg-white/5 rounded-md">
                        <h3 className="font-semibold text-white">2. Blockchain Witnessing</h3>
                        <p className="text-zinc-400">
                            We use the HandCash SDK to trigger signing requests. Your signature locks and unlocks your secure assets on the Bitcoin SV blockchain.
                        </p>
                    </div>
                </div>
            </section>

            <section className="space-y-6">
                <h2 className="text-xl font-semibold border-l-4 border-white pl-4">Permission Scopes</h2>
                <div className="space-y-4 text-sm text-zinc-400 leading-relaxed">
                    <p>When you authorize Bit-Sign via HandCash, we request the following permissions:</p>
                    <ul className="list-disc list-inside space-y-2 text-white">
                        <li><span className="text-zinc-400">USER_PUBLIC_PROFILE:</span> To display your handle and avatar.</li>
                        <li><span className="text-zinc-400">USER_PRIVATE_PROFILE:</span> To link your identity across sessions.</li>
                        <li><span className="text-zinc-400">PAY:</span> To process the $0.01 attestation fee.</li>
                        <li><span className="text-zinc-400">SIGN_DATA:</span> To derive encryption keys locally for document security.</li>
                    </ul>
                </div>
            </section>

            <section className="space-y-6">
                <h2 className="text-xl font-semibold border-l-4 border-white pl-4">Storage Policy</h2>
                <div className="border border-red-900/20 p-8 bg-red-950/5 rounded-md">
                    <p className="text-sm text-red-400 font-medium mb-2">Important</p>
                    <p className="text-sm text-zinc-300 leading-relaxed">
                        We never store your signatures or private keys. Bit-Sign is an interface. Your data lives on the blockchain; your keys stay in your wallet. If you lose access to your HandCash account, you lose access to your encrypted documents. There is no password reset.
                    </p>
                </div>
            </section>
        </div>
    );
}
