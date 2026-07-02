import React from 'react';

export interface InvoiceRendererProps {
  invoice: any;
  mode?: 'desktop' | 'a4' | 'mobile';
  // Allows rendering with unsaved temporary template configs during editing
  previewTemplate?: any;
}

const DEFAULT_TEMPLATE = {
  business: {
    name: "NerdShive Workspace Private Limited",
    address: "Sector 5, HSR Layout, Bangalore, Karnataka - 560102",
    phone: "+91 99999 88888",
    email: "finance@nerdshive.com",
    website: "www.nerdshive.com",
    gstin: "29AAAAA1111A1Z1",
    pan: "ABCDE1234F"
  },
  branding: {
    logoUrl: "https://pyrefly.com/logo.png",
    logoWidth: 64,
    logoHeight: 64,
    logoUploaded: false,
    uploadedLogo: "",
    primaryColor: "#d45b25",
    accentColor: "#f97316",
    headerColor: "#ffffff",
    footerColor: "#f8fafc",
    theme: "classic"
  },
  invoice: {
    prefix: "INV-",
    startingNumber: 1,
    numberPadding: 5,
    dateFormat: "DD/MM/YYYY",
    dueDateOffset: 7,
    includeFinancialYear: false
  },
  currency: {
    symbol: "₹",
    code: "INR",
    precision: 2
  },
  tax: {
    name: "GST",
    percentage: 18.0,
    included: false
  },
  fees: [],
  discounts: [],
  payment: {
    bankName: "ICICI Bank",
    accountNumber: "1234567890",
    accountHolder: "NerdShive Workspace Pvt Ltd",
    ifsc: "ICIC0001234",
    upiId: "nerdshive@upi",
    paymentInstructions: ""
  },
  terms: "Payment is due within 7 days of invoice generation.",
  footer: {
    text: "Thank you for choosing NerdShive! For support: finance@nerdshive.com",
    copyright: "© 2026 NerdShive Workspace",
    supportEmail: "support@nerdshive.com",
    supportPhone: "+91 99999 88888"
  }
};

export const parseInlineStyles = (text: string): string => {
  if (!text) return '';
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
    
  // Bold: **text**
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // Bold: __text__
  html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');
  // Bold HTML tags (if already there, keep safe)
  html = html.replace(/&lt;b&gt;(.*?)&lt;\/b&gt;/g, '<strong>$1</strong>');
  html = html.replace(/&lt;strong&gt;(.*?)&lt;\/strong&gt;/g, '<strong>$1</strong>');
  
  // Hyperlinks: [text](url)
  html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" class="text-indigo-600 hover:underline font-medium" target="_blank" rel="noopener noreferrer">$1</a>');
  // Hyperlink HTML tags
  html = html.replace(/&lt;a\s+href=["'](.*?)["']&gt;(.*?)&lt;\/a&gt;/g, '<a href="$1" class="text-indigo-600 hover:underline font-medium" target="_blank" rel="noopener noreferrer">$2</a>');

  return html;
};

export const renderRichText = (text: string) => {
  if (!text) return null;
  const paragraphs = text.split(/\n\s*\n/);
  return paragraphs.map((p, pIdx) => {
    const lines = p.split('\n');
    
    // Check if homogeneous list (bullet points or numbered)
    const isList = lines.length > 0 && lines.every(line => /^\s*([\*\-\u2022]|\d+\.)\s+/.test(line));
    if (isList) {
      const isNumbered = /^\s*\d+\.\s+/.test(lines[0]);
      const ListTag = isNumbered ? 'ol' : 'ul';
      return (
        <ListTag key={pIdx} className={`pl-5 my-2 space-y-1 ${isNumbered ? 'list-decimal' : 'list-disc'}`}>
          {lines.map((line, lIdx) => {
            const cleanLine = line.replace(/^\s*([\*\-\u2022]|\d+\.)\s+/, '');
            return <li key={lIdx} dangerouslySetInnerHTML={{ __html: parseInlineStyles(cleanLine) }} />;
          })}
        </ListTag>
      );
    }

    const parsedParagraph = lines.map(line => parseInlineStyles(line)).join('<br />');
    return (
      <p key={pIdx} className="mb-2 leading-relaxed" dangerouslySetInnerHTML={{ __html: parsedParagraph }} />
    );
  });
};

export function InvoiceRenderer({ invoice, mode = 'desktop', previewTemplate }: InvoiceRendererProps) {
  // Use snapshot, fallback to previewTemplate, fallback to DEFAULT_TEMPLATE
  const config = invoice?.template_snapshot || previewTemplate || DEFAULT_TEMPLATE;
  
  const business = config.business || DEFAULT_TEMPLATE.business;
  const branding = config.branding || DEFAULT_TEMPLATE.branding;
  const currency = config.currency || DEFAULT_TEMPLATE.currency;
  const payment = config.payment || DEFAULT_TEMPLATE.payment;
  const terms = config.terms || DEFAULT_TEMPLATE.terms;
  const footer = config.footer || DEFAULT_TEMPLATE.footer;

  const theme = branding.theme || 'classic';
  const primaryColor = branding.primaryColor || '#d45b25';
  const accentColor = branding.accentColor || '#f97316';
  
  // Format currency helper
  const formatMoney = (val: any) => {
    const num = parseFloat(val) || 0;
    const precision = typeof currency.precision === 'number' ? currency.precision : 2;
    return `${currency.symbol}${num.toLocaleString('en-IN', {
      minimumFractionDigits: precision,
      maximumFractionDigits: precision
    })}`;
  };

  // Safe parsed date helper
  const formatDate = (dateVal: any) => {
    if (!dateVal) return 'N/A';
    try {
      return new Date(dateVal).toLocaleDateString();
    } catch {
      return String(dateVal);
    }
  };

  // Rendering Logo with width/height to prevent layout shifts
  const renderLogo = () => {
    const src = branding.logoUploaded && branding.uploadedLogo ? branding.uploadedLogo : branding.logoUrl;
    if (!src) return null;
    
    return (
      <img 
        src={src} 
        alt="Logo" 
        style={{ 
          width: `${branding.logoWidth || 64}px`, 
          height: `${branding.logoHeight || 64}px`,
          objectFit: 'contain'
        }} 
        className="max-w-full"
      />
    );
  };

  // Base styling wrappers for Preview Modes
  let containerClass = "bg-white text-slate-800 font-sans shadow border p-6 md:p-8 rounded-lg w-full max-w-4xl mx-auto";
  if (mode === 'a4') {
    containerClass = "bg-white text-slate-800 font-sans border w-[210mm] min-h-[297mm] p-[20mm] shadow-lg mx-auto overflow-hidden relative print:border-none print:shadow-none print:p-0";
  } else if (mode === 'mobile') {
    containerClass = "bg-white text-slate-800 font-sans border w-full max-w-[375px] p-4 shadow-sm mx-auto overflow-hidden text-xs";
  }

  // Define contents depending on theme selection
  return (
    <div className={containerClass}>
      {/* ================= THEME: CLASSIC ================= */}
      {theme === 'classic' && (
        <div className="space-y-6">
          <div className="flex justify-between items-start border-b pb-4" style={{ borderColor: primaryColor }}>
            <div>
              <div className="text-xl font-bold uppercase" style={{ color: primaryColor }}>{business.name}</div>
              <p className="text-xs text-muted-foreground whitespace-pre-line mt-1">{business.address}</p>
              {business.phone && <p className="text-xs text-muted-foreground mt-0.5">Phone: {business.phone}</p>}
              {business.email && <p className="text-xs text-muted-foreground">Email: {business.email}</p>}
              {business.gstin && <p className="text-xs text-muted-foreground">GSTIN: {business.gstin}</p>}
            </div>
            <div className="text-right flex flex-col items-end">
              {renderLogo()}
              <h2 className="text-2xl font-black mt-3" style={{ color: primaryColor }}>INVOICE</h2>
              <p className="text-xs mt-1"><strong>Invoice #:</strong> {invoice?.invoice_number || 'DRAFT'}</p>
              <p className="text-xs"><strong>Date:</strong> {formatDate(invoice?.invoice_date || new Date())}</p>
              {invoice?.due_date && <p className="text-xs"><strong>Due Date:</strong> {formatDate(invoice.due_date)}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="border p-3 rounded bg-slate-50">
              <h4 className="font-bold text-slate-700 mb-1">Billed To:</h4>
              <p className="font-semibold">{invoice?.owner?.name || invoice?.company_name || 'N/A'}</p>
              <p className="text-muted-foreground">{invoice?.owner ? `Email: ${invoice.owner.email}` : `ID: ${invoice?.company_id || 'N/A'}`}</p>
              {invoice?.owner?.address && <p className="text-muted-foreground mt-0.5">Address: {invoice.owner.address}</p>}
              {(invoice?.owner?.tax_number || invoice?.company_gst_number) && (
                <p className="text-muted-foreground mt-0.5">GST/Tax: {invoice?.owner?.tax_number || invoice?.company_gst_number}</p>
              )}
            </div>
            {invoice?.billing_start_date && (
              <div className="border p-3 rounded bg-slate-50 text-right">
                <h4 className="font-bold text-slate-700 mb-1">Billing Period:</h4>
                <p>{formatDate(invoice.billing_start_date)} to {formatDate(invoice.billing_end_date)}</p>
                {invoice.payment_date && <p className="mt-1 text-green-600 font-semibold">Paid on: {formatDate(invoice.payment_date)}</p>}
              </div>
            )}
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse border">
              <thead>
                <tr className="bg-slate-100 border-b">
                  <th className="p-2 border">Description</th>
                  <th className="p-2 border text-center">Seats / Qty</th>
                  <th className="p-2 border text-right">Rate</th>
                  <th className="p-2 border text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="p-2 border font-medium">
                    {invoice?.plan_name || 'Coworking Space Subscription'} 
                    {invoice?.billing_type && ` (${invoice.billing_type})`}
                  </td>
                  <td className="p-2 border text-center font-semibold">{invoice?.seats ?? 1}</td>
                  <td className="p-2 border text-right">{formatMoney(invoice?.price_per_seat ?? invoice?.subtotal)}</td>
                  <td className="p-2 border text-right">{formatMoney(invoice?.subtotal ?? 0)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Financial calculations */}
          <div className="flex justify-end">
            <div className="w-64 space-y-1 text-xs border p-3 rounded">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{formatMoney(invoice?.subtotal ?? 0)}</span>
              </div>
              <div className="flex justify-between border-b pb-1">
                <span>GST ({invoice?.gst_rate ?? 18}%):</span>
                <span>{formatMoney(invoice?.gst_amount ?? 0)}</span>
              </div>
              <div className="flex justify-between font-bold text-sm pt-1" style={{ color: primaryColor }}>
                <span>Total Due:</span>
                <span>{formatMoney(invoice?.total_amount ?? 0)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= THEME: MODERN ================= */}
      {theme === 'modern' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center rounded-xl p-4 text-white" style={{ background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})` }}>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">INVOICE</h2>
              <p className="text-xs opacity-90 mt-1">Invoice #: {invoice?.invoice_number || 'DRAFT'}</p>
            </div>
            <div className="text-right">
              {renderLogo()}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 text-xs">
            <div>
              <h4 className="text-muted-foreground uppercase tracking-wider font-semibold mb-1 text-[10px]">From:</h4>
              <p className="font-bold text-sm">{business.name}</p>
              <p className="text-muted-foreground whitespace-pre-line mt-1">{business.address}</p>
              <p className="text-muted-foreground mt-1">GSTIN: {business.gstin}</p>
            </div>
            <div>
              <h4 className="text-muted-foreground uppercase tracking-wider font-semibold mb-1 text-[10px]">To:</h4>
              <p className="font-bold text-sm">{invoice?.owner?.name || invoice?.company_name || 'N/A'}</p>
              <p className="text-muted-foreground">{invoice?.owner ? `Email: ${invoice.owner.email}` : `ID: ${invoice?.company_id || 'N/A'}`}</p>
              {invoice?.owner?.address && <p className="text-muted-foreground mt-0.5">Address: {invoice.owner.address}</p>}
              {(invoice?.owner?.tax_number || invoice?.company_gst_number) && (
                <p className="text-muted-foreground mt-0.5">GST: {invoice?.owner?.tax_number || invoice?.company_gst_number}</p>
              )}
              <div className="mt-3 grid grid-cols-2 gap-1 border-t pt-2">
                <div>
                  <span className="text-[10px] uppercase text-muted-foreground block">Issue Date</span>
                  <span className="font-semibold">{formatDate(invoice?.invoice_date || new Date())}</span>
                </div>
                {invoice?.due_date && (
                  <div>
                    <span className="text-[10px] uppercase text-muted-foreground block">Due Date</span>
                    <span className="font-semibold text-rose-500">{formatDate(invoice.due_date)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="p-3">Item Description</th>
                  <th className="p-3 text-center">Seats</th>
                  <th className="p-3 text-right">Rate</th>
                  <th className="p-3 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr>
                  <td className="p-3 font-semibold text-slate-700">
                    {invoice?.plan_name || 'Workspace Access'} 
                    {invoice?.billing_type && ` - ${invoice.billing_type} Billing`}
                  </td>
                  <td className="p-3 text-center font-bold">{invoice?.seats ?? 1}</td>
                  <td className="p-3 text-right">{formatMoney(invoice?.price_per_seat ?? invoice?.subtotal)}</td>
                  <td className="p-3 text-right font-semibold">{formatMoney(invoice?.subtotal ?? 0)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-72 divide-y text-xs border rounded-lg overflow-hidden bg-slate-50">
              <div className="flex justify-between p-3">
                <span className="text-slate-500">Subtotal</span>
                <span>{formatMoney(invoice?.subtotal ?? 0)}</span>
              </div>
              <div className="flex justify-between p-3">
                <span className="text-slate-500">GST ({invoice?.gst_rate ?? 18}%)</span>
                <span>{formatMoney(invoice?.gst_amount ?? 0)}</span>
              </div>
              <div className="flex justify-between p-3 font-bold text-base bg-white" style={{ borderLeft: `4px solid ${primaryColor}` }}>
                <span className="text-slate-800">Total Billed</span>
                <span style={{ color: primaryColor }}>{formatMoney(invoice?.total_amount ?? 0)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= THEME: MINIMAL ================= */}
      {theme === 'minimal' && (
        <div className="space-y-8 py-2">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              {renderLogo()}
              <h1 className="text-2xl font-light tracking-widest text-slate-800 uppercase">{business.name}</h1>
              <p className="text-[11px] text-slate-500 whitespace-pre-line">{business.address}</p>
              {business.gstin && <p className="text-[11px] text-slate-500">GST: {business.gstin}</p>}
            </div>
            <div className="text-right space-y-1">
              <h2 className="text-lg font-light tracking-wider text-slate-400">INVOICE</h2>
              <p className="text-xs">#{invoice?.invoice_number || 'DRAFT'}</p>
              <p className="text-[11px] text-slate-500">Date: {formatDate(invoice?.invoice_date || new Date())}</p>
              {invoice?.due_date && <p className="text-[11px] text-slate-500">Due: {formatDate(invoice.due_date)}</p>}
            </div>
          </div>

          <div className="border-t border-b border-slate-100 py-4 grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-slate-400 text-[10px] block mb-1">BILLED TO</span>
              <p className="font-bold">{invoice?.owner?.name || invoice?.company_name || 'N/A'}</p>
              <p className="text-slate-500">{invoice?.owner ? `Email: ${invoice.owner.email}` : `ID: ${invoice?.company_id || 'N/A'}`}</p>
              {invoice?.owner?.address && <p className="text-slate-500 mt-0.5">Address: {invoice.owner.address}</p>}
              {(invoice?.owner?.tax_number || invoice?.company_gst_number) && (
                <p className="text-slate-500 mt-0.5">GST: {invoice?.owner?.tax_number || invoice?.company_gst_number}</p>
              )}
            </div>
            {invoice?.billing_start_date && (
              <div className="text-right">
                <span className="text-slate-400 text-[10px] block mb-1">BILLING TIMEFRAME</span>
                <p className="text-slate-700">{formatDate(invoice.billing_start_date)} - {formatDate(invoice.billing_end_date)}</p>
                {invoice.payment_date && <p className="text-green-600 font-medium mt-1">Paid On: {formatDate(invoice.payment_date)}</p>}
              </div>
            )}
          </div>

          {/* Table */}
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="py-2 text-slate-400 font-medium">Service Description</th>
                <th className="py-2 text-center text-slate-400 font-medium w-20">Seats</th>
                <th className="py-2 text-right text-slate-400 font-medium w-28">Rate</th>
                <th className="py-2 text-right text-slate-400 font-medium w-28">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-100">
                <td className="py-3 text-slate-700 font-medium">
                  {invoice?.plan_name || 'Monthly Desk License'}
                  {invoice?.billing_type && ` (${invoice.billing_type})`}
                </td>
                <td className="py-3 text-center">{invoice?.seats ?? 1}</td>
                <td className="py-3 text-right">{formatMoney(invoice?.price_per_seat ?? invoice?.subtotal)}</td>
                <td className="py-3 text-right">{formatMoney(invoice?.subtotal ?? 0)}</td>
              </tr>
            </tbody>
          </table>

          {/* Minimal Totals */}
          <div className="flex justify-end pt-2">
            <div className="w-64 space-y-2 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal</span>
                <span>{formatMoney(invoice?.subtotal ?? 0)}</span>
              </div>
              <div className="flex justify-between text-slate-500 border-b border-slate-100 pb-2">
                <span>GST ({invoice?.gst_rate ?? 18}%)</span>
                <span>{formatMoney(invoice?.gst_amount ?? 0)}</span>
              </div>
              <div className="flex justify-between font-bold text-sm pt-1 text-slate-800">
                <span>Amount Due</span>
                <span>{formatMoney(invoice?.total_amount ?? 0)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= THEME: CORPORATE ================= */}
      {theme === 'corporate' && (
        <div className="space-y-6">
          <div className="flex justify-between items-start">
            <div className="flex items-center space-x-4">
              {renderLogo()}
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">{business.name}</h1>
                <p className="text-[11px] text-slate-600 whitespace-pre-line mt-1">{business.address}</p>
                {business.phone && <span className="text-[11px] text-slate-600 mr-2">T: {business.phone}</span>}
                {business.email && <span className="text-[11px] text-slate-600 mr-2">E: {business.email}</span>}
                {business.website && <span className="text-[11px] text-slate-600">W: {business.website}</span>}
              </div>
            </div>
            <div className="text-right border-l-4 pl-4 border-slate-900 space-y-1">
              <h2 className="text-lg font-black uppercase text-slate-900 tracking-wider">OFFICIAL INVOICE</h2>
              <p className="text-xs"><strong>No:</strong> {invoice?.invoice_number || 'DRAFT'}</p>
              <p className="text-[11px]"><strong>Date:</strong> {formatDate(invoice?.invoice_date || new Date())}</p>
              {invoice?.due_date && <p className="text-[11px]"><strong>Due Date:</strong> {formatDate(invoice.due_date)}</p>}
              {business.gstin && <p className="text-[10px] text-slate-500 font-mono">GSTIN: {business.gstin}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 border-t border-b border-slate-300 py-3 text-xs bg-slate-50 p-3">
            <div>
              <span className="font-bold text-slate-500 block mb-1">CLIENT INFORMATION:</span>
              <p className="font-bold text-slate-900">{invoice?.owner?.name || invoice?.company_name || 'N/A'}</p>
              <p className="text-slate-600">{invoice?.owner ? `Email: ${invoice.owner.email}` : `Client ID: ${invoice?.company_id || 'N/A'}`}</p>
              {invoice?.owner?.address && <p className="text-slate-600 mt-0.5">Address: {invoice.owner.address}</p>}
              {(invoice?.owner?.tax_number || invoice?.company_gst_number) && (
                <p className="text-slate-600 mt-0.5">GST: {invoice?.owner?.tax_number || invoice?.company_gst_number}</p>
              )}
            </div>
            {invoice?.billing_start_date && (
              <div className="text-right">
                <span className="font-bold text-slate-500 block mb-1">BILLING SUMMARY:</span>
                <p className="text-slate-700"><strong>Period:</strong> {formatDate(invoice.billing_start_date)} - {formatDate(invoice.billing_end_date)}</p>
                <p className="text-slate-700"><strong>Terms:</strong> Net {config.invoice?.dueDateOffset || 7} Days</p>
              </div>
            )}
          </div>

          {/* Table */}
          <table className="w-full text-xs text-left border border-slate-300">
            <thead className="bg-slate-800 text-white uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-2 border border-slate-300">Description of Service</th>
                <th className="p-2 border border-slate-300 text-center w-24">Quantity (Seats)</th>
                <th className="p-2 border border-slate-300 text-right w-32">Unit Price</th>
                <th className="p-2 border border-slate-300 text-right w-32">Subtotal Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-300">
              <tr>
                <td className="p-2 font-medium text-slate-900">
                  {invoice?.plan_name || 'Workspace Desk Subscription'}
                  {invoice?.billing_type && ` - Billing Cycle: ${invoice.billing_type}`}
                </td>
                <td className="p-2 text-center text-slate-900 font-bold">{invoice?.seats ?? 1}</td>
                <td className="p-2 text-right text-slate-900">{formatMoney(invoice?.price_per_seat ?? invoice?.subtotal)}</td>
                <td className="p-2 text-right text-slate-900 font-bold">{formatMoney(invoice?.subtotal ?? 0)}</td>
              </tr>
            </tbody>
          </table>

          {/* Totals */}
          <div className="flex justify-end">
            <table className="w-72 text-xs border border-slate-300 bg-slate-50">
              <tbody>
                <tr className="border-b border-slate-300">
                  <td className="p-2 font-semibold text-slate-600">Subtotal:</td>
                  <td className="p-2 text-right font-medium">{formatMoney(invoice?.subtotal ?? 0)}</td>
                </tr>
                <tr className="border-b border-slate-300">
                  <td className="p-2 font-semibold text-slate-600">GST ({invoice?.gst_rate ?? 18}%):</td>
                  <td className="p-2 text-right font-medium">{formatMoney(invoice?.gst_amount ?? 0)}</td>
                </tr>
                <tr className="bg-slate-900 text-white font-bold text-sm">
                  <td className="p-2">Grand Total:</td>
                  <td className="p-2 text-right">{formatMoney(invoice?.total_amount ?? 0)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= SHARED RICH TEXT SECTIONS ================= */}
      {terms && (
        <div className="mt-8 border-t pt-6 text-xs text-slate-600">
          <div className="space-y-1">
            <h5 className="font-bold text-slate-800 tracking-wide">TERMS & CONDITIONS</h5>
            <div className="text-slate-500 text-[11px] leading-relaxed">
              {renderRichText(terms)}
            </div>
          </div>
        </div>
      )}

      {/* ================= FOOTER ================= */}
      {footer && (
        <div className="mt-8 border-t pt-4 text-center text-[10px] text-slate-400 space-y-1">
          <div className="leading-relaxed">
            {renderRichText(footer.text)}
          </div>
          {footer.copyright && <p className="font-medium mt-1">{footer.copyright}</p>}
          {(footer.supportEmail || footer.supportPhone) && (
            <p className="opacity-90">
              {footer.supportEmail && `Email: ${footer.supportEmail}`}
              {footer.supportEmail && footer.supportPhone && ' | '}
              {footer.supportPhone && `Phone: ${footer.supportPhone}`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// Global function to build HTML string consistently for printing/downloading
export function renderInvoiceToHtml(invoice: any): string {
  const config = invoice?.template_snapshot || DEFAULT_TEMPLATE;
  
  const business = config.business || DEFAULT_TEMPLATE.business;
  const branding = config.branding || DEFAULT_TEMPLATE.branding;
  const currency = config.currency || DEFAULT_TEMPLATE.currency;
  const payment = config.payment || DEFAULT_TEMPLATE.payment;
  const terms = config.terms || DEFAULT_TEMPLATE.terms;
  const footer = config.footer || DEFAULT_TEMPLATE.footer;

  const theme = branding.theme || 'classic';
  const primaryColor = branding.primaryColor || '#d45b25';
  const accentColor = branding.accentColor || '#f97316';
  
  const formatMoney = (val: any) => {
    const num = parseFloat(val) || 0;
    const precision = typeof currency.precision === 'number' ? currency.precision : 2;
    return `${currency.symbol}${num.toLocaleString('en-IN', {
      minimumFractionDigits: precision,
      maximumFractionDigits: precision
    })}`;
  };

  const formatDate = (dateVal: any) => {
    if (!dateVal) return 'N/A';
    try {
      return new Date(dateVal).toLocaleDateString();
    } catch {
      return String(dateVal);
    }
  };

  const parseText = (text: string) => {
    if (!text) return '';
    const paragraphs = text.split(/\n\s*\n/);
    return paragraphs.map(p => {
      const lines = p.split('\n');
      const isList = lines.length > 0 && lines.every(line => /^\s*([\*\-\u2022]|\d+\.)\s+/.test(line));
      if (isList) {
        const isNumbered = /^\s*\d+\.\s+/.test(lines[0]);
        const listTag = isNumbered ? 'ol' : 'ul';
        const listStyle = isNumbered ? 'list-style-type: decimal;' : 'list-style-type: disc;';
        const listItems = lines.map(line => {
          const cleanLine = line.replace(/^\s*([\*\-\u2022]|\d+\.)\s+/, '');
          return `<li style="margin-bottom: 4px;">${parseInlineStyles(cleanLine)}</li>`;
        }).join('');
        return `<${listTag} style="${listStyle} padding-left: 20px; margin: 8px 0;">${listItems}</${listTag}>`;
      }
      const parsedP = lines.map(line => parseInlineStyles(line)).join('<br />');
      return `<p style="margin: 0 0 8px 0; line-height: 1.6;">${parsedP}</p>`;
    }).join('');
  };

  const logoSrc = branding.logoUploaded && branding.uploadedLogo ? branding.uploadedLogo : branding.logoUrl;
  const logoHtml = logoSrc ? `<img src="${logoSrc}" style="width: ${branding.logoWidth || 64}px; height: ${branding.logoHeight || 64}px; object-fit: contain; max-width: 100%;" alt="Logo" />` : '';

  let bodyContent = '';

  if (theme === 'classic') {
    bodyContent = `
      <div style="display: flex; justify-content: space-between; border-bottom: 2px solid ${primaryColor}; padding-bottom: 16px;">
        <div>
          <div style="font-size: 20px; font-weight: bold; color: ${primaryColor}; text-transform: uppercase;">${business.name}</div>
          <p style="font-size: 12px; color: #64748b; margin: 4px 0 0 0; white-space: pre-line;">${business.address}</p>
          ${business.phone ? `<p style="font-size: 12px; color: #64748b; margin: 2px 0 0 0;">Phone: ${business.phone}</p>` : ''}
          ${business.email ? `<p style="font-size: 12px; color: #64748b; margin: 0;">Email: ${business.email}</p>` : ''}
          ${business.gstin ? `<p style="font-size: 12px; color: #64748b; margin: 0;">GSTIN: ${business.gstin}</p>` : ''}
        </div>
        <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end;">
          ${logoHtml}
          <h2 style="font-size: 24px; font-weight: 900; color: ${primaryColor}; margin: 12px 0 0 0;">INVOICE</h2>
          <p style="font-size: 12px; margin: 4px 0 0 0;"><strong>Invoice #:</strong> ${invoice?.invoice_number || 'DRAFT'}</p>
          <p style="font-size: 12px; margin: 0;"><strong>Date:</strong> ${formatDate(invoice?.invoice_date || new Date())}</p>
          ${invoice?.due_date ? `<p style="font-size: 12px; margin: 0;"><strong>Due Date:</strong> ${formatDate(invoice.due_date)}</p>` : ''}
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; font-size: 12px; margin-top: 24px;">
        <div style="border: 1px solid #e2e8f0; padding: 12px; border-radius: 4px; background-color: #f8fafc;">
          <h4 style="font-weight: bold; color: #334155; margin: 0 0 4px 0;">Billed To:</h4>
          <p style="font-weight: 600; margin: 0;">${invoice?.owner?.name || invoice?.company_name || 'N/A'}</p>
          <p style="color: #64748b; margin: 0;">${invoice?.owner ? `Email: ${invoice.owner.email}` : `ID: ${invoice?.company_id || 'N/A'}`}</p>
          ${invoice?.owner?.address ? `<p style="color: #64748b; margin: 2px 0 0 0;">Address: ${invoice.owner.address}</p>` : ''}
          ${invoice?.owner?.tax_number || invoice?.company_gst_number ? `<p style="color: #64748b; margin: 2px 0 0 0;">GST: ${invoice?.owner?.tax_number || invoice?.company_gst_number}</p>` : ''}
        </div>
        ${invoice?.billing_start_date ? `
          <div style="border: 1px solid #e2e8f0; padding: 12px; border-radius: 4px; background-color: #f8fafc; text-align: right;">
            <h4 style="font-weight: bold; color: #334155; margin: 0 0 4px 0;">Billing Period:</h4>
            <p style="margin: 0;">${formatDate(invoice.billing_start_date)} to ${formatDate(invoice.billing_end_date)}</p>
            ${invoice.payment_date ? `<p style="margin: 4px 0 0 0; color: #16a34a; font-weight: 600;">Paid on: ${formatDate(invoice.payment_date)}</p>` : ''}
          </div>
        ` : ''}
      </div>

      <div style="margin-top: 24px; overflow-x: auto;">
        <table style="width: 100%; font-size: 12px; text-align: left; border-collapse: collapse; border: 1px solid #e2e8f0;">
          <thead>
            <tr style="background-color: #f1f5f9; border-bottom: 1px solid #e2e8f0;">
              <th style="padding: 8px; border: 1px solid #e2e8f0;">Description</th>
              <th style="padding: 8px; border: 1px solid #e2e8f0; text-align: center;">Seats / Qty</th>
              <th style="padding: 8px; border: 1px solid #e2e8f0; text-align: right;">Rate</th>
              <th style="padding: 8px; border: 1px solid #e2e8f0; text-align: right;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: 500;">
                ${invoice?.plan_name || 'Subscription Access'} ${invoice?.billing_type ? `(${invoice.billing_type})` : ''}
              </td>
              <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: center; font-weight: bold;">${invoice?.seats ?? 1}</td>
              <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: right;">${formatMoney(invoice?.price_per_seat ?? invoice?.subtotal)}</td>
              <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: right;">${formatMoney(invoice?.subtotal ?? 0)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style="display: flex; justify-content: flex-end; margin-top: 24px;">
        <div style="width: 250px; font-size: 12px; border: 1px solid #e2e8f0; padding: 12px; border-radius: 4px; background-color: #ffffff;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span>Subtotal:</span>
            <span>${formatMoney(invoice?.subtotal ?? 0)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 4px;">
            <span>GST (${invoice?.gst_rate ?? 18}%):</span>
            <span>${formatMoney(invoice?.gst_amount ?? 0)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 14px; color: ${primaryColor};">
            <span>Total Due:</span>
            <span>${formatMoney(invoice?.total_amount ?? 0)}</span>
          </div>
        </div>
      </div>
    `;
  } else if (theme === 'modern') {
    bodyContent = `
      <div style="display: flex; justify-content: space-between; align-items: center; border-radius: 12px; padding: 16px; color: white; background: linear-gradient(135deg, ${primaryColor}, ${accentColor});">
        <div>
          <h2 style="font-size: 24px; font-weight: bold; margin: 0; tracking: -0.025em;">INVOICE</h2>
          <p style="font-size: 12px; opacity: 0.9; margin: 4px 0 0 0;">Invoice #: ${invoice?.invoice_number || 'DRAFT'}</p>
        </div>
        <div>
          ${logoHtml}
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; font-size: 12px; margin-top: 32px;">
        <div>
          <h4 style="color: #64748b; text-transform: uppercase; font-size: 10px; margin: 0 0 4px 0; tracking: 0.1em;">From:</h4>
          <p style="font-weight: bold; font-size: 14px; margin: 0 0 4px 0;">${business.name}</p>
          <p style="color: #64748b; margin: 0; white-space: pre-line;">${business.address}</p>
          <p style="color: #64748b; margin: 4px 0 0 0;">GSTIN: ${business.gstin}</p>
        </div>
        <div>
          <h4 style="color: #64748b; text-transform: uppercase; font-size: 10px; margin: 0 0 4px 0; tracking: 0.1em;">To:</h4>
          <p style="font-weight: bold; font-size: 14px; margin: 0 0 4px 0;">${invoice?.owner?.name || invoice?.company_name || 'N/A'}</p>
          <p style="color: #64748b; margin: 0;">${invoice?.owner ? `Email: ${invoice.owner.email}` : `ID: ${invoice?.company_id || 'N/A'}`}</p>
          ${invoice?.owner?.address ? `<p style="color: #64748b; margin: 2px 0 0 0;">Address: ${invoice.owner.address}</p>` : ''}
          ${invoice?.owner?.tax_number || invoice?.company_gst_number ? `<p style="color: #64748b; margin: 2px 0 0 0;">GST: ${invoice?.owner?.tax_number || invoice?.company_gst_number}</p>` : ''}
          <div style="margin-top: 16px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; border-top: 1px solid #edf2f7; padding-top: 8px;">
            <div>
              <span style="font-size: 10px; color: #64748b; text-transform: uppercase; display: block;">Issue Date</span>
              <span style="font-weight: 600;">${formatDate(invoice?.invoice_date || new Date())}</span>
            </div>
            ${invoice?.due_date ? `
              <div>
                <span style="font-size: 10px; color: #64748b; text-transform: uppercase; display: block;">Due Date</span>
                <span style="font-weight: 600; color: #f43f5e;">${formatDate(invoice.due_date)}</span>
              </div>
            ` : ''}
          </div>
        </div>
      </div>

      <div style="margin-top: 24px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <table style="width: 100%; font-size: 12px; text-align: left; border-collapse: collapse;">
          <thead style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
            <tr>
              <th style="padding: 12px; font-weight: 600;">Item Description</th>
              <th style="padding: 12px; text-align: center; font-weight: 600;">Seats</th>
              <th style="padding: 12px; text-align: right; font-weight: 600;">Rate</th>
              <th style="padding: 12px; text-align: right; font-weight: 600;">Subtotal</th>
            </tr>
          </thead>
          <tbody style="background-color: white;">
            <tr>
              <td style="padding: 12px; font-weight: bold; color: #334155;">
                ${invoice?.plan_name || 'Workspace Access'} ${invoice?.billing_type ? ` - ${invoice.billing_type} Billing` : ''}
              </td>
              <td style="padding: 12px; text-align: center; font-weight: bold;">${invoice?.seats ?? 1}</td>
              <td style="padding: 12px; text-align: right;">${formatMoney(invoice?.price_per_seat ?? invoice?.subtotal)}</td>
              <td style="padding: 12px; text-align: right; font-weight: bold; color: #0f172a;">${formatMoney(invoice?.subtotal ?? 0)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style="display: flex; justify-content: flex-end; margin-top: 24px;">
        <div style="width: 280px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background-color: #f8fafc; font-size: 12px;">
          <div style="display: flex; justify-content: space-between; padding: 10px 12px; border-bottom: 1px solid #e2e8f0;">
            <span style="color: #64748b;">Subtotal</span>
            <span>${formatMoney(invoice?.subtotal ?? 0)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 10px 12px; border-bottom: 1px solid #e2e8f0;">
            <span style="color: #64748b;">GST (${invoice?.gst_rate ?? 18}%)</span>
            <span>${formatMoney(invoice?.gst_amount ?? 0)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 12px; font-weight: bold; font-size: 15px; background-color: white; border-left: 4px solid ${primaryColor};">
            <span style="color: #1e293b;">Total Billed</span>
            <span style="color: ${primaryColor};">${formatMoney(invoice?.total_amount ?? 0)}</span>
          </div>
        </div>
      </div>
    `;
  } else if (theme === 'minimal') {
    bodyContent = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-top: 12px;">
        <div style="display: flex; flex-direction: column; gap: 4px;">
          ${logoHtml}
          <h1 style="font-size: 22px; font-weight: 300; letter-spacing: 0.1em; color: #1e293b; text-transform: uppercase; margin: 12px 0 0 0;">${business.name}</h1>
          <p style="font-size: 11px; color: #64748b; margin: 0; white-space: pre-line;">${business.address}</p>
          ${business.gstin ? `<p style="font-size: 11px; color: #64748b; margin: 0;">GST: ${business.gstin}</p>` : ''}
        </div>
        <div style="text-align: right; display: flex; flex-direction: column; gap: 4px;">
          <h2 style="font-size: 18px; font-weight: 300; letter-spacing: 0.05em; color: #94a3b8; margin: 0 0 4px 0;">INVOICE</h2>
          <p style="font-size: 12px; margin: 0; font-weight: 500;">#${invoice?.invoice_number || 'DRAFT'}</p>
          <p style="font-size: 11px; color: #64748b; margin: 0;">Date: ${formatDate(invoice?.invoice_date || new Date())}</p>
          ${invoice?.due_date ? `<p style="font-size: 11px; color: #64748b; margin: 0;">Due: ${formatDate(invoice.due_date)}</p>` : ''}
        </div>
      </div>

      <div style="border-top: 1px solid #f1f5f9; border-bottom: 1px solid #f1f5f9; padding: 12px 0; margin-top: 24px; display: grid; grid-template-columns: 1fr 1fr; font-size: 12px;">
        <div>
          <span style="color: #94a3b8; font-size: 10px; display: block; margin-bottom: 2px;">BILLED TO</span>
          <p style="font-weight: bold; margin: 0;">${invoice?.owner?.name || invoice?.company_name || 'N/A'}</p>
          <p style="color: #64748b; margin: 0;">${invoice?.owner ? `Email: ${invoice.owner.email}` : `ID: ${invoice?.company_id || 'N/A'}`}</p>
          ${invoice?.owner?.address ? `<p style="color: #64748b; margin: 2px 0 0 0;">Address: ${invoice.owner.address}</p>` : ''}
          ${invoice?.owner?.tax_number || invoice?.company_gst_number ? `<p style="color: #64748b; margin: 2px 0 0 0;">GST: ${invoice?.owner?.tax_number || invoice?.company_gst_number}</p>` : ''}
        </div>
        ${invoice?.billing_start_date ? `
          <div style="text-align: right;">
            <span style="color: #94a3b8; font-size: 10px; display: block; margin-bottom: 2px;">BILLING TIMEFRAME</span>
            <p style="color: #334155; margin: 0;">${formatDate(invoice.billing_start_date)} - ${formatDate(invoice.billing_end_date)}</p>
            ${invoice.payment_date ? `<p style="color: #16a34a; font-weight: 500; margin: 4px 0 0 0;">Paid On: ${formatDate(invoice.payment_date)}</p>` : ''}
          </div>
        ` : ''}
      </div>

      <table style="width: 100%; font-size: 12px; text-align: left; border-collapse: collapse; margin-top: 32px;">
        <thead>
          <tr style="border-bottom: 1px solid #cbd5e1;">
            <th style="padding: 8px 0; color: #94a3b8; font-weight: 500;">Service Description</th>
            <th style="padding: 8px 0; text-align: center; color: #94a3b8; font-weight: 500; width: 80px;">Seats</th>
            <th style="padding: 8px 0; text-align: right; color: #94a3b8; font-weight: 500; width: 110px;">Rate</th>
            <th style="padding: 8px 0; text-align: right; color: #94a3b8; font-weight: 500; width: 110px;">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 12px 0; color: #334155; font-weight: 500;">
              ${invoice?.plan_name || 'Desk Subscription Space'} ${invoice?.billing_type ? `(${invoice.billing_type})` : ''}
            </td>
            <td style="padding: 12px 0; text-align: center; color: #334155;">${invoice?.seats ?? 1}</td>
            <td style="padding: 12px 0; text-align: right; color: #334155;">${formatMoney(invoice?.price_per_seat ?? invoice?.subtotal)}</td>
            <td style="padding: 12px 0; text-align: right; color: #334155;">${formatMoney(invoice?.subtotal ?? 0)}</td>
          </tr>
        </tbody>
      </table>

      <div style="display: flex; justify-content: flex-end; margin-top: 20px;">
        <div style="width: 250px; font-size: 12px; line-height: 1.8;">
          <div style="display: flex; justify-content: space-between; color: #64748b;">
            <span>Subtotal</span>
            <span>${formatMoney(invoice?.subtotal ?? 0)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; color: #64748b; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px;">
            <span>GST (${invoice?.gst_rate ?? 18}%)</span>
            <span>${formatMoney(invoice?.gst_amount ?? 0)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 14px; color: #1e293b; padding-top: 4px;">
            <span>Amount Due</span>
            <span>${formatMoney(invoice?.total_amount ?? 0)}</span>
          </div>
        </div>
      </div>
    `;
  } else if (theme === 'corporate') {
    bodyContent = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div style="display: flex; align-items: center; gap: 16px;">
          ${logoHtml}
          <div>
            <h1 style="font-size: 24px; font-weight: bold; margin: 0; color: #0f172a;">${business.name}</h1>
            <p style="font-size: 11px; color: #475569; margin: 4px 0 0 0; white-space: pre-line;">${business.address}</p>
            <div style="font-size: 11px; color: #475569; margin-top: 4px;">
              ${business.phone ? `<span style="margin-right: 8px;">T: ${business.phone}</span>` : ''}
              ${business.email ? `<span style="margin-right: 8px;">E: ${business.email}</span>` : ''}
              ${business.website ? `<span>W: ${business.website}</span>` : ''}
            </div>
          </div>
        </div>
        <div style="text-align: right; border-left: 4px solid #0f172a; padding-left: 16px; display: flex; flex-direction: column; gap: 2px;">
          <h2 style="font-size: 16px; font-weight: 900; color: #0f172a; margin: 0; tracking: 0.05em; text-transform: uppercase;">OFFICIAL INVOICE</h2>
          <p style="font-size: 12px; margin: 0;"><strong>No:</strong> ${invoice?.invoice_number || 'DRAFT'}</p>
          <p style="font-size: 11px; margin: 0;"><strong>Date:</strong> ${formatDate(invoice?.invoice_date || new Date())}</p>
          ${invoice?.due_date ? `<p style="font-size: 11px; margin: 0;"><strong>Due Date:</strong> ${formatDate(invoice.due_date)}</p>` : ''}
          ${business.gstin ? `<p style="font-size: 10px; color: #64748b; font-family: monospace; margin: 4px 0 0 0;">GSTIN: ${business.gstin}</p>` : ''}
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; border-top: 1px solid #94a3b8; border-bottom: 1px solid #94a3b8; padding: 12px; margin-top: 24px; font-size: 12px; background-color: #f8fafc;">
        <div>
          <span style="font-weight: bold; color: #64748b; display: block; margin-bottom: 4px; font-size: 10px;">CLIENT INFORMATION:</span>
          <p style="font-weight: bold; color: #0f172a; margin: 0;">${invoice?.owner?.name || invoice?.company_name || 'N/A'}</p>
          <p style="color: #475569; margin: 0;">${invoice?.owner ? `Email: ${invoice.owner.email}` : `Client ID: ${invoice?.company_id || 'N/A'}`}</p>
          ${invoice?.owner?.address ? `<p style="color: #475569; margin: 2px 0 0 0;">Address: ${invoice.owner.address}</p>` : ''}
          ${invoice?.owner?.tax_number || invoice?.company_gst_number ? `<p style="color: #475569; margin: 2px 0 0 0;">GST: ${invoice?.owner?.tax_number || invoice?.company_gst_number}</p>` : ''}
        </div>
        ${invoice?.billing_start_date ? `
          <div style="text-align: right;">
            <span style="font-weight: bold; color: #64748b; display: block; margin-bottom: 4px; font-size: 10px;">BILLING SUMMARY:</span>
            <p style="margin: 0; color: #334155;"><strong>Period:</strong> ${formatDate(invoice.billing_start_date)} - ${formatDate(invoice.billing_end_date)}</p>
            <p style="margin: 0; color: #334155;"><strong>Terms:</strong> Net ${config.invoice?.dueDateOffset || 7} Days</p>
          </div>
        ` : ''}
      </div>

      <table style="width: 100%; font-size: 12px; text-align: left; border-collapse: collapse; border: 1px solid #94a3b8; margin-top: 24px;">
        <thead style="background-color: #1e293b; color: white; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em;">
          <tr>
            <th style="padding: 10px 8px; border: 1px solid #94a3b8;">Description of Service</th>
            <th style="padding: 10px 8px; border: 1px solid #94a3b8; text-align: center; width: 110px;">Quantity (Seats)</th>
            <th style="padding: 10px 8px; border: 1px solid #94a3b8; text-align: right; width: 110px;">Unit Price</th>
            <th style="padding: 10px 8px; border: 1px solid #94a3b8; text-align: right; width: 110px;">Subtotal Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding: 10px 8px; border: 1px solid #94a3b8; font-weight: 500; color: #0f172a;">
              ${invoice?.plan_name || 'Desk Workspace License'} ${invoice?.billing_type ? ` - Billing Cycle: ${invoice.billing_type}` : ''}
            </td>
            <td style="padding: 10px 8px; border: 1px solid #94a3b8; text-align: center; font-weight: bold; color: #0f172a;">${invoice?.seats ?? 1}</td>
            <td style="padding: 10px 8px; border: 1px solid #94a3b8; text-align: right; color: #0f172a;">${formatMoney(invoice?.price_per_seat ?? invoice?.subtotal)}</td>
            <td style="padding: 10px 8px; border: 1px solid #94a3b8; text-align: right; font-weight: bold; color: #0f172a;">${formatMoney(invoice?.subtotal ?? 0)}</td>
          </tr>
        </tbody>
      </table>

      <div style="display: flex; justify-content: flex-end; margin-top: 24px;">
        <table style="width: 280px; font-size: 12px; border-collapse: collapse; border: 1px solid #94a3b8; background-color: #f8fafc;">
          <tbody>
            <tr style="border-bottom: 1px solid #94a3b8;">
              <td style="padding: 8px; font-weight: 600; color: #475569;">Subtotal:</td>
              <td style="padding: 8px; text-align: right;">${formatMoney(invoice?.subtotal ?? 0)}</td>
            </tr>
            <tr style="border-bottom: 1px solid #94a3b8;">
              <td style="padding: 8px; font-weight: 600; color: #475569;">GST (${invoice?.gst_rate ?? 18}%):</td>
              <td style="padding: 8px; text-align: right;">${formatMoney(invoice?.gst_amount ?? 0)}</td>
            </tr>
            <tr style="background-color: #0f172a; color: white; font-weight: bold; font-size: 13px;">
              <td style="padding: 8px;">Grand Total:</td>
              <td style="padding: 8px; text-align: right;">${formatMoney(invoice?.total_amount ?? 0)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  }

  const paymentSectionHtml = '';

  const termsHtml = terms ? `
    <div style="font-size: 11px;">
      <h5 style="font-weight: bold; color: #1e293b; margin: 0 0 6px 0; text-transform: uppercase; letter-spacing: 0.05em;">TERMS & CONDITIONS</h5>
      <div style="color: #64748b; line-height: 1.5;">
        ${parseText(terms)}
      </div>
    </div>
  ` : '';

  const footerTextHtml = footer && footer.text ? `
    <div style="line-height: 1.5; color: #94a3b8;">
      ${parseText(footer.text)}
    </div>
  ` : '';

  const supportHtml = footer && (footer.supportEmail || footer.supportPhone) ? `
    <p style="margin: 4px 0 0 0; opacity: 0.9; color: #94a3b8;">
      ${footer.supportEmail ? `Email: ${footer.supportEmail}` : ''}
      ${footer.supportEmail && footer.supportPhone ? ' | ' : ''}
      ${footer.supportPhone ? `Phone: ${footer.supportPhone}` : ''}
    </p>
  ` : '';

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Invoice - ${invoice?.invoice_number || 'Details'}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            color: #334155;
            background-color: #ffffff;
            padding: 40px;
            max-width: 800px;
            margin: 0 auto;
          }
          a {
            color: #4f46e5;
            text-decoration: none;
          }
          a:hover {
            text-decoration: underline;
          }
          @media print {
            body {
              padding: 0;
            }
          }
        </style>
      </head>
      <body>
        <div style="display: flex; flex-direction: column; gap: 24px;">
          ${bodyContent}
          
          ${termsHtml ? `
            <div style="border-top: 1px solid #e2e8f0; padding-top: 24px; margin-top: 24px;">
              ${termsHtml}
            </div>
          ` : ''}
          
          ${footer ? `
            <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; margin-top: 32px; text-align: center; font-size: 10px; color: #94a3b8;">
              ${footerTextHtml}
              ${footer.copyright ? `<p style="font-weight: 500; margin: 4px 0 0 0;">${footer.copyright}</p>` : ''}
              ${supportHtml}
            </div>
          ` : ''}
        </div>
      </body>
    </html>
  `;
}
