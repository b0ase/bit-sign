export default function TermsPage() {
    return (
        <div className="min-h-screen p-6 pt-24 pb-24 max-w-7xl mx-auto space-y-12">
            <header className="border-b border-white/10 pb-8">
                <h1 className="text-6xl font-mono font-bold tracking-tighter mb-4 uppercase">Terms of Service</h1>
                <p className="text-neutral-500 font-mono tracking-[0.2em] uppercase text-sm">Industrial Protocol Agreement</p>
            </header>

            <div className="font-mono text-xs text-neutral-400 leading-relaxed space-y-8 uppercase">
                <section className="space-y-4">
                    <h2 className="text-white text-lg font-bold">1. Agreement to Terms</h2>
                    <p>
                        By accessing bit-sign.online, you agree to bound by these industrial-grade terms. If you do not agree to these terms, do not authorize your wallet or attempt to use the signing protocol.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-white text-lg font-bold">2. Service Fee</h2>
                    <p>
                        Bit-Sign charges a flat fee of $0.01 per signature/attestation request. This fee is non-refundable and covers the cost of witnessing and protocol facilitation. On-chain transaction fees for inscriptions are handled separately via the platform treasury.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-white text-lg font-bold">3. User Responsibility</h2>
                    <p>
                        You are solely responsible for the content you sign and inscribe. Bit-Sign does not pre-screen or monitor content. You agree not to use the platform for any illegal or harmful activities.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-white text-lg font-bold">4. Zero Liability</h2>
                    <p>
                        Bit-Sign is provided "AS IS" without warranty of any kind. We are not liable for any data loss, lost access to keys, or legal disputes arising from your on-chain attestations. You acknowledge that blockchain data is permanent.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-white text-lg font-bold">5. Governing Law</h2>
                    <p>
                        These terms are governed by the principles of mathematical certainty and the consensus rules of the Bitcoin network. Any legal disputes shall be settled via digital arbitration linked to your on-chain identity.
                    </p>
                </section>
            </div>
        </div>
    );
}
