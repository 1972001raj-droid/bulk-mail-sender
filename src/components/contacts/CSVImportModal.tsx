"use client";

import React, { useState, useEffect, useRef } from "react";
import Papa from "papaparse";
import {
  Upload,
  X,
  Check,
  AlertCircle,
  FileSpreadsheet,
  Loader2,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Download,
  RotateCcw,
  Search
} from "lucide-react";
import { ImportPolicy, VerificationStatus } from "@/lib/verification/types";

interface CSVImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: (count: number) => void;
  existingLists?: Array<{ id: string; name: string }>;
  initialListId?: string;
}

interface VerificationRow {
  id: string;
  email: string;
  status: VerificationStatus;
  reason: string;
  details?: any;
}

export function CSVImportModal({
  isOpen,
  onClose,
  onImportComplete,
  existingLists = [],
  initialListId
}: CSVImportModalProps) {
  // Wizard steps: 'MAPPING' | 'VERIFYING' | 'RESULTS' | 'ERROR_FALLBACK'
  const [step, setStep] = useState<"MAPPING" | "VERIFYING" | "RESULTS" | "ERROR_FALLBACK">("MAPPING");

  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  
  const [listMode, setListMode] = useState<"EXISTING" | "NEW">("EXISTING");
  const [listName, setListName] = useState("");
  const [selectedListId, setSelectedListId] = useState("");

  // Sync target list when modal opens or initialListId changes
  useEffect(() => {
    if (isOpen) {
      if (initialListId && existingLists.some((l) => l.id === initialListId)) {
        setSelectedListId(initialListId);
        setListMode("EXISTING");
      } else if (existingLists.length > 0) {
        if (!selectedListId || !existingLists.some((l) => l.id === selectedListId)) {
          setSelectedListId(existingLists[0].id);
        }
        setListMode("EXISTING");
      } else {
        setListMode("NEW");
      }
    }
  }, [isOpen, initialListId, existingLists]);

  // Verification Settings
  const [verifyEmails, setVerifyEmails] = useState(false); // Default OFF per requirement
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  // Progress state
  const [progress, setProgress] = useState({
    total: 0,
    processed: 0,
    safeCount: 0,
    riskyCount: 0,
    invalidCount: 0,
    unknownCount: 0,
    percent: 0
  });

  // Results state
  const [verificationRecords, setVerificationRecords] = useState<VerificationRow[]>([]);
  const [resultsFilter, setResultsFilter] = useState<string>("ALL");
  const [resultsSearch, setResultsSearch] = useState("");
  const [importPolicy, setImportPolicy] = useState<ImportPolicy>("SAFE"); // Default Safe contacts only

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const selected = e.target.files?.[0];
    if (!selected) return;

    setFile(selected);
    if (!listName) {
      setListName(selected.name.replace(/\.[^/.]+$/, ""));
    }

    Papa.parse(selected, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.data.length === 0) {
          setError("The selected CSV file appears to be empty.");
          return;
        }

        const detectedHeaders = results.meta.fields || [];
        setHeaders(detectedHeaders);
        setRows(results.data);

        // Smart auto-detection of column names
        const initialMap: Record<string, string> = {};
        for (const h of detectedHeaders) {
          const lower = h.toLowerCase().replace(/[^a-z0-9]/g, "");
          if (["email", "mail", "emailaddress"].includes(lower)) {
            initialMap["email"] = h;
          } else if (["firstname", "fname", "first"].includes(lower)) {
            initialMap["firstName"] = h;
          } else if (["lastname", "lname", "last"].includes(lower)) {
            initialMap["lastName"] = h;
          } else if (["company", "organization", "org", "companyname"].includes(lower)) {
            initialMap["company"] = h;
          } else if (["title", "jobtitle", "role", "position"].includes(lower)) {
            initialMap["title"] = h;
          }
        }
        setMappings(initialMap);
      },
      error: (err) => {
        setError(`Failed to parse CSV: ${err.message}`);
      }
    });
  };

  const getTargetListConfig = () => {
    if (listMode === "EXISTING" && selectedListId) {
      return { listId: selectedListId, listName: undefined };
    }
    const cleanName = listName.trim() || file?.name.replace(/\.[^/.]+$/, "") || "Imported Contacts";
    return { listId: undefined, listName: cleanName };
  };

  const handleStartImport = async () => {
    if (!mappings.email) {
      setError("Please select which column contains the recipient Email address.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const { listId: targetListId, listName: targetListName } = getTargetListConfig();

    try {
      const res = await fetch("/api/v1/contacts/imports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows,
          mappings,
          listName: targetListName,
          listId: targetListId,
          verifyEmails
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to start import");
      }

      if (verifyEmails && data.jobId) {
        // Asynchronous verification pipeline
        setActiveJobId(data.jobId);
        setStep("VERIFYING");
        startPollingJobStatus(data.jobId);
      } else {
        // Direct non-verified import completed immediately
        onImportComplete(data.imported);
        handleCloseModal();
      }
    } catch (err: any) {
      if (verifyEmails) {
        setStep("ERROR_FALLBACK");
        setError(err.message || "Email verification service is temporarily unavailable.");
      } else {
        setError(err.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Start polling job status
  const startPollingJobStatus = (jobId: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/v1/contacts/imports/${jobId}/status`);
        if (!res.ok) throw new Error("Status check failed");
        const data = await res.json();

        if (data.success) {
          setProgress({
            total: data.total,
            processed: data.processed,
            safeCount: data.safeCount,
            riskyCount: data.riskyCount,
            invalidCount: data.invalidCount,
            unknownCount: data.unknownCount,
            percent: data.percent
          });

          if (data.status === "COMPLETED") {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            if (data.safeCount === 0 && data.unknownCount > 0) {
              setImportPolicy("SAFE_RISKY_UNKNOWN");
            } else {
              setImportPolicy("SAFE");
            }
            await fetchVerificationResults(jobId);
          } else if (data.status === "FAILED") {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            setStep("ERROR_FALLBACK");
            setError(data.error || "Email verification failed during processing.");
          }
        }
      } catch (e: any) {
        // Transient poll error, continue polling
      }
    }, 800);
  };

  // Fetch verified records
  const fetchVerificationResults = async (jobId: string) => {
    try {
      const res = await fetch(`/api/v1/contacts/imports/${jobId}/results`);
      const data = await res.json();
      if (data.success && data.records) {
        setVerificationRecords(data.records);
        setStep("RESULTS");
      } else {
        throw new Error("Failed to load verification results");
      }
    } catch (e: any) {
      setStep("ERROR_FALLBACK");
      setError(e.message || "Failed to load verification results");
    }
  };

  // Commit verified contacts with user-selected policy
  const handleCommitVerifiedImport = async () => {
    if (!activeJobId) return;
    setIsSubmitting(true);
    setError(null);

    const { listId: targetListId, listName: targetListName } = getTargetListConfig();

    try {
      const res = await fetch(`/api/v1/contacts/imports/${activeJobId}/commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          importPolicy,
          targetListId,
          targetListName
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to commit contacts import");
      }

      onImportComplete(data.imported);
      handleCloseModal();
    } catch (err: any) {
      setError(err.message || "Failed to import selected contacts");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Direct import fallback without verification
  const handleImportWithoutVerification = async () => {
    setVerifyEmails(false);
    setStep("MAPPING");
    setError(null);
    setIsSubmitting(true);

    const { listId: targetListId, listName: targetListName } = getTargetListConfig();

    try {
      const res = await fetch("/api/v1/contacts/imports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows,
          mappings,
          listName: targetListName,
          listId: targetListId,
          verifyEmails: false
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to import contacts");
      }

      onImportComplete(data.imported);
      handleCloseModal();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadSampleCsv = () => {
    window.location.href = "/api/v1/contacts/imports/sample-template";
  };

  const handleDownloadCsv = () => {
    if (!activeJobId) return;
    window.location.href = `/api/v1/contacts/imports/${activeJobId}/export`;
  };

  const handleCloseModal = () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    setStep("MAPPING");
    setFile(null);
    setRows([]);
    setHeaders([]);
    setMappings({});
    setActiveJobId(null);
    setVerificationRecords([]);
    setError(null);
    onClose();
  };

  // Filtered rows for results table
  const filteredRecords = verificationRecords.filter((r) => {
    const matchesFilter = resultsFilter === "ALL" || r.status === resultsFilter;
    const matchesSearch = !resultsSearch || r.email.toLowerCase().includes(resultsSearch.toLowerCase().trim());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
              {step === "VERIFYING" ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : step === "RESULTS" ? (
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
              ) : (
                <FileSpreadsheet className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="font-semibold text-white text-base">
                {step === "VERIFYING"
                  ? "Verifying Contacts..."
                  : step === "RESULTS"
                  ? "Verification Complete"
                  : step === "ERROR_FALLBACK"
                  ? "Verification Unavailable"
                  : "Import Contacts from CSV"}
              </h3>
              <p className="text-xs text-slate-400">
                {step === "VERIFYING"
                  ? "Running deep SMTP existence checks, MX analysis, and catch-all detection"
                  : step === "RESULTS"
                  ? "Review deliverability analysis and choose contacts to import"
                  : step === "ERROR_FALLBACK"
                  ? "Choose an import option to proceed safely"
                  : "Upload and map your spreadsheet columns"}
              </p>
            </div>
          </div>
          <button
            onClick={handleCloseModal}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {error && step !== "ERROR_FALLBACK" && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-3 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: MAPPING & VERIFY OPTION */}
          {step === "MAPPING" && (
            <>
              {!file ? (
                <div className="space-y-4">
                  {/* Sample Model Template Download Card */}
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                        <FileSpreadsheet className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-semibold text-white">Sample CSV Model File</div>
                        <div className="text-[11px] text-slate-400">
                          Download a pre-formatted template with standard columns (Email, Name, Company, Title, Custom Fields)
                        </div>
                      </div>
                    </div>
                    <a
                      href="/api/v1/contacts/imports/sample-template"
                      download="sample_contacts_model.csv"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/15 hover:bg-indigo-600/25 text-indigo-300 hover:text-white border border-indigo-500/30 text-xs font-semibold transition-all whitespace-nowrap cursor-pointer shadow-sm"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Sample File</span>
                    </a>
                  </div>

                  {/* Upload Box */}
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-800 hover:border-indigo-500/50 rounded-2xl p-8 cursor-pointer bg-slate-950/40 hover:bg-slate-950/80 transition-all group">
                    <div className="p-4 rounded-full bg-indigo-500/10 text-indigo-400 group-hover:scale-110 transition-transform">
                      <Upload className="w-7 h-7" />
                    </div>
                    <span className="mt-3 font-medium text-sm text-slate-200">
                      Click to upload CSV spreadsheet
                    </span>
                    <span className="text-xs text-slate-400 mt-1">
                      Supports UTF-8 CSV exports from Google Sheets, Excel, or CRMs
                    </span>
                    <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
                  </label>
                </div>
              ) : (
                <div className="space-y-5">
                  {/* File details */}
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                    <div className="flex items-center gap-3">
                      <FileSpreadsheet className="w-5 h-5 text-indigo-400" />
                      <div>
                        <div className="text-sm font-medium text-white">{file.name}</div>
                        <div className="text-xs text-slate-400">
                          {rows.length} contacts detected · {(file.size / 1024).toFixed(1)} KB
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <a
                        href="/api/v1/contacts/imports/sample-template"
                        download="sample_contacts_model.csv"
                        className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <Download className="w-3 h-3" />
                        <span>Sample Model</span>
                      </a>
                      <span className="text-slate-700">|</span>
                      <button
                        onClick={() => {
                          setFile(null);
                          setRows([]);
                          setHeaders([]);
                        }}
                        className="text-xs text-slate-400 hover:text-rose-400 transition-colors"
                      >
                        Change file
                      </button>
                    </div>
                  </div>

                  {/* Target List Selection */}
                  <div className="space-y-2.5 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <label className="text-xs font-semibold text-slate-300">Target Audience List</label>
                      <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[11px]">
                        <button
                          type="button"
                          onClick={() => {
                            setListMode("EXISTING");
                            if (!selectedListId && existingLists.length > 0) {
                              setSelectedListId(initialListId || existingLists[0].id);
                            }
                          }}
                          className={`px-3 py-1 rounded-md font-medium transition-all ${
                            listMode === "EXISTING"
                              ? "bg-indigo-600 text-white shadow-sm"
                              : "text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          Existing Audience List
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setListMode("NEW");
                            if (!listName && file) {
                              setListName(file.name.replace(/\.[^/.]+$/, ""));
                            }
                          }}
                          className={`px-3 py-1 rounded-md font-medium transition-all ${
                            listMode === "NEW"
                              ? "bg-indigo-600 text-white shadow-sm"
                              : "text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          Create New List
                        </button>
                      </div>
                    </div>

                    {listMode === "EXISTING" ? (
                      <div className="space-y-1.5">
                        <select
                          value={selectedListId}
                          onChange={(e) => setSelectedListId(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                        >
                          {existingLists.length === 0 ? (
                            <option value="">No existing audience lists found</option>
                          ) : (
                            existingLists.map((l) => (
                              <option key={l.id} value={l.id}>
                                {l.name}
                              </option>
                            ))
                          )}
                        </select>
                        {selectedListId && (
                          <div className="flex items-center gap-1.5 text-[11px] text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            <span>
                              Contacts will be uploaded directly into{" "}
                              <strong className="underline decoration-emerald-500/40">
                                {existingLists.find((l) => l.id === selectedListId)?.name || "selected list"}
                              </strong>
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <input
                          type="text"
                          placeholder="New list name (e.g. Q4 Target Leads)"
                          value={listName}
                          onChange={(e) => setListName(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                        />
                        <div className="flex items-center gap-1.5 text-[11px] text-indigo-400">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            A brand new audience list named{" "}
                            <strong>"{listName.trim() || file?.name.replace(/\.[^/.]+$/, "") || "Imported Contacts"}"</strong>{" "}
                            will be created
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Column Mapping Table */}
                  <div className="space-y-3">
                    <div className="text-xs font-semibold text-slate-300">Column Mapping</div>
                    <div className="rounded-xl border border-slate-800 overflow-hidden text-xs">
                      <table className="w-full text-left">
                        <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                          <tr>
                            <th className="py-2.5 px-4 font-medium">Standard Field</th>
                            <th className="py-2.5 px-4 font-medium">CSV Column Header</th>
                            <th className="py-2.5 px-4 font-medium">Sample Value (Row 1)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 bg-slate-900/30">
                          {[
                            { key: "email", label: "Email Address *", required: true },
                            { key: "firstName", label: "First Name", required: false },
                            { key: "lastName", label: "Last Name", required: false },
                            { key: "company", label: "Company", required: false },
                            { key: "title", label: "Job Title", required: false }
                          ].map((field) => {
                            const mappedCol = mappings[field.key];
                            const sampleVal = mappedCol && rows[0] ? rows[0][mappedCol] : "—";
                            return (
                              <tr key={field.key}>
                                <td className="py-2.5 px-4 font-medium text-slate-200">
                                  {field.label}
                                </td>
                                <td className="py-2.5 px-4">
                                  <select
                                    value={mappings[field.key] || ""}
                                    onChange={(e) =>
                                      setMappings({ ...mappings, [field.key]: e.target.value })
                                    }
                                    className={`w-full bg-slate-950 border rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none ${
                                      field.required && !mappings[field.key]
                                        ? "border-rose-500/60 text-rose-300"
                                        : "border-slate-800 focus:border-indigo-500"
                                    }`}
                                  >
                                    <option value="">(Select column)</option>
                                    {headers.map((h) => (
                                      <option key={h} value={h}>
                                        {h}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td className="py-2.5 px-4 text-slate-400 truncate max-w-[150px]">
                                  {String(sampleVal)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Section 3: Email Verification Section */}
                  <div className="pt-3 border-t border-slate-800">
                    <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <label className="flex items-start gap-3 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={verifyEmails}
                            onChange={(e) => setVerifyEmails(e.target.checked)}
                            className="mt-0.5 w-4 h-4 rounded text-indigo-600 bg-slate-900 border-slate-700 focus:ring-indigo-500 cursor-pointer"
                          />
                          <div>
                            <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                              <span>Verify email addresses before importing</span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              Optional deliverability check before importing. Avoid bounces and protect sender reputation.
                            </p>
                          </div>
                        </label>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                          verifyEmails ? "bg-indigo-500/10 text-indigo-300 border-indigo-500/20" : "bg-slate-800 text-slate-400 border-slate-700"
                        }`}>
                          {verifyEmails ? "ENABLED" : "OFF"}
                        </span>
                      </div>

                      {verifyEmails && (
                        <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-300 space-y-1.5 animate-in fade-in">
                          <div className="font-medium text-slate-400 text-[10px] uppercase tracking-wider">
                            Verification checks performed:
                          </div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-slate-300">
                            <span className="flex items-center gap-1.5">✓ Email syntax</span>
                            <span className="flex items-center gap-1.5">✓ Domain</span>
                            <span className="flex items-center gap-1.5">✓ MX records</span>
                            <span className="flex items-center gap-1.5">✓ SMTP recipient verification</span>
                            <span className="flex items-center gap-1.5">✓ Catch-all detection</span>
                            <span className="flex items-center gap-1.5">✓ Disposable email detection</span>
                            <span className="flex items-center gap-1.5">✓ Role-based email detection</span>
                            <span className="flex items-center gap-1.5">✓ Temporary/unknown SMTP conditions</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* STEP 2: VERIFICATION PROGRESS */}
          {step === "VERIFYING" && (
            <div className="py-6 space-y-6 animate-in fade-in">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-white">Verifying Contacts</span>
                  <span className="font-mono text-indigo-400 font-semibold">{progress.percent}%</span>
                </div>
                <div className="h-3 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 via-indigo-400 to-emerald-400 transition-all duration-300 ease-out"
                    style={{ width: `${progress.percent}%` }}
                  />
                </div>
                <div className="text-right text-[11px] text-slate-400 font-mono">
                  {progress.processed.toLocaleString()} / {progress.total.toLocaleString()} verified
                </div>
              </div>

              {/* Progress metrics cards */}
              <div className="grid grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
                  <div className="text-[10px] uppercase font-semibold text-emerald-400 flex items-center justify-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Safe
                  </div>
                  <div className="text-lg font-bold text-white mt-1">
                    {progress.safeCount.toLocaleString()}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
                  <div className="text-[10px] uppercase font-semibold text-amber-400 flex items-center justify-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Risky
                  </div>
                  <div className="text-lg font-bold text-white mt-1">
                    {progress.riskyCount.toLocaleString()}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
                  <div className="text-[10px] uppercase font-semibold text-rose-400 flex items-center justify-center gap-1">
                    <XCircle className="w-3 h-3" /> Invalid
                  </div>
                  <div className="text-lg font-bold text-white mt-1">
                    {progress.invalidCount.toLocaleString()}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
                  <div className="text-[10px] uppercase font-semibold text-slate-400 flex items-center justify-center gap-1">
                    <HelpCircle className="w-3 h-3" /> Unknown
                  </div>
                  <div className="text-lg font-bold text-white mt-1">
                    {progress.unknownCount.toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/80 text-[11px] text-slate-400 text-center">
                Please wait while we connect with destination mail servers. This happens in the background without blocking other tasks.
              </div>
            </div>
          )}

          {/* STEP 3: VERIFICATION RESULTS & POLICY SELECTOR */}
          {step === "RESULTS" && (
            <div className="space-y-5 animate-in fade-in">
              {/* Summary Cards */}
              <div className="grid grid-cols-5 gap-2.5">
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-center">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Total</div>
                  <div className="text-base font-bold text-white mt-0.5">{progress.total}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                  <div className="text-[10px] text-emerald-400 uppercase font-semibold">✓ Safe</div>
                  <div className="text-base font-bold text-emerald-300 mt-0.5">{progress.safeCount}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
                  <div className="text-[10px] text-amber-400 uppercase font-semibold">⚠ Risky</div>
                  <div className="text-base font-bold text-amber-300 mt-0.5">{progress.riskyCount}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-center">
                  <div className="text-[10px] text-rose-400 uppercase font-semibold">✕ Invalid</div>
                  <div className="text-base font-bold text-rose-300 mt-0.5">{progress.invalidCount}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 text-center">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">? Unknown</div>
                  <div className="text-base font-bold text-slate-300 mt-0.5">{progress.unknownCount}</div>
                </div>
              </div>

              {/* Import Options Radio Selection */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5">
                <div className="text-xs font-semibold text-white">Import Options</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <label className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                    importPolicy === "SAFE" ? "bg-indigo-600/15 border-indigo-500 text-white" : "border-slate-800 text-slate-300 hover:bg-slate-900"
                  }`}>
                    <input
                      type="radio"
                      name="policy"
                      value="SAFE"
                      checked={importPolicy === "SAFE"}
                      onChange={() => setImportPolicy("SAFE")}
                      className="text-indigo-600"
                    />
                    <div>
                      <div className="font-semibold">Import Safe contacts only</div>
                      <div className="text-[10px] text-emerald-400">Recommended · {progress.safeCount} contacts</div>
                    </div>
                  </label>

                  <label className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                    importPolicy === "SAFE_RISKY" ? "bg-indigo-600/15 border-indigo-500 text-white" : "border-slate-800 text-slate-300 hover:bg-slate-900"
                  }`}>
                    <input
                      type="radio"
                      name="policy"
                      value="SAFE_RISKY"
                      checked={importPolicy === "SAFE_RISKY"}
                      onChange={() => setImportPolicy("SAFE_RISKY")}
                      className="text-indigo-600"
                    />
                    <div>
                      <div className="font-semibold">Import Safe + Risky</div>
                      <div className="text-[10px] text-slate-400">{progress.safeCount + progress.riskyCount} contacts</div>
                    </div>
                  </label>

                  <label className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                    importPolicy === "SAFE_RISKY_UNKNOWN" ? "bg-indigo-600/15 border-indigo-500 text-white" : "border-slate-800 text-slate-300 hover:bg-slate-900"
                  }`}>
                    <input
                      type="radio"
                      name="policy"
                      value="SAFE_RISKY_UNKNOWN"
                      checked={importPolicy === "SAFE_RISKY_UNKNOWN"}
                      onChange={() => setImportPolicy("SAFE_RISKY_UNKNOWN")}
                      className="text-indigo-600"
                    />
                    <div>
                      <div className="font-semibold">Import Safe + Risky + Unknown</div>
                      <div className="text-[10px] text-slate-400">{progress.total - progress.invalidCount} contacts</div>
                    </div>
                  </label>

                  <label className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                    importPolicy === "ALL" ? "bg-indigo-600/15 border-indigo-500 text-white" : "border-slate-800 text-slate-300 hover:bg-slate-900"
                  }`}>
                    <input
                      type="radio"
                      name="policy"
                      value="ALL"
                      checked={importPolicy === "ALL"}
                      onChange={() => setImportPolicy("ALL")}
                      className="text-indigo-600"
                    />
                    <div>
                      <div className="font-semibold">Import all contacts</div>
                      <div className="text-[10px] text-slate-400">{progress.total} contacts</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Filter and Search Bar */}
              <div className="flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {["ALL", "SAFE", "RISKY", "INVALID", "UNKNOWN"].map((s) => (
                    <button
                      key={s}
                      onClick={() => setResultsFilter(s)}
                      className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                        resultsFilter === s
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
                      }`}
                    >
                      {s === "ALL" ? "All" : s}
                    </button>
                  ))}
                </div>

                <div className="relative w-44">
                  <Search className="w-3 h-3 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search email..."
                    value={resultsSearch}
                    onChange={(e) => setResultsSearch(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-7 pr-2.5 py-1 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Results Table */}
              <div className="rounded-xl border border-slate-800 overflow-hidden text-xs max-h-48 overflow-y-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 sticky top-0">
                    <tr>
                      <th className="py-2 px-3 font-medium">Email</th>
                      <th className="py-2 px-3 font-medium">Status</th>
                      <th className="py-2 px-3 font-medium">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-900/30 text-slate-300">
                    {filteredRecords.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="py-6 text-center text-slate-500">
                          No verification records match your filter
                        </td>
                      </tr>
                    ) : (
                      filteredRecords.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-800/20">
                          <td className="py-2 px-3 font-mono text-white text-[11px] truncate max-w-[200px]">
                            {r.email}
                          </td>
                          <td className="py-2 px-3">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${
                                r.status === "SAFE"
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                  : r.status === "RISKY"
                                  ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                  : r.status === "INVALID"
                                  ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                                  : "bg-slate-800 text-slate-400 border-slate-700"
                              }`}
                            >
                              {r.status === "SAFE" && "✓ Safe"}
                              {r.status === "RISKY" && "⚠ Risky"}
                              {r.status === "INVALID" && "✕ Invalid"}
                              {r.status === "UNKNOWN" && "? Unknown"}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-slate-400 text-[11px] truncate max-w-[200px]">
                            {r.reason.replace(/_/g, " ").toLowerCase()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Action: Download full report as CSV */}
              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-slate-400 text-[11px]">
                  All original records are safely preserved with this import job.
                </span>
                <button
                  type="button"
                  onClick={handleDownloadCsv}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs font-medium transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Download Verification Results (CSV)</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: ERROR / SERVICE UNAVAILABLE FALLBACK */}
          {step === "ERROR_FALLBACK" && (
            <div className="py-8 text-center space-y-4 animate-in fade-in">
              <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-semibold text-white text-sm">Email verification is temporarily unavailable</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  {error || "Destination mail servers or network limits prevented completing verification."}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 max-w-md mx-auto text-xs text-slate-300 text-left">
                Your contact list and file mappings remain saved. You can retry verification or import directly without waiting.
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  onClick={handleStartImport}
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Retry Verification</span>
                </button>
                <button
                  onClick={handleImportWithoutVerification}
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition-all"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Import Without Verification</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/40 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            {step === "RESULTS" && (
              <span>
                Ready to import based on:{" "}
                <strong className="text-white">
                  {importPolicy === "SAFE"
                    ? "Safe only"
                    : importPolicy === "SAFE_RISKY"
                    ? "Safe + Risky"
                    : importPolicy === "SAFE_RISKY_UNKNOWN"
                    ? "Safe + Risky + Unknown"
                    : "All contacts"}
                </strong>
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleCloseModal}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>

            {step === "MAPPING" && (
              <button
                disabled={!file || !mappings.email || isSubmitting}
                onClick={handleStartImport}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition-all"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing {rows.length} contacts...</span>
                  </>
                ) : verifyEmails ? (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Verify & Import Contacts</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Import Contacts</span>
                  </>
                )}
              </button>
            )}

            {step === "RESULTS" && (
              <button
                disabled={isSubmitting}
                onClick={handleCommitVerifiedImport}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold shadow-md shadow-emerald-600/30 transition-all"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Importing contacts...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Import Selected Contacts</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
