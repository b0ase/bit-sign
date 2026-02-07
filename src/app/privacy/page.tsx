export default function PrivacyPage() {
    return (
        <div className="min-h-screen p-6 pt-24 pb-24 max-w-7xl mx-auto space-y-12">
            <header className="border-b border-white/10 pb-8">
                <h1 className="text-6xl font-mono font-bold tracking-tighter mb-4 uppercase">Privacy Policy</h1>
                <p className="text-neutral-500 font-mono tracking-[0.2em] uppercase text-sm">Effective Date: February 7, 2026</p>
            </header>

            <div className="font-mono text-xs text-neutral-400 leading-relaxed space-y-8 uppercase">
                <section className="space-y-4">
                    <h2 className="text-white text-lg font-bold">1. Overarching Principle</h2>
                    <p>
                        Bit-Sign is a privacy-first, zero-knowledge platform. Our primary goal is to ensure that we never possess the data we attest to.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-white text-lg font-bold">2. Data We DO NOT Collect</h2>
                    <ul className="list-disc list-inside space-y-2">
                        <li>We do not collect or store your private keys.</li>
                        <li>We do not collect or store the plaintext of your documents.</li>
                        <li>We do not track your IP address or physical location.</li>
                        <li>We do not sell your data to third parties.</li>
                    </ul>
                </section>

                <section className="space-y-4">
                    <h2 className="text-white text-lg font-bold">3. Data We Process</h2>
                    <p>
                        When you use Bit-Sign, we process your HandCash handle and any metadata you explicitly provide (e.g., file names for on-chain tags) to facilitate the signing flow. This data is handled in the browser and passed to the blockchain via your authorized signature.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-white text-lg font-bold">4. On-Chain Data</h2>
                    <p>
                        Data inscribed on the Bitcoin blockchain is permanent and immutable. Once you push an encrypted attestation to the chain, bit-sign.online has no way to delete or modify that record.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-white text-lg font-bold">5. Cookies</h2>
                    <p>
                        We use essential, secure, HTTP-only cookies to maintain your HandCash authentication session. No tracking or marketing cookies are utilized.
                    </p>
                </section>
            </div>
        </div>
    );
}
