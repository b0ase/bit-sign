export default function PricingPage() {
    return (
        <div className="min-h-screen p-6 pt-24 pb-24 max-w-7xl mx-auto space-y-16">
            <header className="border-b border-white/10 pb-8">
                <h1 className="text-5xl font-mono font-bold tracking-tighter mb-4 uppercase">Pricing</h1>
                <p className="text-neutral-500 font-mono tracking-[0.2em] uppercase text-xs">Standardized Proof of Intent</p>
            </header>

            <section className="grid grid-cols-1 md:grid-cols-3 gap-12">
                <div className="md:col-span-2 space-y-8">
                    <div className="space-y-4">
                        <h2 className="text-2xl font-mono font-bold uppercase border-l-4 border-white pl-4">The Utility Model</h2>
                        <p className="font-mono text-sm text-neutral-400 leading-relaxed uppercase">
                            Bit-Sign is priced as a utility, not a subscription. We charge for the **witnessing** and **inscription** of your digital intent.
                            Whether you are signing a sovereign document or an automated system event, the cost is tied to the value of the proof.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-lg font-mono font-bold uppercase text-white/80">Use Cases</h3>
                        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <li className="border border-white/5 p-4 bg-white/[0.02]">
                                <span className="block text-white font-bold text-[10px] mb-1">GITHUB PUSHES</span>
                                <p className="text-[10px] text-neutral-500 uppercase">Sign every commit to guarantee developer identity on-chain.</p>
                            </li>
                            <li className="border border-white/5 p-4 bg-white/[0.02]">
                                <span className="block text-white font-bold text-[10px] mb-1">SAFE BOX ATTESTATION</span>
                                <p className="text-[10px] text-neutral-500 uppercase">Permanent legal record of ID, Passports, and Contracts.</p>
                            </li>
                            <li className="border border-white/5 p-4 bg-white/[0.02]">
                                <span className="block text-white font-bold text-[10px] mb-1">IOT LOGGING</span>
                                <p className="text-[10px] text-neutral-500 uppercase">Cryptographic proof of sensor data or system state.</p>
                            </li>
                            <li className="border border-white/5 p-4 bg-white/[0.02]">
                                <span className="block text-white font-bold text-[10px] mb-1">LEGAL NOTARIZATION</span>
                                <p className="text-[10px] text-neutral-500 uppercase">Self-sovereign witnessing without a centralized authority.</p>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="md:col-span-1 space-y-8">
                    <div className="border border-white/10 p-6 bg-white/[0.03] space-y-6">
                        <header>
                            <span className="text-[10px] text-neutral-600 font-mono uppercase tracking-widest block mb-1">Standard Rate</span>
                            <div className="text-4xl font-mono font-black tracking-tighter">$0.01</div>
                            <span className="text-[9px] text-neutral-500 font-mono uppercase tracking-[0.2em]">Per Signature</span>
                        </header>

                        <div className="space-y-4 pt-6 border-t border-white/10">
                            <h4 className="text-[10px] font-mono font-bold text-white uppercase">Volume Tiers</h4>
                            <table className="w-full font-mono text-[9px] text-neutral-500 uppercase">
                                <thead className="text-neutral-700">
                                    <tr className="border-b border-white/5 text-left">
                                        <th className="pb-2 font-normal">Monthly Vol</th>
                                        <th className="pb-2 font-normal text-right">Price/Sign</th>
                                    </tr>
                                </thead>
                                <tbody className="text-neutral-400">
                                    <tr className="border-b border-white/5">
                                        <td className="py-2">1 - 999</td>
                                        <td className="py-2 text-right">$0.01</td>
                                    </tr>
                                    <tr className="border-b border-white/5 bg-white/5">
                                        <td className="py-2 text-white">1,000+</td>
                                        <td className="py-2 text-right text-white">$0.005</td>
                                    </tr>
                                    <tr>
                                        <td className="py-2 italic">10,000+</td>
                                        <td className="py-2 text-right italic">Inquire</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <p className="text-[8px] text-neutral-600 font-mono uppercase italic leading-tight">
                            Includes BSV inscription network fees and protocol witnessing.
                        </p>
                    </div>
                </div>
            </section>

            <section className="p-8 border border-white/5 bg-neutral-900/10 space-y-4">
                <h3 className="text-sm font-mono font-bold uppercase tracking-widest">Why Bit-Sign?</h3>
                <p className="font-mono text-xs text-neutral-500 leading-relaxed uppercase">
                    Centralized signing services charge high monthly premiums for proprietary silos. Bit-Sign charges a micro-fee for universal, portable proof.
                    By paying as you go, you maintain full sovereignty over your identity without being locked into a subscription trap.
                    **Your proof, your keys, your penny.**
                </p>
            </section>
        </div>
    );
}
