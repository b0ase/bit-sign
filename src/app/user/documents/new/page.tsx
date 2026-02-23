'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  FiArrowLeft, FiArrowRight, FiPlus, FiTrash2,
  FiFileText, FiCopy, FiCheck
} from 'react-icons/fi';

interface TemplateInfo {
  id: string;
  name: string;
  description: string;
  fields: { key: string; label: string; required: boolean; default?: string }[];
  signers: { role: string; label: string; required: boolean }[];
}

interface SignerEntry {
  name: string;
  email: string;
  handle: string;
  role: string;
}

type Step = 'template' | 'fields' | 'signers' | 'review';

export default function NewDocumentPage() {
  const router = useRouter();
  const [handle, setHandle] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('template');
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateInfo | null>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [signers, setSigners] = useState<SignerEntry[]>([]);
  const [title, setTitle] = useState('');
  const [previewHtml, setPreviewHtml] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  useEffect(() => {
    const cookies = document.cookie.split('; ');
    const handleCookie = cookies.find(row => row.startsWith('handcash_handle='));
    if (handleCookie) {
      setHandle(handleCookie.split('=')[1]);
    }
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/templates');
      const data = await res.json();
      setTemplates(data.templates || []);
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    }
  };

  const handleSelectTemplate = (template: TemplateInfo) => {
    setSelectedTemplate(template);

    // Pre-populate defaults
    const defaults: Record<string, string> = {};
    template.fields.forEach(f => {
      if (f.default) defaults[f.key] = f.default;
    });
    setVariables(defaults);

    // Pre-populate signers from template roles
    setSigners(template.signers.map(s => ({
      name: '',
      email: '',
      handle: '',
      role: s.role,
    })));

    setTitle(`${template.name} - ${new Date().toLocaleDateString('en-GB')}`);
    setStep('fields');
  };

  const handlePreview = async () => {
    if (!selectedTemplate) return;
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_id: selectedTemplate.id, variables }),
      });
      const data = await res.json();
      setPreviewHtml(data.html || '');
    } catch (error) {
      console.error('Preview failed:', error);
    }
  };

  const handleSubmit = async () => {
    if (!selectedTemplate || !handle) return;
    setSubmitting(true);

    try {
      const res = await fetch('/api/envelopes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          template_id: selectedTemplate.id,
          variables,
          signers: signers.map((s, i) => ({
            name: s.name,
            email: s.email || undefined,
            handle: s.handle || undefined,
            role: s.role,
            order: i + 1,
          })),
          expires_in_days: 30,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setResult(data);
        setStep('review');
      } else {
        alert(data.error || 'Failed to create envelope');
      }
    } catch (error) {
      console.error('Submit failed:', error);
      alert('Failed to create envelope');
    } finally {
      setSubmitting(false);
    }
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  if (!handle) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-4xl font-mono font-black mb-6 tracking-tighter uppercase italic">Access Denied</h1>
        <Link href="/api/auth/handcash" className="px-12 py-4 bg-white text-black font-mono font-bold uppercase text-xs tracking-widest">Connect Wallet</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      <div className="relative z-10 p-6 pt-24 max-w-4xl mx-auto space-y-8 pb-40">
        {/* Header */}
        <header className="flex items-center gap-4 border-b border-zinc-900 pb-6">
          <Link href="/user/documents" className="p-2 border border-zinc-800 hover:border-white transition-colors">
            <FiArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-3xl font-mono font-black tracking-tighter uppercase italic">New Document</h1>
            <p className="text-zinc-600 font-mono text-[10px] tracking-[0.4em] uppercase mt-1">
              {step === 'template' && 'Select Template'}
              {step === 'fields' && 'Fill Details'}
              {step === 'signers' && 'Add Signers'}
              {step === 'review' && 'Complete'}
            </p>
          </div>
        </header>

        {/* Step indicator */}
        <div className="flex gap-1">
          {['template', 'fields', 'signers', 'review'].map((s, i) => (
            <div
              key={s}
              className={`h-1 flex-1 ${
                s === step ? 'bg-white' :
                ['template', 'fields', 'signers', 'review'].indexOf(step) > i ? 'bg-zinc-600' : 'bg-zinc-900'
              }`}
            />
          ))}
        </div>

        {/* Step 1: Template Selection */}
        {step === 'template' && (
          <div className="space-y-4">
            {templates.map((t) => (
              <button
                key={t.id}
                onClick={() => handleSelectTemplate(t)}
                className="w-full text-left p-6 border border-zinc-900 bg-zinc-950 hover:bg-zinc-900 hover:border-zinc-700 transition-all group"
              >
                <div className="flex items-start gap-4">
                  <FiFileText className="text-zinc-600 group-hover:text-white transition-colors mt-1" size={24} />
                  <div>
                    <h3 className="font-mono font-black text-lg uppercase tracking-wider">{t.name}</h3>
                    <p className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest mt-1">{t.description}</p>
                    <div className="flex gap-3 mt-3">
                      <span className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest">
                        {t.fields.length} fields
                      </span>
                      <span className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest">
                        {t.signers.length} signers
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Step 2: Fill Fields */}
        {step === 'fields' && selectedTemplate && (
          <div className="space-y-6">
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-2">Document Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 font-mono text-sm text-white focus:border-white outline-none transition-colors"
              />
            </div>

            <div className="border-t border-zinc-900 pt-6 space-y-4">
              {selectedTemplate.fields.map((field) => (
                <div key={field.key}>
                  <label className="block text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-2">
                    {field.label} {field.required && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="text"
                    value={variables[field.key] || ''}
                    onChange={(e) => setVariables(prev => ({ ...prev, [field.key]: e.target.value }))}
                    placeholder={field.default || ''}
                    className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 font-mono text-sm text-white placeholder:text-zinc-700 focus:border-white outline-none transition-colors"
                  />
                </div>
              ))}
            </div>

            <div className="flex gap-4 pt-4">
              <button
                onClick={() => setStep('template')}
                className="px-6 py-3 border border-zinc-800 text-zinc-400 font-mono text-xs uppercase tracking-widest hover:border-white hover:text-white transition-all"
              >
                <FiArrowLeft className="inline mr-2" /> Back
              </button>
              <button
                onClick={async () => { await handlePreview(); setStep('signers'); }}
                className="flex-1 py-3 bg-white text-black font-mono font-black uppercase text-xs tracking-widest hover:bg-zinc-200 transition-all flex items-center justify-center gap-2"
              >
                Continue <FiArrowRight />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Add Signers */}
        {step === 'signers' && selectedTemplate && (
          <div className="space-y-6">
            {/* Document Preview */}
            {previewHtml && (
              <div className="border border-zinc-800 p-1">
                <div className="bg-white text-black p-4 max-h-[300px] overflow-y-auto">
                  <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
                </div>
              </div>
            )}

            <div className="space-y-4">
              <h3 className="text-[10px] font-mono font-black uppercase tracking-[0.4em] text-zinc-500">Signers</h3>

              {signers.map((signer, i) => (
                <div key={i} className="p-4 border border-zinc-900 bg-zinc-950 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold uppercase tracking-widest text-zinc-400">
                      {selectedTemplate.signers[i]?.label || `Signer ${i + 1}`}
                    </span>
                    {i >= selectedTemplate.signers.length && (
                      <button
                        onClick={() => setSigners(prev => prev.filter((_, idx) => idx !== i))}
                        className="text-zinc-600 hover:text-red-500 transition-colors"
                      >
                        <FiTrash2 size={14} />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <input
                      type="text"
                      value={signer.name}
                      onChange={(e) => {
                        const updated = [...signers];
                        updated[i] = { ...updated[i], name: e.target.value };
                        setSigners(updated);
                      }}
                      placeholder="Full Name *"
                      className="px-3 py-2 bg-black border border-zinc-800 font-mono text-xs text-white placeholder:text-zinc-700 focus:border-white outline-none"
                    />
                    <input
                      type="email"
                      value={signer.email}
                      onChange={(e) => {
                        const updated = [...signers];
                        updated[i] = { ...updated[i], email: e.target.value };
                        setSigners(updated);
                      }}
                      placeholder="Email"
                      className="px-3 py-2 bg-black border border-zinc-800 font-mono text-xs text-white placeholder:text-zinc-700 focus:border-white outline-none"
                    />
                    <input
                      type="text"
                      value={signer.handle}
                      onChange={(e) => {
                        const updated = [...signers];
                        updated[i] = { ...updated[i], handle: e.target.value };
                        setSigners(updated);
                      }}
                      placeholder="$handle"
                      className="px-3 py-2 bg-black border border-zinc-800 font-mono text-xs text-white placeholder:text-zinc-700 focus:border-white outline-none"
                    />
                  </div>
                </div>
              ))}

              <button
                onClick={() => setSigners(prev => [...prev, { name: '', email: '', handle: '', role: 'additional' }])}
                className="w-full py-3 border border-dashed border-zinc-800 text-zinc-600 hover:text-white hover:border-zinc-600 font-mono text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
              >
                <FiPlus size={14} /> Add Signer
              </button>
            </div>

            <div className="flex gap-4 pt-4">
              <button
                onClick={() => setStep('fields')}
                className="px-6 py-3 border border-zinc-800 text-zinc-400 font-mono text-xs uppercase tracking-widest hover:border-white hover:text-white transition-all"
              >
                <FiArrowLeft className="inline mr-2" /> Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || signers.some(s => !s.name)}
                className="flex-1 py-3 bg-white text-black font-mono font-black uppercase text-xs tracking-widest hover:bg-zinc-200 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting ? 'Creating...' : 'Create & Send'} <FiArrowRight />
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Result */}
        {step === 'review' && result && (
          <div className="space-y-8">
            <div className="p-8 border border-green-900 bg-green-950/20 text-center space-y-4">
              <FiCheck className="mx-auto text-green-400" size={40} />
              <h2 className="font-mono font-black text-2xl uppercase tracking-wider">Envelope Created</h2>
              <p className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest">
                Hash: {result.envelope.document_hash.slice(0, 16)}...
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-[10px] font-mono font-black uppercase tracking-[0.4em] text-zinc-500">Signing URLs</h3>
              <p className="font-mono text-[10px] text-zinc-600 uppercase tracking-widest">Send these to each signer:</p>

              {result.signing_urls.map((s: any, i: number) => (
                <div key={i} className="flex items-center gap-3 p-4 bg-zinc-950 border border-zinc-900">
                  <div className="flex-1 space-y-1">
                    <span className="block font-mono text-xs font-bold uppercase tracking-widest text-white">{s.name}</span>
                    <span className="block font-mono text-[10px] text-zinc-500 uppercase tracking-widest">{s.role}</span>
                    <span className="block font-mono text-[10px] text-zinc-600 break-all">{s.url}</span>
                  </div>
                  <button
                    onClick={() => copyUrl(s.url)}
                    className="p-2 border border-zinc-800 hover:border-white transition-colors"
                  >
                    {copiedUrl === s.url ? <FiCheck size={14} className="text-green-400" /> : <FiCopy size={14} />}
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-4">
              <Link
                href="/user/documents"
                className="flex-1 py-3 border border-zinc-800 text-zinc-400 font-mono text-xs uppercase tracking-widest hover:border-white hover:text-white transition-all text-center"
              >
                View All Documents
              </Link>
              <Link
                href={`/verify/${result.envelope.id}`}
                className="flex-1 py-3 bg-white text-black font-mono font-black uppercase text-xs tracking-widest hover:bg-zinc-200 transition-all text-center"
              >
                View Envelope
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
