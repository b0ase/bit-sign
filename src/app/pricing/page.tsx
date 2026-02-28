export default function PricingPage() {
    return (
        <div className="min-h-screen p-4 sm:p-6 pt-20 sm:pt-24 pb-24 max-w-7xl mx-auto space-y-10 sm:space-y-16">
            <header className="border-b border-white/10 pb-6 sm:pb-8">
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">Pricing</h1>
                <p className="text-zinc-400 text-base">Pay per signature. No subscriptions.</p>
            </header>

            <section className="grid grid-cols-1 md:grid-cols-3 gap-12">
                <div className="md:col-span-2 space-y-8">
                    <div className="space-y-4">
                        <h2 className="text-xl font-semibold border-l-4 border-white pl-4">Pay-as-you-go</h2>
                        <p className="text-sm text-zinc-400 leading-relaxed">
                            Bit-Sign is priced as a utility, not a subscription. You pay for the witnessing and inscription of your digital signatures.
                            Whether you are signing a document or recording an automated system event, the cost is tied to the proof.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-base font-semibold text-zinc-300">Use Cases</h3>
                        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <li className="border border-white/5 p-4 bg-white/[0.02] rounded-md">
                                <span className="block text-white font-medium text-sm mb-1">GitHub Commits</span>
                                <p className="text-sm text-zinc-500">Sign every commit to verify developer identity on-chain.</p>
                            </li>
                            <li className="border border-white/5 p-4 bg-white/[0.02] rounded-md">
                                <span className="block text-white font-medium text-sm mb-1">Legal Documents</span>
                                <p className="text-sm text-zinc-500">Permanent record of IDs, passports, and contracts.</p>
                            </li>
                            <li className="border border-white/5 p-4 bg-white/[0.02] rounded-md">
                                <span className="block text-white font-medium text-sm mb-1">IoT Logging</span>
                                <p className="text-sm text-zinc-500">Cryptographic proof of sensor data or system state.</p>
                            </li>
                            <li className="border border-white/5 p-4 bg-white/[0.02] rounded-md">
                                <span className="block text-white font-medium text-sm mb-1">Notarization</span>
                                <p className="text-sm text-zinc-500">Witness documents without a centralized authority.</p>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="md:col-span-1 space-y-8">
                    <div className="border border-white/10 p-6 bg-white/[0.03] space-y-6 rounded-md">
                        <header>
                            <span className="text-sm text-zinc-500 block mb-1">Standard Rate</span>
                            <div className="text-4xl font-bold tracking-tight">$0.01</div>
                            <span className="text-sm text-zinc-500">per signature</span>
                        </header>

                        <div className="space-y-4 pt-6 border-t border-white/10">
                            <h4 className="text-sm font-medium text-white">Volume Tiers</h4>
                            <table className="w-full text-sm text-zinc-500">
                                <thead className="text-zinc-600">
                                    <tr className="border-b border-white/5 text-left">
                                        <th className="pb-2 font-normal">Monthly Volume</th>
                                        <th className="pb-2 font-normal text-right">Price</th>
                                    </tr>
                                </thead>
                                <tbody className="text-zinc-400">
                                    <tr className="border-b border-white/5">
                                        <td className="py-2">1 &ndash; 999</td>
                                        <td className="py-2 text-right">$0.01</td>
                                    </tr>
                                    <tr className="border-b border-white/5 bg-white/5">
                                        <td className="py-2 text-white">1,000+</td>
                                        <td className="py-2 text-right text-white">$0.005</td>
                                    </tr>
                                    <tr>
                                        <td className="py-2">10,000+</td>
                                        <td className="py-2 text-right">Contact us</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <p className="text-xs text-zinc-600 leading-relaxed">
                            Includes BSV inscription fees and protocol witnessing.
                        </p>
                    </div>
                </div>
            </section>

            <section className="p-8 border border-white/5 bg-neutral-900/10 space-y-4 rounded-md">
                <h3 className="text-base font-semibold">Why Bit-Sign?</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">
                    Centralized signing services charge high monthly premiums for proprietary silos. Bit-Sign charges a micro-fee for universal, portable proof.
                    Pay as you go and maintain full control over your identity without subscription lock-in.
                </p>
            </section>
        </div>
    );
}
