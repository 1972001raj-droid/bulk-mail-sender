"use client";

import React, { useState } from "react";
import Papa from "papaparse";
import { Upload, X, Check, AlertCircle, FileSpreadsheet, Loader2 } from "lucide-react";

interface CSVImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: (count: number) => void;
  existingLists?: Array<{ id: string; name: string }>;
}

export function CSVImportModal({ isOpen, onClose, onImportComplete, existingLists = [] }: CSVImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [listName, setListName] = useState("");
  const [selectedListId, setSelectedListId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const selected = e.target.files?.[0];
    if (!selected) return;

    setFile(selected);
    setListName(selected.name.replace(/\.[^/.]+$/, ""));

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

  const handleImport = async () => {
    if (!mappings.email) {
      setError("Please select which column contains the recipient Email address.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/v1/contacts/imports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows,
          mappings,
          listName: selectedListId ? undefined : listName || "Imported Contacts",
          listId: selectedListId || undefined
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to import contacts");
      }

      onImportComplete(data.imported);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-base">Import Contacts from CSV</h3>
              <p className="text-xs text-slate-400">Upload and map your spreadsheet columns</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-3 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Upload Box */}
          {!file ? (
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-800 hover:border-indigo-500/50 rounded-2xl p-8 cursor-pointer bg-slate-950/40 hover:bg-slate-950/80 transition-all group">
              <div className="p-4 rounded-full bg-indigo-500/10 text-indigo-400 group-hover:scale-110 transition-transform">
                <Upload className="w-7 h-7" />
              </div>
              <span className="mt-3 font-medium text-sm text-slate-200">
                Click to upload CSV spreadsheet
              </span>
              <span className="text-xs text-slate-400 mt-1">Supports UTF-8 CSV exports from Google Sheets, Excel, or CRMs</span>
              <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
            </label>
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

              {/* Target List Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Target Contact List</label>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="New list name"
                    value={listName}
                    onChange={(e) => {
                      setListName(e.target.value);
                      setSelectedListId("");
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
                  />
                  <select
                    value={selectedListId}
                    onChange={(e) => {
                      setSelectedListId(e.target.value);
                      if (e.target.value) setListName("");
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">-- Or choose existing list --</option>
                    {existingLists.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
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
                        { key: "title", label: "Job Title", required: false },
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
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/40 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            disabled={!file || !mappings.email || isSubmitting}
            onClick={handleImport}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition-all"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Importing {rows.length} contacts...</span>
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Import Contacts</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
