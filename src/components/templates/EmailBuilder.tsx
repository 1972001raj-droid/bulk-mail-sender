"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  MousePointer,
  Image as ImageIcon,
  Columns,
  Minus,
  MoveVertical,
  Layers,
  Sparkles,
  Eye,
  Smartphone,
  Monitor,
  Code,
  Save,
  X,
  Trash2,
  Copy,
  ArrowUp,
  ArrowDown,
  GripVertical,
  Check,
  Plus,
  Tag,
  Palette,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  HelpCircle,
  Quote,
  Mail,
  Archive,
  Star,
  Reply,
  MoreVertical,
  Printer,
  Sun,
  Moon,
  User,
  ShieldCheck,
  Clock,
  Send,
  AlertOctagon,
  FolderInput,
  CheckSquare,
  ChevronLeft
} from "lucide-react";

export type BlockType =
  | "heading"
  | "paragraph"
  | "button"
  | "image"
  | "columns_2"
  | "callout"
  | "divider"
  | "spacer"
  | "footer";

export interface EmailBlock {
  id: string;
  type: BlockType;
  content: Record<string, any>;
}

export interface SampleRecipient {
  id: string;
  name: string;
  email: string;
  firstName: string;
  lastName: string;
  company: string;
  title: string;
  city: string;
}

export const SAMPLE_RECIPIENTS: SampleRecipient[] = [
  {
    id: "sarah",
    name: "Sarah Connor",
    email: "sarah.connor@techflow.io",
    firstName: "Sarah",
    lastName: "Connor",
    company: "TechFlow",
    title: "CEO & Founder",
    city: "San Francisco"
  },
  {
    id: "david",
    name: "David Miller",
    email: "david.miller@stripe.com",
    firstName: "David",
    lastName: "Miller",
    company: "Stripe",
    title: "VP Sales",
    city: "New York"
  },
  {
    id: "elena",
    name: "Elena Rostova",
    email: "elena@datadog.com",
    firstName: "Elena",
    lastName: "Rostova",
    company: "DataDog",
    title: "Head of Growth",
    city: "Austin"
  }
];

export function resolveTokens(text: string, recipient: SampleRecipient | null): string {
  if (!text) return "";
  if (!recipient) return text;

  return text.replace(
    /\{\{\s*([a-zA-Z0-9_]+)(?:\s*\|\s*(?:"([^"]*)"|'([^']*)'))?\s*\}\}/g,
    (_match, key, fallback1, fallback2) => {
      const fallback = fallback1 ?? fallback2 ?? "";
      const val = (recipient as any)[key];
      if (val !== undefined && val !== null && String(val).trim() !== "") {
        return String(val);
      }
      return fallback;
    }
  );
}

interface EmailBuilderProps {
  initialName?: string;
  initialSubject?: string;
  initialHtml?: string;
  initialBlocks?: EmailBlock[];
  onSave: (data: { name: string; subject: string; htmlBody: string; textBody: string }) => Promise<void>;
  onClose?: () => void;
}

// Starter Templates (Canva/WordPress style)
const STARTER_TEMPLATES: Array<{
  id: string;
  name: string;
  subject: string;
  desc: string;
  blocks: EmailBlock[];
}> = [
  {
    id: "cold-outreach",
    name: "B2B SaaS Founder Outreach",
    subject: "Quick question regarding {{company}}'s outbound growth",
    desc: "High-converting personalized cold email with high reply rates",
    blocks: [
      {
        id: "b-1",
        type: "heading",
        content: {
          text: "Scaling {{company}}'s outreach engine in 2026",
          level: "h2",
          align: "left"
        }
      },
      {
        id: "b-2",
        type: "paragraph",
        content: {
          text: "Hi {{firstName | \"there\"}},<br/><br/>I noticed {{company}} has been expanding rapidly and wanted to share a proven strategy that helps high-growth B2B teams book 3x more discovery calls directly from their existing Google/Microsoft inboxes.",
          align: "left",
          fontSize: 15
        }
      },
      {
        id: "b-3",
        type: "callout",
        content: {
          title: "Quick Insight for {{company}}",
          text: "Most cold outreach suffers from low deliverability because it uses generic SMTP relays. Sending through verified inboxes with automatic reply detection boosts open rates to 65%+.",
          borderColor: "#6366f1"
        }
      },
      {
        id: "b-4",
        type: "paragraph",
        content: {
          text: "Would you have 10 minutes next Tuesday or Thursday for a quick coffee chat? If you're open to it, you can grab a slot below:",
          align: "left",
          fontSize: 15
        }
      },
      {
        id: "b-5",
        type: "button",
        content: {
          text: "Book 10-Min Intro Call →",
          url: "https://calendly.com",
          align: "left",
          bgColor: "#4f46e5",
          textColor: "#ffffff",
          borderRadius: 8
        }
      },
      {
        id: "b-6",
        type: "divider",
        content: { margin: 20 }
      },
      {
        id: "b-7",
        type: "footer",
        content: {
          companyText: "AeroSend Outreach Labs • 500 Howard St, San Francisco, CA",
          unsubscribeText: "If you'd prefer not to hear from me, click here to unsubscribe.",
          align: "left"
        }
      }
    ]
  },
  {
    id: "product-announcement",
    name: "Product Announcement & Launch",
    subject: "Introducing AeroSend 2.0: Next-Gen Outreach Engine",
    desc: "Feature launch with hero image, feature columns, and CTA",
    blocks: [
      {
        id: "p-1",
        type: "image",
        content: {
          url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&auto=format&fit=crop&q=80",
          alt: "Product Launch Banner",
          width: 100,
          align: "center"
        }
      },
      {
        id: "p-2",
        type: "heading",
        content: {
          text: "Meet the all-new AeroSend 2.0 🚀",
          level: "h1",
          align: "center"
        }
      },
      {
        id: "p-3",
        type: "paragraph",
        content: {
          text: "We've rebuilt the outreach engine from the ground up for {{company}}. Enjoy direct Resend integration, visual drag-and-drop builder, zero quota limits, and automated follow-ups.",
          align: "center",
          fontSize: 16
        }
      },
      {
        id: "p-4",
        type: "button",
        content: {
          text: "Explore What's New",
          url: "https://aerosend.dev",
          align: "center",
          bgColor: "#4f46e5",
          textColor: "#ffffff",
          borderRadius: 12
        }
      },
      {
        id: "p-5",
        type: "columns_2",
        content: {
          col1Title: "⚡ Direct Resend API",
          col1Text: "Connect with just your API key. Zero complicated SMTP server hostnames or port configurations.",
          col2Title: "🎨 Drag & Drop Design",
          col2Text: "Build Canva-grade personalized email templates with live mobile and desktop previews."
        }
      },
      {
        id: "p-6",
        type: "footer",
        content: {
          companyText: "AeroSend Technologies Inc. • Sent to {{firstName}} at {{company}}",
          unsubscribeText: "Unsubscribe from future announcements",
          align: "center"
        }
      }
    ]
  },
  {
    id: "check-in",
    name: "Friendly Follow-Up & Check-in",
    subject: "Re: Quick question regarding {{company}}",
    desc: "Gentle follow-up note that stops automatically if they reply",
    blocks: [
      {
        id: "f-1",
        type: "paragraph",
        content: {
          text: "Hi {{firstName}},<br/><br/>I know you're super busy steering growth at {{company}}. I'm just following up on my note from last week to see if you had 5 minutes to connect?",
          align: "left",
          fontSize: 15
        }
      },
      {
        id: "f-2",
        type: "callout",
        content: {
          title: "Quick Recap",
          text: "We help teams personalize outreach at scale and achieve 3x higher open rates by sending through verified domains.",
          borderColor: "#3b82f6"
        }
      },
      {
        id: "f-3",
        type: "paragraph",
        content: {
          text: "If now isn't the right time, no worries at all! Just let me know if we should circle back next quarter.<br/><br/>Best regards,<br/><strong>Alex Vance</strong><br/>Acme Growth Labs",
          align: "left",
          fontSize: 15
        }
      },
      {
        id: "f-4",
        type: "footer",
        content: {
          companyText: "AeroSend • Sent to {{company}}",
          unsubscribeText: "Click here to stop receiving follow-ups",
          align: "left"
        }
      }
    ]
  }
];

export function generateEmailHtml(blocks: EmailBlock[], theme: "light" | "dark" = "light"): string {
  const isLight = theme === "light";
  const bodyBg = isLight ? "#f4f4f5" : "#0b0f19";
  const tableBg = isLight ? "#ffffff" : "#0f172a";
  const borderColor = isLight ? "#e4e4e7" : "#1e293b";

  const renderedBlocks = blocks
    .map((b) => {
      switch (b.type) {
        case "heading": {
          const tag = b.content.level || "h2";
          const fontSize = tag === "h1" ? "26px" : tag === "h2" ? "20px" : "17px";
          const headingColor =
            b.content.color && b.content.color !== "#ffffff" && b.content.color !== "#0f172a"
              ? b.content.color
              : isLight
              ? "#0f172a"
              : "#ffffff";
          return `
            <tr>
              <td align="${b.content.align || "left"}" style="padding: 18px 24px 8px 24px;">
                <${tag} style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: ${fontSize}; font-weight: 700; color: ${headingColor}; line-height: 1.35; letter-spacing: -0.02em;">
                  ${b.content.text || ""}
                </${tag}>
              </td>
            </tr>`;
        }
        case "paragraph": {
          const pColor =
            b.content.color && b.content.color !== "#cbd5e1" && b.content.color !== "#334155"
              ? b.content.color
              : isLight
              ? "#334155"
              : "#cbd5e1";
          return `
            <tr>
              <td align="${b.content.align || "left"}" style="padding: 10px 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: ${b.content.fontSize || 15}px; line-height: 1.65; color: ${pColor};">
                ${b.content.text || ""}
              </td>
            </tr>`;
        }
        case "button": {
          return `
            <tr>
              <td align="${b.content.align || "left"}" style="padding: 16px 24px;">
                <table border="0" cellpadding="0" cellspacing="0" style="margin: ${b.content.align === "center" ? "0 auto" : b.content.align === "right" ? "0 0 0 auto" : "0"};">
                  <tr>
                    <td align="center" style="background-color: ${b.content.bgColor || "#4f46e5"}; border-radius: ${b.content.borderRadius || 8}px;">
                      <a href="${b.content.url || "https://"}" target="_blank" style="display: inline-block; padding: 12px 28px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; font-weight: 600; color: ${b.content.textColor || "#ffffff"}; text-decoration: none; border-radius: ${b.content.borderRadius || 8}px;">
                        ${b.content.text || "Click Here"}
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>`;
        }
        case "image": {
          return `
            <tr>
              <td align="${b.content.align || "center"}" style="padding: 12px 24px;">
                <img src="${b.content.url || ""}" alt="${b.content.alt || ""}" style="max-width: 100%; width: ${b.content.width || 100}%; height: auto; display: block; border-radius: 8px;" />
              </td>
            </tr>`;
        }
        case "columns_2": {
          const colBg = isLight ? "#f8fafc" : (b.content.bgColor || "#1e293b");
          const colBorder = isLight ? "#e2e8f0" : "#334155";
          const titleColor = isLight ? "#0f172a" : "#ffffff";
          const descColor = isLight ? "#475569" : "#94a3b8";
          return `
            <tr>
              <td style="padding: 12px 24px;">
                <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: ${colBg}; border: 1px solid ${colBorder}; border-radius: 12px; padding: 16px;">
                  <tr>
                    <td width="48%" valign="top" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; color: ${descColor}; line-height: 1.5; padding-right: 12px;">
                      <strong style="color: ${titleColor}; font-size: 14px; display: block; margin-bottom: 6px;">${b.content.col1Title || ""}</strong>
                      ${b.content.col1Text || ""}
                    </td>
                    <td width="4%" style="border-left: 1px solid ${colBorder};">&nbsp;</td>
                    <td width="48%" valign="top" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; color: ${descColor}; line-height: 1.5; padding-left: 12px;">
                      <strong style="color: ${titleColor}; font-size: 14px; display: block; margin-bottom: 6px;">${b.content.col2Title || ""}</strong>
                      ${b.content.col2Text || ""}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>`;
        }
        case "callout": {
          const calloutBg = isLight ? "#f8fafc" : (b.content.bgColor || "#1e1b4b");
          const calloutBorder = b.content.borderColor || "#6366f1";
          const titleColor = isLight ? "#0f172a" : "#ffffff";
          const textColor = isLight ? "#334155" : "#cbd5e1";
          return `
            <tr>
              <td style="padding: 12px 24px;">
                <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: ${calloutBg}; border-left: 4px solid ${calloutBorder}; border-radius: 8px; padding: 16px;">
                  <tr>
                    <td style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; color: ${textColor}; line-height: 1.55;">
                      ${b.content.title ? `<strong style="color: ${titleColor}; display: block; margin-bottom: 6px;">${b.content.title}</strong>` : ""}
                      ${b.content.text || ""}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>`;
        }
        case "divider": {
          const divColor = isLight ? "#e2e8f0" : (b.content.color || "#334155");
          return `
            <tr>
              <td style="padding: ${b.content.margin || 16}px 24px;">
                <hr style="border: none; border-top: 1px solid ${divColor}; margin: 0;" />
              </td>
            </tr>`;
        }
        case "spacer": {
          return `
            <tr>
              <td height="${b.content.height || 24}" style="line-height: ${b.content.height || 24}px; font-size: 0px;">&nbsp;</td>
            </tr>`;
        }
        case "footer": {
          const footerColor = isLight ? "#64748b" : "#94a3b8";
          const linkColor = isLight ? "#4f46e5" : "#818cf8";
          return `
            <tr>
              <td align="${b.content.align || "center"}" style="padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 11px; color: ${footerColor}; line-height: 1.6;">
                <div>${b.content.companyText || ""}</div>
                ${b.content.unsubscribeText ? `<div style="margin-top: 6px;"><a href="{{unsubscribeUrl}}" style="color: ${linkColor}; text-decoration: underline;">${b.content.unsubscribeText}</a></div>` : ""}
              </td>
            </tr>`;
        }
        default:
          return "";
      }
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Outreach Email</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${bodyBg}; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
  <center style="width: 100%; background-color: ${bodyBg}; padding: 24px 0;">
    <table width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: ${tableBg}; border-radius: 12px; overflow: hidden; border: 1px solid ${borderColor};">
      ${renderedBlocks}
    </table>
  </center>
</body>
</html>`;
}

export function EmailBuilder({
  initialName = "New Email Template",
  initialSubject = "Quick note regarding {{company}}",
  initialBlocks,
  onSave,
  onClose
}: EmailBuilderProps) {
  const [templateName, setTemplateName] = useState(initialName);
  const [subject, setSubject] = useState(initialSubject);
  const [blocks, setBlocks] = useState<EmailBlock[]>(
    initialBlocks && initialBlocks.length > 0
      ? initialBlocks
      : STARTER_TEMPLATES[0].blocks
  );

  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(
    blocks[0]?.id || null
  );

  // Client & Simulation view controls
  const [clientType, setClientType] = useState<"gmail" | "apple" | "iphone">("gmail");
  const [canvasTheme, setCanvasTheme] = useState<"light" | "dark">("light");
  const [activeRecipient, setActiveRecipient] = useState<SampleRecipient | null>(SAMPLE_RECIPIENTS[0]);
  const [showRecipientDropdown, setShowRecipientDropdown] = useState(false);
  const [showEmailDetails, setShowEmailDetails] = useState(false);
  const [isStarred, setIsStarred] = useState(false);

  const [viewCode, setViewCode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Drag and drop state
  const [draggedBlockIndex, setDraggedBlockIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const selectedBlock = blocks.find((b) => b.id === selectedBlockId);

  // Add block
  const handleAddBlock = (type: BlockType) => {
    const newBlock: EmailBlock = {
      id: `block_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type,
      content: getDefaultBlockContent(type, canvasTheme)
    };
    setBlocks((prev) => [...prev, newBlock]);
    setSelectedBlockId(newBlock.id);
  };

  // Reordering blocks
  const handleMoveBlock = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= blocks.length) return;

    const updated = [...blocks];
    const [moved] = updated.splice(index, 1);
    updated.splice(newIndex, 0, moved);
    setBlocks(updated);
  };

  const handleDuplicateBlock = (index: number) => {
    const source = blocks[index];
    const duplicated: EmailBlock = {
      id: `block_${Date.now()}`,
      type: source.type,
      content: JSON.parse(JSON.stringify(source.content))
    };
    const updated = [...blocks];
    updated.splice(index + 1, 0, duplicated);
    setBlocks(updated);
    setSelectedBlockId(duplicated.id);
  };

  const handleDeleteBlock = (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    if (selectedBlockId === id) {
      setSelectedBlockId(null);
    }
  };

  const handleUpdateBlockContent = (id: string, key: string, value: any) => {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== id) return b;
        return {
          ...b,
          content: {
            ...b.content,
            [key]: value
          }
        };
      })
    );
  };

  // Drag events
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedBlockIndex(index);
    e.dataTransfer.setData("text/plain", `${index}`);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedBlockIndex === null || draggedBlockIndex === index) return;
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedBlockIndex === null) return;
    const updated = [...blocks];
    const [moved] = updated.splice(draggedBlockIndex, 1);
    updated.splice(index, 0, moved);
    setBlocks(updated);
    setDraggedBlockIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedBlockIndex(null);
    setDragOverIndex(null);
  };

  // Load starter template
  const handleLoadStarter = (templateId: string) => {
    const found = STARTER_TEMPLATES.find((t) => t.id === templateId);
    if (found) {
      setSubject(found.subject);
      setBlocks(JSON.parse(JSON.stringify(found.blocks)));
      setSelectedBlockId(found.blocks[0]?.id || null);
    }
  };

  // Insert token into selected block
  const handleInsertToken = (token: string) => {
    if (!selectedBlock) {
      setSubject((prev) => `${prev} {{${token}}}`);
      return;
    }

    if (selectedBlock.type === "heading" || selectedBlock.type === "paragraph") {
      const currentText = selectedBlock.content.text || "";
      handleUpdateBlockContent(selectedBlock.id, "text", `${currentText} {{${token}}}`);
    } else {
      setSubject((prev) => `${prev} {{${token}}}`);
    }
  };

  // Save handler
  const handleSave = async () => {
    setSaving(true);
    try {
      const htmlBody = generateEmailHtml(blocks, canvasTheme);
      const textBody = JSON.stringify({ blocks });
      await onSave({
        name: templateName,
        subject,
        htmlBody,
        textBody
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const resolvedSubject = resolveTokens(subject, activeRecipient);
  const isLight = canvasTheme === "light";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#080d1a] text-slate-100 animate-in fade-in select-none">
      {/* 1. TOP STUDIO TOOLBAR */}
      <header className="h-16 px-5 border-b border-slate-800 bg-[#090e1f] flex items-center justify-between gap-4 shrink-0 shadow-md">
        {/* Left: Template Name & Subject */}
        <div className="flex items-center gap-3">
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              title="Close Builder"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          <div className="flex flex-col">
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              className="text-sm font-bold text-white bg-transparent border-b border-transparent hover:border-slate-700 focus:border-indigo-500 focus:outline-none px-1 py-0.5 w-60"
              placeholder="Template Name"
            />
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
              <span className="text-[11px] font-medium text-slate-500">Subject:</span>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="text-xs text-slate-300 bg-transparent border-b border-transparent hover:border-slate-700 focus:border-indigo-500 focus:outline-none px-1 py-0.2 w-72 truncate"
                placeholder="Email Subject Line (e.g. Quick note for {{company}})"
              />
            </div>
          </div>
        </div>

        {/* Center: Inbox Client & Theme Simulation Toggles */}
        <div className="flex items-center gap-2">
          {/* Client Switcher */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => {
                setClientType("gmail");
                setViewCode(false);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                clientType === "gmail" && !viewCode
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Gmail</span>
            </button>
            <button
              onClick={() => {
                setClientType("apple");
                setViewCode(false);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                clientType === "apple" && !viewCode
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>Apple Mail</span>
            </button>
            <button
              onClick={() => {
                setClientType("iphone");
                setViewCode(false);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                clientType === "iphone" && !viewCode
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>iPhone</span>
            </button>
          </div>

          {/* Light / Dark Email Paper Toggle */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setCanvasTheme("light")}
              title="Light Email Paper (Standard recipient inbox)"
              className={`p-1.5 rounded-lg transition-all ${
                isLight ? "bg-amber-500/20 text-amber-300 font-semibold" : "text-slate-400 hover:text-white"
              }`}
            >
              <Sun className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setCanvasTheme("dark")}
              title="Dark Mode Email Client"
              className={`p-1.5 rounded-lg transition-all ${
                !isLight ? "bg-indigo-500/20 text-indigo-300 font-semibold" : "text-slate-400 hover:text-white"
              }`}
            >
              <Moon className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* HTML Code View Toggle */}
          <button
            onClick={() => setViewCode(!viewCode)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
              viewCode
                ? "bg-indigo-600 text-white border-indigo-500"
                : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>HTML</span>
          </button>
        </div>

        {/* Right: "Preview as Recipient" + Starters + Save */}
        <div className="flex items-center gap-3">
          {/* Recipient Personalization Switcher */}
          <div className="relative">
            <button
              onClick={() => setShowRecipientDropdown(!showRecipientDropdown)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-indigo-500/50 text-xs text-slate-200 transition-all shadow-sm"
              title="Preview how email looks for specific recipient"
            >
              <User className="w-3.5 h-3.5 text-indigo-400" />
              <span className="font-medium">
                {activeRecipient ? activeRecipient.name : "Raw Tokens Mode"}
              </span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {showRecipientDropdown && (
              <div className="absolute right-0 top-full mt-2 w-64 p-2 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl space-y-1 z-50">
                <div className="px-2 py-1 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                  Preview as Recipient
                </div>
                {SAMPLE_RECIPIENTS.map((rec) => (
                  <button
                    key={rec.id}
                    onClick={() => {
                      setActiveRecipient(rec);
                      setShowRecipientDropdown(false);
                    }}
                    className={`w-full text-left p-2 rounded-xl text-xs flex flex-col transition-all ${
                      activeRecipient?.id === rec.id
                        ? "bg-indigo-600 text-white"
                        : "hover:bg-slate-800 text-slate-300"
                    }`}
                  >
                    <span className="font-semibold">{rec.name}</span>
                    <span className={`text-[10px] ${activeRecipient?.id === rec.id ? "text-indigo-200" : "text-slate-400"}`}>
                      {rec.title} • {rec.company}
                    </span>
                  </button>
                ))}

                <div className="pt-1 border-t border-slate-800">
                  <button
                    onClick={() => {
                      setActiveRecipient(null);
                      setShowRecipientDropdown(false);
                    }}
                    className={`w-full text-left p-2 rounded-xl text-xs flex flex-col transition-all ${
                      activeRecipient === null
                        ? "bg-indigo-600 text-white"
                        : "hover:bg-slate-800 text-slate-300"
                    }`}
                  >
                    <span className="font-semibold">Raw Tokens (Edit Mode)</span>
                    <span className={`text-[10px] ${activeRecipient === null ? "text-indigo-200" : "text-slate-400"}`}>
                      Show raw &#123;&#123;company&#125;&#125; and &#123;&#123;firstName&#125;&#125;
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Starter Templates Dropdown */}
          <div className="relative group">
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-semibold text-slate-300">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Starter Templates</span>
            </button>

            <div className="absolute right-0 top-full mt-2 w-64 p-2 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl space-y-1 hidden group-hover:block z-50">
              <div className="px-2 py-1 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                Pre-built Designs
              </div>
              {STARTER_TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.id}
                  onClick={() => handleLoadStarter(tmpl.id)}
                  className="w-full text-left p-2 rounded-xl hover:bg-slate-800 text-xs text-slate-300 transition-colors flex flex-col"
                >
                  <span className="font-semibold text-white">{tmpl.name}</span>
                  <span className="text-[10px] text-slate-400">{tmpl.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-semibold text-xs shadow-lg shadow-indigo-600/30 transition-all active:scale-95 disabled:opacity-50"
          >
            {saving ? (
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : saveSuccess ? (
              <Check className="w-3.5 h-3.5 text-emerald-300" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>{saveSuccess ? "Saved!" : "Save Template"}</span>
          </button>
        </div>
      </header>

      {/* 2. MAIN 3-PANE WORKSPACE */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT PALETTE: BLOCKS & TOKENS */}
        <aside className="w-72 border-r border-slate-800/80 bg-[#090e1f] p-4 overflow-y-auto space-y-5 shrink-0">
          <div>
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              <span>Email Blocks</span>
            </h3>
            <p className="text-[11px] text-slate-500">
              Drag onto canvas or click to append to your template.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              { type: "heading", label: "Heading", icon: Type },
              { type: "paragraph", label: "Text", icon: AlignLeft },
              { type: "button", label: "Button", icon: MousePointer },
              { type: "image", label: "Image", icon: ImageIcon },
              { type: "columns_2", label: "2 Columns", icon: Columns },
              { type: "callout", label: "Callout", icon: Quote },
              { type: "divider", label: "Divider", icon: Minus },
              { type: "spacer", label: "Spacer", icon: MoveVertical },
              { type: "footer", label: "Footer", icon: HelpCircle }
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.type}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("newBlockType", item.type);
                  }}
                  onClick={() => handleAddBlock(item.type as BlockType)}
                  className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-900 cursor-grab active:cursor-grabbing transition-all flex flex-col items-center text-center group"
                >
                  <Icon className="w-5 h-5 text-indigo-400 group-hover:scale-110 transition-transform mb-1.5" />
                  <span className="text-xs font-medium text-slate-300 group-hover:text-white">
                    {item.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Quick Tokens Guide */}
          <div className="pt-4 border-t border-slate-800/80 space-y-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Tag className="w-3 h-3 text-indigo-400" /> Variable Tokens
            </span>
            <p className="text-[10px] text-slate-500">
              Click to append into subject line or active block.
            </p>
            <div className="flex flex-wrap gap-1 text-[10px]">
              {["firstName", "lastName", "company", "title", "city"].map((t) => (
                <button
                  key={t}
                  onClick={() => handleInsertToken(t)}
                  className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 hover:border-indigo-500 text-indigo-300 font-mono"
                  title="Click to insert"
                >
                  &#123;&#123;{t}&#125;&#125;
                </button>
              ))}
            </div>
          </div>

          {/* Recipient Preview Status */}
          <div className="p-3 rounded-xl bg-indigo-950/20 border border-indigo-500/30 text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-indigo-300">
              <Eye className="w-3.5 h-3.5" />
              <span>Inbox Simulation</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              {activeRecipient ? (
                <>
                  Viewing as <strong className="text-white">{activeRecipient.name}</strong> ({activeRecipient.company}). All tokens dynamically filled.
                </>
              ) : (
                <>Viewing in raw token mode. Variables will show bracket syntax.</>
              )}
            </p>
          </div>
        </aside>

        {/* CENTER CANVAS: INBOX SIMULATION */}
        <main
          className="flex-1 bg-[#050811] p-6 overflow-y-auto flex items-start justify-center"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            const newType = e.dataTransfer.getData("newBlockType") as BlockType;
            if (newType) {
              handleAddBlock(newType);
            }
          }}
        >
          {viewCode ? (
            /* RAW HTML CODE VIEW */
            <div className="w-full max-w-4xl bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-2xl font-mono text-xs text-indigo-300 overflow-x-auto space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <span className="text-slate-400 font-sans font-semibold">Compiled Email HTML Output</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(generateEmailHtml(blocks, canvasTheme));
                    alert("HTML copied to clipboard!");
                  }}
                  className="px-3 py-1 rounded-lg bg-indigo-600 text-white text-xs font-sans font-semibold"
                >
                  Copy HTML
                </button>
              </div>
              <pre className="whitespace-pre-wrap">{generateEmailHtml(blocks, canvasTheme)}</pre>
            </div>
          ) : clientType === "iphone" ? (
            /* ========================================================= */
            /* IPHONE / MOBILE INBOX SIMULATION                          */
            /* ========================================================= */
            <div className="w-[390px] rounded-[52px] bg-black border-4 border-slate-800 p-3.5 shadow-2xl relative shadow-black/80 flex flex-col shrink-0 my-4">
              {/* iPhone Dynamic Island & Speaker */}
              <div className="w-full flex justify-center items-center pt-2 pb-1 relative z-20">
                <div className="w-28 h-7 bg-black rounded-full border border-slate-900 flex items-center justify-between px-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-950 border border-slate-800" />
                  <div className="w-2 h-2 rounded-full bg-indigo-950/60" />
                </div>
              </div>

              {/* iOS Status Bar */}
              <div className="flex items-center justify-between px-6 pt-1 text-[11px] font-semibold text-slate-300 select-none">
                <span>9:41</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold">5G</span>
                  <div className="w-5 h-2.5 rounded-sm border border-slate-400 p-0.5 flex items-center">
                    <div className="w-full h-full bg-slate-300 rounded-[1px]" />
                  </div>
                </div>
              </div>

              {/* iOS Mail Top Bar */}
              <div className="px-4 py-2 border-b border-slate-800 flex items-center justify-between text-xs text-indigo-400">
                <div className="flex items-center gap-1 cursor-pointer">
                  <ChevronLeft className="w-4 h-4" />
                  <span className="font-medium">Inbox</span>
                </div>
                <div className="flex items-center gap-3 text-slate-400">
                  <ChevronDown className="w-4 h-4" />
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>

              {/* iOS Email Header */}
              <div className={`p-4 border-b ${isLight ? "bg-white border-slate-200" : "bg-slate-900 border-slate-800"} rounded-t-2xl mt-2`}>
                <h2 className={`text-base font-bold leading-snug ${isLight ? "text-slate-900" : "text-white"}`}>
                  {resolvedSubject || "Untitled Outreach Email"}
                </h2>

                <div className="flex items-center gap-3 mt-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 text-white font-bold flex items-center justify-center text-xs shadow">
                    AV
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold truncate ${isLight ? "text-slate-900" : "text-white"}`}>
                        Alex Vance
                      </span>
                      <span className="text-[10px] text-slate-400">10:42 AM</span>
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">
                      To: {activeRecipient ? activeRecipient.name : "Recipient"}
                    </div>
                  </div>
                </div>
              </div>

              {/* iOS Email Body Canvas */}
              <div
                className={`max-h-[520px] overflow-y-auto divide-y ${
                  isLight ? "bg-white divide-slate-100" : "bg-[#0f172a] divide-slate-800/40"
                } rounded-b-2xl`}
              >
                {blocks.map((block, index) => (
                  <div
                    key={block.id}
                    onClick={() => setSelectedBlockId(block.id)}
                    className={`relative group cursor-pointer transition-all ${
                      selectedBlockId === block.id
                        ? "ring-2 ring-indigo-500"
                        : isLight
                        ? "hover:bg-slate-50"
                        : "hover:bg-slate-800/30"
                    }`}
                  >
                    <div className="p-3">
                      <CanvasBlockRender
                        block={block}
                        recipient={activeRecipient}
                        isLight={isLight}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* iOS Mail Bottom Toolbar */}
              <div className="pt-3 pb-1 px-6 flex items-center justify-between text-slate-400 border-t border-slate-800/80 mt-2">
                <Trash2 className="w-4 h-4 hover:text-white cursor-pointer" />
                <FolderInput className="w-4 h-4 hover:text-white cursor-pointer" />
                <Reply className="w-4 h-4 hover:text-white cursor-pointer" />
                <Send className="w-4 h-4 hover:text-white cursor-pointer" />
              </div>
            </div>
          ) : (
            /* ========================================================= */
            /* DESKTOP INBOX CLIENT SIMULATION (GMAIL / APPLE MAIL)      */
            /* ========================================================= */
            <div className="w-full max-w-[760px] rounded-2xl overflow-hidden border border-slate-800 shadow-2xl bg-slate-900/90 flex flex-col shrink-0 my-2">
              {/* TOP CLIENT CHROME BAR */}
              {clientType === "apple" ? (
                /* APPLE MAIL MAC OS BAR */
                <div className="h-10 px-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between select-none">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#ff5f56] inline-block" />
                    <span className="w-3 h-3 rounded-full bg-[#ffbd2e] inline-block" />
                    <span className="w-3 h-3 rounded-full bg-[#27c93f] inline-block" />
                  </div>
                  <div className="text-xs text-slate-400 font-medium">
                    Mail — Inboxes (AeroSend)
                  </div>
                  <div className="flex items-center gap-3 text-slate-400 text-xs">
                    <Reply className="w-3.5 h-3.5" />
                    <Trash2 className="w-3.5 h-3.5" />
                    <Archive className="w-3.5 h-3.5" />
                  </div>
                </div>
              ) : (
                /* GMAIL ACTION BAR */
                <div className="h-12 px-4 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between text-slate-400 text-xs select-none">
                  {/* Left Action Icons */}
                  <div className="flex items-center gap-4">
                    <button className="hover:text-white p-1" title="Back to Inbox">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <div className="h-4 w-px bg-slate-800" />
                    <button className="hover:text-white p-1" title="Archive">
                      <Archive className="w-4 h-4" />
                    </button>
                    <button className="hover:text-white p-1" title="Report spam">
                      <AlertOctagon className="w-4 h-4" />
                    </button>
                    <button className="hover:text-white p-1" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <div className="h-4 w-px bg-slate-800" />
                    <button className="hover:text-white p-1" title="Mark as unread">
                      <Mail className="w-4 h-4" />
                    </button>
                    <button className="hover:text-white p-1" title="Snooze">
                      <Clock className="w-4 h-4" />
                    </button>
                    <button className="hover:text-white p-1" title="Move to">
                      <FolderInput className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Right Pagination & Pop-out */}
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-slate-500">1 of 42</span>
                    <button className="hover:text-white p-1" title="Print all">
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                    <button className="hover:text-white p-1" title="In new window">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* INBOX EMAIL HEADER */}
              <div className="p-6 bg-slate-950/60 border-b border-slate-800">
                {/* Subject Title */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h1 className="text-xl font-bold text-white tracking-tight">
                      {resolvedSubject || "Untitled Outreach Email"}
                    </h1>
                    <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] text-slate-300 font-medium">
                      Inbox
                    </span>
                    <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-300 font-medium flex items-center gap-1">
                      <Star className="w-2.5 h-2.5 fill-amber-300" /> Important
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-slate-400">
                    <button
                      onClick={() => setIsStarred(!isStarred)}
                      className={`p-1 hover:text-amber-400 transition-colors ${
                        isStarred ? "text-amber-400 fill-amber-400" : ""
                      }`}
                      title="Star email"
                    >
                      <Star className={`w-4 h-4 ${isStarred ? "fill-amber-400" : ""}`} />
                    </button>
                    <button className="p-1 hover:text-white" title="Reply">
                      <Reply className="w-4 h-4" />
                    </button>
                    <button className="p-1 hover:text-white" title="More options">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Sender & Recipient Details */}
                <div className="mt-4 flex items-start gap-3">
                  {/* Sender Avatar */}
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-white font-bold flex items-center justify-center text-sm shadow-md shrink-0">
                    AV
                  </div>

                  {/* Metadata */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">Alex Vance</span>
                        <span className="text-xs text-slate-400">&lt;alex@aerosend.io&gt;</span>
                      </div>
                      <span className="text-xs text-slate-400">
                        Today at 10:42 AM (1 hour ago)
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-400">
                      <span>to {activeRecipient ? activeRecipient.email : "sarah.connor@techflow.io"}</span>
                      <button
                        onClick={() => setShowEmailDetails(!showEmailDetails)}
                        className="p-0.5 hover:text-white text-slate-500"
                        title="Show security and delivery details"
                      >
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Expandable Gmail Security / Headers Panel */}
                    {showEmailDetails && (
                      <div className="mt-3 p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-1.5 font-mono text-slate-300 animate-in fade-in">
                        <div>
                          <strong className="text-slate-400 font-sans">from:</strong> Alex Vance &lt;alex@aerosend.io&gt;
                        </div>
                        <div>
                          <strong className="text-slate-400 font-sans">to:</strong> {activeRecipient ? `${activeRecipient.name} <${activeRecipient.email}>` : "sarah.connor@techflow.io"}
                        </div>
                        <div>
                          <strong className="text-slate-400 font-sans">date:</strong> Sep 18, 2026, 10:42 AM
                        </div>
                        <div>
                          <strong className="text-slate-400 font-sans">subject:</strong> {resolvedSubject}
                        </div>
                        <div className="flex items-center gap-1 text-emerald-400 text-[11px] pt-1">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Standard encryption (TLS) • mailed-by: aerosend.io • signed-by: aerosend.io</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* INBOX EMAIL PAPER CANVAS */}
              <div
                className={`p-6 transition-colors duration-200 ${
                  isLight ? "bg-[#ffffff] text-slate-900" : "bg-[#0b0f19] text-slate-100"
                }`}
              >
                <div
                  className={`max-w-[620px] mx-auto rounded-xl overflow-hidden border shadow-sm ${
                    isLight ? "bg-white border-slate-200" : "bg-[#0f172a] border-slate-800"
                  }`}
                >
                  {blocks.length === 0 ? (
                    <div className="p-16 text-center text-slate-400 space-y-3">
                      <Layers className="w-10 h-10 mx-auto text-indigo-400/40" />
                      <p className="text-xs">Drag blocks here or click any item in the left palette to start.</p>
                    </div>
                  ) : (
                    <div className={`divide-y ${isLight ? "divide-slate-100" : "divide-slate-800/40"}`}>
                      {blocks.map((block, index) => {
                        const isSelected = selectedBlockId === block.id;
                        const isDragging = draggedBlockIndex === index;
                        const isDragOver = dragOverIndex === index;

                        return (
                          <div
                            key={block.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, index)}
                            onDragOver={(e) => handleDragOver(e, index)}
                            onDrop={(e) => handleDrop(e, index)}
                            onDragEnd={handleDragEnd}
                            onClick={() => setSelectedBlockId(block.id)}
                            className={`relative group cursor-pointer transition-all ${
                              isSelected
                                ? isLight
                                  ? "ring-2 ring-indigo-500 bg-indigo-50/50"
                                  : "ring-2 ring-indigo-500 bg-indigo-950/20"
                                : isLight
                                ? "hover:bg-slate-50"
                                : "hover:bg-slate-800/30"
                            } ${isDragging ? "opacity-30" : ""} ${
                              isDragOver ? "border-t-2 border-t-indigo-400" : ""
                            }`}
                          >
                            {/* Hover Action Controls */}
                            <div className="absolute top-2 right-2 z-20 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900/95 border border-slate-700/90 rounded-lg p-1 shadow-lg">
                              <button
                                title="Drag to reorder"
                                className="p-1 text-slate-400 hover:text-white cursor-grab active:cursor-grabbing"
                              >
                                <GripVertical className="w-3.5 h-3.5" />
                              </button>
                              <button
                                title="Move Up"
                                disabled={index === 0}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMoveBlock(index, "up");
                                }}
                                className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                title="Move Down"
                                disabled={index === blocks.length - 1}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMoveBlock(index, "down");
                                }}
                                className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                              <button
                                title="Duplicate"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDuplicateBlock(index);
                                }}
                                className="p-1 text-slate-400 hover:text-white"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              <button
                                title="Delete"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteBlock(block.id);
                                }}
                                className="p-1 text-slate-400 hover:text-rose-400"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* RENDER BLOCK IN CANVAS */}
                            <div className="p-4 select-text">
                              <CanvasBlockRender
                                block={block}
                                recipient={activeRecipient}
                                isLight={isLight}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>

        {/* RIGHT INSPECTOR: PROPERTIES PANEL */}
        <aside className="w-80 border-l border-slate-800/80 bg-[#090e1f] p-5 overflow-y-auto space-y-5 shrink-0">
          <div>
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
              Block Settings
            </h3>
            <p className="text-[11px] text-slate-500">
              Customize the selected element's content, colors, and layout.
            </p>
          </div>

          {selectedBlock ? (
            <div className="space-y-4 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="font-semibold text-white capitalize flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-indigo-400" />
                  {selectedBlock.type.replace("_", " ")} Block
                </span>
                <button
                  onClick={() => handleDeleteBlock(selectedBlock.id)}
                  className="text-rose-400 hover:text-rose-300 text-[11px] flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" /> Remove
                </button>
              </div>

              {/* HEADING CONTROLS */}
              {selectedBlock.type === "heading" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Heading Text</label>
                    <textarea
                      rows={2}
                      value={selectedBlock.content.text || ""}
                      onChange={(e) =>
                        handleUpdateBlockContent(selectedBlock.id, "text", e.target.value)
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-indigo-500 resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1">Level</label>
                      <select
                        value={selectedBlock.content.level || "h2"}
                        onChange={(e) =>
                          handleUpdateBlockContent(selectedBlock.id, "level", e.target.value)
                        }
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                      >
                        <option value="h1">H1 (Large)</option>
                        <option value="h2">H2 (Medium)</option>
                        <option value="h3">H3 (Small)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1">Alignment</label>
                      <select
                        value={selectedBlock.content.align || "left"}
                        onChange={(e) =>
                          handleUpdateBlockContent(selectedBlock.id, "align", e.target.value)
                        }
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                      >
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* PARAGRAPH CONTROLS */}
              {selectedBlock.type === "paragraph" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Paragraph Text (HTML supported)</label>
                    <textarea
                      rows={6}
                      value={selectedBlock.content.text || ""}
                      onChange={(e) =>
                        handleUpdateBlockContent(selectedBlock.id, "text", e.target.value)
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono text-xs focus:outline-none focus:border-indigo-500 resize-none leading-relaxed"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1">Font Size (px)</label>
                      <input
                        type="number"
                        min="12"
                        max="24"
                        value={selectedBlock.content.fontSize || 15}
                        onChange={(e) =>
                          handleUpdateBlockContent(
                            selectedBlock.id,
                            "fontSize",
                            parseInt(e.target.value) || 15
                          )
                        }
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1">Alignment</label>
                      <select
                        value={selectedBlock.content.align || "left"}
                        onChange={(e) =>
                          handleUpdateBlockContent(selectedBlock.id, "align", e.target.value)
                        }
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                      >
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* BUTTON CONTROLS */}
              {selectedBlock.type === "button" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Button Label</label>
                    <input
                      type="text"
                      value={selectedBlock.content.text || ""}
                      onChange={(e) =>
                        handleUpdateBlockContent(selectedBlock.id, "text", e.target.value)
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Target URL</label>
                    <input
                      type="url"
                      value={selectedBlock.content.url || ""}
                      onChange={(e) =>
                        handleUpdateBlockContent(selectedBlock.id, "url", e.target.value)
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono text-xs"
                      placeholder="https://..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1">Button Color</label>
                      <input
                        type="color"
                        value={selectedBlock.content.bgColor || "#4f46e5"}
                        onChange={(e) =>
                          handleUpdateBlockContent(selectedBlock.id, "bgColor", e.target.value)
                        }
                        className="w-full h-9 bg-slate-950 border border-slate-800 rounded-lg p-1 cursor-pointer"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1">Text Color</label>
                      <input
                        type="color"
                        value={selectedBlock.content.textColor || "#ffffff"}
                        onChange={(e) =>
                          handleUpdateBlockContent(selectedBlock.id, "textColor", e.target.value)
                        }
                        className="w-full h-9 bg-slate-950 border border-slate-800 rounded-lg p-1 cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1">Corner Radius</label>
                      <select
                        value={selectedBlock.content.borderRadius || 8}
                        onChange={(e) =>
                          handleUpdateBlockContent(
                            selectedBlock.id,
                            "borderRadius",
                            parseInt(e.target.value)
                          )
                        }
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                      >
                        <option value={4}>Square (4px)</option>
                        <option value={8}>Slight (8px)</option>
                        <option value={14}>Rounded (14px)</option>
                        <option value={999}>Pill (999px)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1">Alignment</label>
                      <select
                        value={selectedBlock.content.align || "left"}
                        onChange={(e) =>
                          handleUpdateBlockContent(selectedBlock.id, "align", e.target.value)
                        }
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                      >
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* IMAGE CONTROLS */}
              {selectedBlock.type === "image" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Image URL</label>
                    <input
                      type="url"
                      value={selectedBlock.content.url || ""}
                      onChange={(e) =>
                        handleUpdateBlockContent(selectedBlock.id, "url", e.target.value)
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono text-xs"
                      placeholder="https://..."
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Alt Text</label>
                    <input
                      type="text"
                      value={selectedBlock.content.alt || ""}
                      onChange={(e) =>
                        handleUpdateBlockContent(selectedBlock.id, "alt", e.target.value)
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1">Width (%)</label>
                      <input
                        type="number"
                        min="20"
                        max="100"
                        value={selectedBlock.content.width || 100}
                        onChange={(e) =>
                          handleUpdateBlockContent(
                            selectedBlock.id,
                            "width",
                            parseInt(e.target.value) || 100
                          )
                        }
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1">Alignment</label>
                      <select
                        value={selectedBlock.content.align || "center"}
                        onChange={(e) =>
                          handleUpdateBlockContent(selectedBlock.id, "align", e.target.value)
                        }
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                      >
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* 2 COLUMNS CONTROLS */}
              {selectedBlock.type === "columns_2" && (
                <div className="space-y-3">
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                    <span className="font-semibold text-white block">Column 1</span>
                    <input
                      type="text"
                      placeholder="Title"
                      value={selectedBlock.content.col1Title || ""}
                      onChange={(e) =>
                        handleUpdateBlockContent(selectedBlock.id, "col1Title", e.target.value)
                      }
                      className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-white text-xs"
                    />
                    <textarea
                      rows={2}
                      placeholder="Text content"
                      value={selectedBlock.content.col1Text || ""}
                      onChange={(e) =>
                        handleUpdateBlockContent(selectedBlock.id, "col1Text", e.target.value)
                      }
                      className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-white text-xs resize-none"
                    />
                  </div>

                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                    <span className="font-semibold text-white block">Column 2</span>
                    <input
                      type="text"
                      placeholder="Title"
                      value={selectedBlock.content.col2Title || ""}
                      onChange={(e) =>
                        handleUpdateBlockContent(selectedBlock.id, "col2Title", e.target.value)
                      }
                      className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-white text-xs"
                    />
                    <textarea
                      rows={2}
                      placeholder="Text content"
                      value={selectedBlock.content.col2Text || ""}
                      onChange={(e) =>
                        handleUpdateBlockContent(selectedBlock.id, "col2Text", e.target.value)
                      }
                      className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-white text-xs resize-none"
                    />
                  </div>
                </div>
              )}

              {/* CALLOUT CONTROLS */}
              {selectedBlock.type === "callout" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Title</label>
                    <input
                      type="text"
                      value={selectedBlock.content.title || ""}
                      onChange={(e) =>
                        handleUpdateBlockContent(selectedBlock.id, "title", e.target.value)
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Message</label>
                    <textarea
                      rows={3}
                      value={selectedBlock.content.text || ""}
                      onChange={(e) =>
                        handleUpdateBlockContent(selectedBlock.id, "text", e.target.value)
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white text-xs resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Border Accent Color</label>
                    <input
                      type="color"
                      value={selectedBlock.content.borderColor || "#6366f1"}
                      onChange={(e) =>
                        handleUpdateBlockContent(selectedBlock.id, "borderColor", e.target.value)
                      }
                      className="w-full h-9 bg-slate-950 border border-slate-800 rounded-lg p-1 cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {/* DIVIDER CONTROLS */}
              {selectedBlock.type === "divider" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Line Color</label>
                    <input
                      type="color"
                      value={selectedBlock.content.color || "#334155"}
                      onChange={(e) =>
                        handleUpdateBlockContent(selectedBlock.id, "color", e.target.value)
                      }
                      className="w-full h-9 bg-slate-950 border border-slate-800 rounded-lg p-1 cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Vertical Padding (px)</label>
                    <input
                      type="number"
                      min="8"
                      max="48"
                      value={selectedBlock.content.margin || 16}
                      onChange={(e) =>
                        handleUpdateBlockContent(
                          selectedBlock.id,
                          "margin",
                          parseInt(e.target.value) || 16
                        )
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                    />
                  </div>
                </div>
              )}

              {/* SPACER CONTROLS */}
              {selectedBlock.type === "spacer" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Height (px)</label>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      value={selectedBlock.content.height || 24}
                      onChange={(e) =>
                        handleUpdateBlockContent(
                          selectedBlock.id,
                          "height",
                          parseInt(e.target.value) || 24
                        )
                      }
                      className="w-full accent-indigo-500"
                    />
                    <div className="text-right text-slate-400 text-xs mt-1">
                      {selectedBlock.content.height || 24}px
                    </div>
                  </div>
                </div>
              )}

              {/* FOOTER CONTROLS */}
              {selectedBlock.type === "footer" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Company / Legal Text</label>
                    <input
                      type="text"
                      value={selectedBlock.content.companyText || ""}
                      onChange={(e) =>
                        handleUpdateBlockContent(selectedBlock.id, "companyText", e.target.value)
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Unsubscribe Link Text</label>
                    <input
                      type="text"
                      value={selectedBlock.content.unsubscribeText || ""}
                      onChange={(e) =>
                        handleUpdateBlockContent(selectedBlock.id, "unsubscribeText", e.target.value)
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Alignment</label>
                    <select
                      value={selectedBlock.content.align || "center"}
                      onChange={(e) =>
                        handleUpdateBlockContent(selectedBlock.id, "align", e.target.value)
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                    >
                      <option value="left">Left</option>
                      <option value="center">Center</option>
                      <option value="right">Right</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500 space-y-2 border border-dashed border-slate-800 rounded-2xl">
              <MousePointer className="w-6 h-6 mx-auto text-slate-600" />
              <p className="text-xs">Click any block in the canvas to edit its properties.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

// Canvas Block Renderer Component
function CanvasBlockRender({
  block,
  recipient,
  isLight
}: {
  block: EmailBlock;
  recipient: SampleRecipient | null;
  isLight: boolean;
}) {
  const { type, content } = block;

  switch (type) {
    case "heading": {
      const tag = content.level || "h2";
      const sizeClass =
        tag === "h1" ? "text-2xl font-bold" : tag === "h2" ? "text-xl font-bold" : "text-lg font-semibold";
      const alignClass =
        content.align === "center" ? "text-center" : content.align === "right" ? "text-right" : "text-left";
      const headingColor =
        content.color && content.color !== "#ffffff" && content.color !== "#0f172a"
          ? content.color
          : isLight
          ? "#0f172a"
          : "#ffffff";

      const resolved = resolveTokens(content.text || "Heading", recipient);

      return (
        <div
          style={{ color: headingColor }}
          className={`${sizeClass} ${alignClass} tracking-tight`}
          dangerouslySetInnerHTML={{ __html: resolved }}
        />
      );
    }
    case "paragraph": {
      const alignClass =
        content.align === "center" ? "text-center" : content.align === "right" ? "text-right" : "text-left";
      const pColor =
        content.color && content.color !== "#cbd5e1" && content.color !== "#334155"
          ? content.color
          : isLight
          ? "#334155"
          : "#cbd5e1";

      const resolved = resolveTokens(content.text || "Paragraph text...", recipient);

      return (
        <div
          style={{ color: pColor, fontSize: `${content.fontSize || 15}px` }}
          className={`${alignClass} leading-relaxed`}
          dangerouslySetInnerHTML={{ __html: resolved }}
        />
      );
    }
    case "button": {
      const alignClass =
        content.align === "center" ? "text-center" : content.align === "right" ? "text-right" : "text-left";
      const resolved = resolveTokens(content.text || "Button Text", recipient);

      return (
        <div className={`${alignClass} my-2`}>
          <span
            style={{
              backgroundColor: content.bgColor || "#4f46e5",
              color: content.textColor || "#ffffff",
              borderRadius: `${content.borderRadius || 8}px`
            }}
            className="inline-block px-6 py-2.5 text-xs font-semibold shadow-md pointer-events-none"
          >
            {resolved}
          </span>
        </div>
      );
    }
    case "image": {
      const alignClass =
        content.align === "center" ? "mx-auto" : content.align === "right" ? "ml-auto" : "mr-auto";
      return (
        <div className="my-2">
          {content.url ? (
            <img
              src={content.url}
              alt={content.alt || ""}
              style={{ width: `${content.width || 100}%` }}
              className={`rounded-xl object-cover max-h-80 ${alignClass}`}
            />
          ) : (
            <div className="p-8 border border-dashed border-slate-700 rounded-xl text-center text-slate-500 text-xs">
              Click to configure Image URL
            </div>
          )}
        </div>
      );
    }
    case "columns_2": {
      const colBg = isLight ? "#f8fafc" : (content.bgColor || "#0f172a");
      const colBorder = isLight ? "border-slate-200" : "border-slate-800";
      const titleColor = isLight ? "#0f172a" : "#ffffff";
      const textColor = isLight ? "#475569" : "#94a3b8";

      return (
        <div
          style={{ backgroundColor: colBg }}
          className={`grid grid-cols-2 gap-4 p-4 rounded-xl border ${colBorder} my-2`}
        >
          <div>
            <div style={{ color: titleColor }} className="font-semibold text-xs mb-1">
              {resolveTokens(content.col1Title || "Column 1", recipient)}
            </div>
            <div style={{ color: textColor }} className="text-[11px] leading-relaxed">
              {resolveTokens(content.col1Text || "Text", recipient)}
            </div>
          </div>
          <div className={`border-l ${colBorder} pl-4`}>
            <div style={{ color: titleColor }} className="font-semibold text-xs mb-1">
              {resolveTokens(content.col2Title || "Column 2", recipient)}
            </div>
            <div style={{ color: textColor }} className="text-[11px] leading-relaxed">
              {resolveTokens(content.col2Text || "Text", recipient)}
            </div>
          </div>
        </div>
      );
    }
    case "callout": {
      const calloutBg = isLight ? "#f8fafc" : (content.bgColor || "#1e1b4b");
      const calloutBorder = content.borderColor || "#6366f1";
      const titleColor = isLight ? "#0f172a" : "#ffffff";
      const textColor = isLight ? "#334155" : "#cbd5e1";

      return (
        <div
          style={{
            backgroundColor: calloutBg,
            borderLeftColor: calloutBorder
          }}
          className={`p-4 rounded-xl border-l-4 my-2 border ${isLight ? "border-slate-200" : "border-slate-800"}`}
        >
          {content.title && (
            <div style={{ color: titleColor }} className="font-bold text-xs mb-1">
              {resolveTokens(content.title, recipient)}
            </div>
          )}
          <div style={{ color: textColor }} className="text-xs leading-relaxed">
            {resolveTokens(content.text || "", recipient)}
          </div>
        </div>
      );
    }
    case "divider": {
      const divColor = isLight ? "#e2e8f0" : (content.color || "#334155");
      return <hr style={{ borderColor: divColor }} className="my-2 border-t" />;
    }
    case "spacer": {
      return (
        <div
          style={{ height: `${content.height || 24}px` }}
          className={`flex items-center justify-center text-[10px] border border-dashed rounded ${
            isLight ? "text-slate-400 border-slate-200" : "text-slate-700 border-slate-800/50"
          }`}
        >
          Spacer ({content.height || 24}px)
        </div>
      );
    }
    case "footer": {
      const alignClass =
        content.align === "center" ? "text-center" : content.align === "right" ? "text-right" : "text-left";
      const footerColor = isLight ? "#64748b" : "#94a3b8";
      const linkColor = isLight ? "text-indigo-600" : "text-indigo-400";

      return (
        <div style={{ color: footerColor }} className={`${alignClass} text-[11px] py-3 space-y-1`}>
          <div>{resolveTokens(content.companyText || "Company Address", recipient)}</div>
          {content.unsubscribeText && (
            <span className={`${linkColor} underline cursor-pointer`}>
              {resolveTokens(content.unsubscribeText, recipient)}
            </span>
          )}
        </div>
      );
    }
    default:
      return null;
  }
}

function getDefaultBlockContent(type: BlockType, theme: "light" | "dark" = "light"): Record<string, any> {
  const isLight = theme === "light";
  switch (type) {
    case "heading":
      return { text: "Exciting update for {{company}}", level: "h2", align: "left" };
    case "paragraph":
      return {
        text: "Hi {{firstName}},<br/>We wanted to follow up and share a quick thought regarding your current goals at {{company}}.",
        align: "left",
        fontSize: 15
      };
    case "button":
      return {
        text: "Schedule Call →",
        url: "https://calendly.com",
        align: "left",
        bgColor: "#4f46e5",
        textColor: "#ffffff",
        borderRadius: 8
      };
    case "image":
      return {
        url: "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800&auto=format&fit=crop&q=80",
        alt: "Banner Image",
        width: 100,
        align: "center"
      };
    case "columns_2":
      return {
        col1Title: "Benefit 1",
        col1Text: "High deliverability directly through your domain.",
        col2Title: "Benefit 2",
        col2Text: "Drag and drop personalization with zero coding."
      };
    case "callout":
      return {
        title: "Key Takeaway",
        text: "Emails tailored with custom tokens have a 42% higher click-through rate.",
        borderColor: "#6366f1"
      };
    case "divider":
      return { margin: 16 };
    case "spacer":
      return { height: 24 };
    case "footer":
      return {
        companyText: "AeroSend Outreach Engine • San Francisco, CA",
        unsubscribeText: "Unsubscribe from this mailing list",
        align: "center"
      };
    default:
      return {};
  }
}
