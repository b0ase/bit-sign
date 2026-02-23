# Bit-Sign

> The Secure Identity Signer for the $401 Protocol

**Live:** [bit-sign.online](https://bit-sign.online)

## What It Does

Bit-Sign produces **identity bundles** and **cryptographic signatures** that anchor identities to the Bitcoin SV blockchain. It is the signing authority for $401 identity tokens.

### Core Functions

1. **Identity Bundle Creation** — Generate a signed identity package linking a human-readable handle to a BSV public key
2. **Root Key Management** — Secure creation and rotation of root signing keys
3. **Signature Verification** — Verify that an identity claim was signed by the declared root key
4. **$401 Attestation** — Produce attestation proofs consumed by `pathd` (the $402 daemon) for identity-gated content

## How It Fits the Protocol Stack

```
┌─────────────────────────────────┐
│  bit-sign.online ($401 Signer)  │ ← You are here
├─────────────────────────────────┤
│  path401.com (Identity Spec)    │ ← Public specification
├─────────────────────────────────┤
│  path403.com (Permission Rules) │ ← Access control
├─────────────────────────────────┤
│  pathd ($402 Payment Daemon)    │ ← Content serving
└─────────────────────────────────┘
```

## Tech Stack

- **Framework**: Next.js 15
- **Crypto**: @bsv/sdk, Bitcoin SV ECDSA signatures
- **Database**: Supabase (identity records)

## Getting Started

```bash
pnpm install
cp .env.example .env.local
# Set BSV wallet keys and Supabase credentials
pnpm dev
```

## Related Scripts

- `b0ase.com/scripts/mint-401-identity.ts` — Mint $401 identity token on-chain
- `b0ase.com/scripts/rotate-401-identity-key.ts` — Key rotation utility

## Ecosystem Links

- **$401 Spec**: [path401.com](https://path401.com)
- **$402 Protocol**: [path402.com](https://path402.com)
- **$403 Permissions**: [path403.com](https://path403.com)
- **Studio**: [b0ase.com](https://b0ase.com)

## License

MIT
