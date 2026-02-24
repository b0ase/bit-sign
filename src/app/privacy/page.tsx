export default function PrivacyPage() {
    return (
        <div className="min-h-screen p-6 pt-24 pb-24 max-w-7xl mx-auto space-y-12">
            <header className="border-b border-white/10 pb-8">
                <h1 className="text-6xl font-mono font-bold tracking-tighter mb-4 uppercase">Privacy Policy</h1>
                <p className="text-neutral-500 font-mono tracking-[0.2em] uppercase text-sm">Last Updated: February 24, 2026</p>
            </header>

            <div className="font-mono text-xs text-neutral-400 leading-relaxed space-y-8 uppercase">
                <section className="space-y-4">
                    <h2 className="text-white text-lg font-bold">1. Overarching Principle</h2>
                    <p>
                        Bit-Sign is a privacy-first platform. We minimize data collection to only what is necessary to operate the signing and identity verification service. We do not sell, rent, or share your personal data with third parties for marketing purposes.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-white text-lg font-bold">2. Data We DO NOT Collect</h2>
                    <ul className="list-disc list-inside space-y-2">
                        <li>We do not collect or store your private keys or wallet credentials.</li>
                        <li>We do not collect or store the plaintext of your encrypted documents.</li>
                        <li>We do not store passwords for any linked identity provider.</li>
                        <li>We do not sell or share your data with third parties for advertising.</li>
                    </ul>
                </section>

                <section className="space-y-4">
                    <h2 className="text-white text-lg font-bold">3. Data We Collect and Process</h2>
                    <p>
                        When you use Bit-Sign, we collect and process the following:
                    </p>
                    <ul className="list-disc list-inside space-y-2">
                        <li><span className="text-white">HandCash handle and profile:</span> Used for wallet authentication, payment processing, and identity root creation.</li>
                        <li><span className="text-white">OAuth profile data:</span> When you link Google, X (Twitter), LinkedIn, Discord, Microsoft, or GitHub, we receive your display name, email address, and profile picture from the respective provider. This data creates identity strands that strengthen your on-chain identity level.</li>
                        <li><span className="text-white">Document metadata:</span> File names, timestamps, and document hashes used for on-chain inscriptions and sealing.</li>
                        <li><span className="text-white">Signature data:</span> Your drawn or uploaded signatures, stored in your vault for reuse.</li>
                        <li><span className="text-white">Co-sign requests:</span> Handle or email addresses of recipients you invite to co-sign documents.</li>
                        <li><span className="text-white">Photos and media:</span> Profile photos and media captured via the phone camera linking feature, stored in your vault.</li>
                    </ul>
                </section>

                <section className="space-y-4">
                    <h2 className="text-white text-lg font-bold">4. Identity Providers (OAuth)</h2>
                    <p>
                        Bit-Sign integrates with the following identity providers via OAuth 2.0:
                    </p>
                    <ul className="list-disc list-inside space-y-2">
                        <li><span className="text-white">HandCash</span> — Wallet authentication and BSV transactions</li>
                        <li><span className="text-white">Google</span> — Name, email, profile picture</li>
                        <li><span className="text-white">X (Twitter)</span> — Username, display name, profile picture</li>
                        <li><span className="text-white">LinkedIn</span> — Name, email, profile picture</li>
                        <li><span className="text-white">Discord</span> — Username, email, avatar</li>
                        <li><span className="text-white">Microsoft</span> — Name, email</li>
                        <li><span className="text-white">GitHub</span> — Username, email, avatar</li>
                    </ul>
                    <p>
                        We only request the minimum scopes required (basic profile and email). We store OAuth tokens securely to maintain your linked status. You may unlink any provider at any time, which removes the stored token and associated profile data.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-white text-lg font-bold">5. Data Storage</h2>
                    <p>
                        User data is stored in a self-hosted database. Document content is processed in the browser where possible. Encrypted attestations and identity inscriptions are written to the Bitcoin blockchain and are permanent.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-white text-lg font-bold">6. On-Chain Data</h2>
                    <p>
                        Data inscribed on the Bitcoin blockchain is permanent and immutable. This includes identity roots, identity strands, document seals, and attestation records. Once inscribed, neither Bit-Sign nor any party can delete or modify these records. You should consider this carefully before sealing or inscribing any data.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-white text-lg font-bold">7. Cookies</h2>
                    <p>
                        We use essential, secure, HTTP-only cookies to maintain your authentication session. No tracking, analytics, or marketing cookies are used. No third-party cookie services are integrated.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-white text-lg font-bold">8. Data Retention and Deletion</h2>
                    <p>
                        Off-chain data (vault items, profile information, OAuth tokens) may be deleted upon request. On-chain data (inscriptions, seals, identity strands) cannot be deleted due to the immutable nature of the blockchain. To request deletion of your off-chain data, contact us at the address below.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-white text-lg font-bold">9. Contact</h2>
                    <p>
                        For privacy inquiries, contact: bitsignonline@gmail.com
                    </p>
                </section>
            </div>
        </div>
    );
}
