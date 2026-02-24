export default function TermsPage() {
    return (
        <div className="min-h-screen p-6 pt-24 pb-24 max-w-7xl mx-auto space-y-12">
            <header className="border-b border-white/10 pb-8">
                <h1 className="text-6xl font-mono font-bold tracking-tighter mb-4 uppercase">Terms of Service</h1>
                <p className="text-neutral-500 font-mono tracking-[0.2em] uppercase text-sm">Last Updated: February 24, 2026</p>
            </header>

            <div className="font-mono text-xs text-neutral-400 leading-relaxed space-y-8 uppercase">
                <section className="space-y-4">
                    <h2 className="text-white text-lg font-bold">1. Agreement to Terms</h2>
                    <p>
                        By accessing bit-sign.online, you agree to be bound by these terms of service. If you do not agree to these terms, do not authorize your wallet, link identity providers, or attempt to use the signing protocol.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-white text-lg font-bold">2. Service Description</h2>
                    <p>
                        Bit-Sign is a document signing, attestation, and on-chain identity platform built on the $401 identity protocol. The platform enables users to create digital signatures, seal documents with on-chain inscriptions, link identity providers for verification, and co-sign documents with other users.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-white text-lg font-bold">3. Identity Providers</h2>
                    <p>
                        Bit-Sign supports linking accounts from third-party identity providers including HandCash, Google, X (Twitter), LinkedIn, Discord, Microsoft, and GitHub. By linking these accounts, you authorize Bit-Sign to retrieve your basic profile information (name, email, profile picture) from the respective provider. Each linked provider creates an identity strand that strengthens your on-chain identity level.
                    </p>
                    <p>
                        Bit-Sign does not store your passwords for any third-party provider. Authentication is handled via OAuth 2.0 or equivalent protocols. You may unlink providers at any time.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-white text-lg font-bold">4. Service Fee</h2>
                    <p>
                        Bit-Sign charges a flat fee of $0.01 per signature/attestation request. This fee is non-refundable and covers the cost of witnessing and protocol facilitation. On-chain transaction fees for inscriptions are handled separately via the platform treasury.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-white text-lg font-bold">5. Document Signing and Sealing</h2>
                    <p>
                        When you seal a document, the platform creates a tamper-proof on-chain inscription containing a hash of the sealed content, your identity handle, and a timestamp. Sealed documents may be shared with other users for co-signing or witnessing. You acknowledge that on-chain data is permanent and immutable once inscribed.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-white text-lg font-bold">6. Co-Signing and Witnessing</h2>
                    <p>
                        You may request other Bit-Sign users to co-sign or witness your sealed documents. By responding to a co-sign request, a user attests to having reviewed the document. Co-sign requests are sent via handle or email and are subject to the recipient&apos;s acceptance.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-white text-lg font-bold">7. User Responsibility</h2>
                    <p>
                        You are solely responsible for the content you sign, seal, and inscribe. Bit-Sign does not pre-screen or monitor content. You agree not to use the platform for any illegal, fraudulent, or harmful activities. You are responsible for safeguarding access to your linked identity providers and wallet.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-white text-lg font-bold">8. Limitation of Liability</h2>
                    <p>
                        Bit-Sign is provided &quot;AS IS&quot; without warranty of any kind, express or implied. We are not liable for any data loss, lost access to keys, identity provider outages, failed transactions, or legal disputes arising from your on-chain attestations. You acknowledge that blockchain data is permanent and cannot be deleted or modified by Bit-Sign or any party.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-white text-lg font-bold">9. Account Termination</h2>
                    <p>
                        We reserve the right to suspend or terminate access to Bit-Sign at our discretion if we believe you are violating these terms. On-chain inscriptions already made cannot be revoked upon termination.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-white text-lg font-bold">10. Governing Law</h2>
                    <p>
                        These terms shall be governed by and construed in accordance with the laws of England and Wales. Any disputes shall be subject to the exclusive jurisdiction of the courts of England and Wales.
                    </p>
                </section>
            </div>
        </div>
    );
}
