# bit-sign User Testing Checklist

*Two-party document signing flow — test with another user*

## Signing & On-Chain Proof

- [ ] **Can I hash it to the chain when I sign it?**
  - What's the TXID?
  - We want a visible "STAMP" on sealed documents showing the TXID and document name
  - Users need to see proof that their document is on-chain at a glance

- [ ] **Does the sealed document show the TXID and document name?**
  - Should be visible on the document itself (like a notary stamp)
  - Not just in the metadata — on the actual rendered document

## Sharing & Multi-Party Signing

- [ ] **Can I pass the signed document to another user if I know their HandCash handle?**
  - TBC

- [ ] **Can I send it to their email if they don't have a HandCash handle?**
  - TBC — may need email invite flow

- [ ] **Can they sign up using an EMAIL magic link if they don't have HandCash?**
  - TBC — currently HandCash is the only auth method

## Counter-Signing Flow

- [ ] **Can the other party sign it, hash it, and return it to me?**
  - TBC — full round-trip counter-sign flow

- [ ] **Do I get an email notification when they sign?**
  - TBC — no email notification system yet

## Security & Encryption

- [ ] **Is the document stored securely, encrypted on-chain so only signing parties can read it?**
  - TBC — currently E2E encrypted in vault, on-chain inscription is hash-only (not the document itself)
  - Need to clarify: on-chain = hash proof, off-chain = encrypted document storage

---

## Current Status (2026-02-24)

| Feature | Status |
|---------|--------|
| On-chain inscription of sealed docs | Working (TXID exists) |
| TXID stamp visible on document | **Not yet** — needs UI work |
| Share to HandCash handle | Working (E2E encrypted share) |
| Share via email (no HandCash) | **Not built** |
| Email magic link signup | **Not built** |
| Counter-sign + return flow | **Partial** — co-sign exists, return flow TBD |
| Email notifications | **Not built** |
| E2E encrypted storage | Working (vault items) |
| On-chain encrypted doc (only parties read) | Hash-only on chain, doc in encrypted DB |
