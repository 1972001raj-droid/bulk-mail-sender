"use client";

import React, { useState } from "react";
import {
  Users,
  Plus,
  Upload,
  Search,
  Mail,
  Building,
  Tag,
  CheckCircle2,
  FileSpreadsheet,
  Edit2,
  Trash2,
  X,
  Loader2,
  Filter,
  CheckSquare,
  Square,
  AlertTriangle,
  Layers,
  Sparkles,
  UserCheck,
  UserX,
  Ban,
  ShieldCheck,
  AlertCircle
} from "lucide-react";
import { CSVImportModal } from "@/components/contacts/CSVImportModal";

interface ContactRecord {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  title: string | null;
  status: string;
  verificationStatus?: string | null;
  verificationReason?: string | null;
  verificationCheckedAt?: string | Date | null;
  customFieldsJson: string | null;
  createdAt: string | Date;
  listMemberships?: Array<{
    listId: string;
    list?: { id: string; name: string };
  }>;
}

interface ContactListRecord {
  id: string;
  name: string;
  description: string | null;
  _count?: { members: number };
}

interface ContactsClientViewProps {
  initialContacts: ContactRecord[];
  initialLists: ContactListRecord[];
}

export function ContactsClientView({ initialContacts, initialLists }: ContactsClientViewProps) {
  const [contacts, setContacts] = useState<ContactRecord[]>(initialContacts);
  const [lists, setLists] = useState<ContactListRecord[]>(initialLists);
  const [selectedListId, setSelectedListId] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [verificationFilter, setVerificationFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [isCSVModalOpen, setIsCSVModalOpen] = useState(false);

  // Selection state for Bulk Actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Add Contact Modal State
  const [isNewContactOpen, setIsNewContactOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newCompany, setNewCompany] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newStatus, setNewStatus] = useState("ACTIVE");
  const [newListId, setNewListId] = useState("");
  const [newCustomFields, setNewCustomFields] = useState<Array<{ key: string; value: string }>>([]);
  const [submittingNew, setSubmittingNew] = useState(false);
  const [newContactError, setNewContactError] = useState<string | null>(null);

  // Live Email Verification State for Add Contact
  const [checkingNewEmail, setCheckingNewEmail] = useState(false);
  const [newEmailVerification, setNewEmailVerification] = useState<any | null>(null);
  const [autoVerifyNewContact, setAutoVerifyNewContact] = useState(true);
  const [allowInvalidOverride, setAllowInvalidOverride] = useState(false);

  // Single & Bulk Verification State
  const [verifyingContactId, setVerifyingContactId] = useState<string | null>(null);
  const [bulkVerifying, setBulkVerifying] = useState(false);
  const [checkingEditEmail, setCheckingEditEmail] = useState(false);
  const [editEmailVerification, setEditEmailVerification] = useState<any | null>(null);

  // Edit Contact Modal State
  const [editingContact, setEditingContact] = useState<ContactRecord | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editCompany, setEditCompany] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editStatus, setEditStatus] = useState("ACTIVE");
  const [editListId, setEditListId] = useState("");
  const [editCustomFields, setEditCustomFields] = useState<Array<{ key: string; value: string }>>([]);
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Create List Modal State
  const [isNewListModalOpen, setIsNewListModalOpen] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [newListDesc, setNewListDesc] = useState("");
  const [submittingList, setSubmittingList] = useState(false);

  // Delete List Modal State
  const [listToDelete, setListToDelete] = useState<ContactListRecord | null>(null);
  const [isDeletingList, setIsDeletingList] = useState(false);
  const [deleteListContactsOption, setDeleteListContactsOption] = useState(false);

  // Action status toast
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleConfirmDeleteList = async () => {
    if (!listToDelete) return;

    setIsDeletingList(true);
    try {
      const res = await fetch(`/api/v1/lists/${listToDelete.id}?deleteContacts=${deleteListContactsOption}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Audience list "${listToDelete.name}" deleted successfully`);
        if (selectedListId === listToDelete.id) {
          setSelectedListId("ALL");
        }
        setListToDelete(null);
        setDeleteListContactsOption(false);
        await reloadContacts();
      } else {
        showToast(data.error || "Failed to delete audience list", "error");
      }
    } catch (err: any) {
      showToast(err.message || "Failed to delete audience list", "error");
    } finally {
      setIsDeletingList(false);
    }
  };

  const reloadContacts = async () => {
    try {
      const [cRes, lRes] = await Promise.all([
        fetch("/api/v1/contacts"),
        fetch("/api/v1/lists")
      ]);
      const cData = await cRes.json();
      const lData = await lRes.json();
      if (cData.success) setContacts(cData.contacts);
      if (lData.success) setLists(lData.lists);
    } catch (e) {
      console.error(e);
    }
  };

  // Open Edit Modal with Pre-populated Data
  const handleOpenEdit = (contact: ContactRecord) => {
    setEditingContact(contact);
    setEditEmail(contact.email);
    setEditFirstName(contact.firstName || "");
    setEditLastName(contact.lastName || "");
    setEditCompany(contact.company || "");
    setEditTitle(contact.title || "");
    setEditStatus(contact.status || "ACTIVE");
    setEditError(null);
    setEditEmailVerification(null);

    const activeList = contact.listMemberships?.[0]?.listId || "NONE";
    setEditListId(activeList);

    if (contact.customFieldsJson) {
      try {
        const parsed = JSON.parse(contact.customFieldsJson);
        const pairs = Object.entries(parsed).map(([key, value]) => ({
          key,
          value: String(value)
        }));
        setEditCustomFields(pairs);
      } catch {
        setEditCustomFields([]);
      }
    } else {
      setEditCustomFields([]);
    }
  };

  // Submit Edit Contact
  const handleUpdateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingContact || !editEmail) return;

    setSubmittingEdit(true);
    setEditError(null);

    try {
      // Build custom fields object
      const customFieldsObj: Record<string, string> = {};
      editCustomFields.forEach(({ key, value }) => {
        if (key.trim()) customFieldsObj[key.trim()] = value;
      });

      const res = await fetch(`/api/v1/contacts/${editingContact.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: editEmail,
          firstName: editFirstName,
          lastName: editLastName,
          company: editCompany,
          title: editTitle,
          status: editStatus,
          customFields: customFieldsObj,
          listId: editListId,
          verificationResult: editEmailVerification
        })
      });

      const data = await res.json();
      if (data.success) {
        setEditingContact(null);
        showToast(`Contact ${editEmail} updated successfully!`);
        await reloadContacts();
      } else {
        setEditError(data.error || "Failed to update contact");
      }
    } catch (err: any) {
      setEditError(err.message || "An unexpected error occurred");
    } finally {
      setSubmittingEdit(false);
    }
  };

  // Delete Single Contact
  const handleDeleteContact = async (contactId: string, contactEmail: string) => {
    if (!confirm(`Are you sure you want to delete ${contactEmail}?`)) return;

    try {
      const res = await fetch(`/api/v1/contacts/${contactId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setContacts((prev) => prev.filter((c) => c.id !== contactId));
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(contactId);
          return next;
        });
        showToast(`Deleted ${contactEmail}`);
      } else {
        showToast(data.error || "Failed to delete contact", "error");
      }
    } catch (err: any) {
      showToast(err.message || "Failed to delete contact", "error");
    }
  };

  // Bulk Delete Selected Contacts
  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    if (!confirm(`Delete ${ids.length} selected contact(s)? This action cannot be undone.`)) return;

    setBulkDeleting(true);
    try {
      const res = await fetch("/api/v1/contacts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids })
      });

      const data = await res.json();
      if (data.success) {
        setContacts((prev) => prev.filter((c) => !selectedIds.has(c.id)));
        setSelectedIds(new Set());
        showToast(`Successfully deleted ${data.deletedCount} contacts`);
      } else {
        showToast(data.error || "Failed to delete selected contacts", "error");
      }
    } catch (err: any) {
      showToast(err.message || "Network error", "error");
    } finally {
      setBulkDeleting(false);
    }
  };

  // Bulk Add Selected Contacts to an Audience List
  const [bulkAddingToList, setBulkAddingToList] = useState(false);
  const handleBulkAddToList = async (targetListId: string) => {
    if (!targetListId) return;
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    setBulkAddingToList(true);
    try {
      const res = await fetch(`/api/v1/lists/${targetListId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactIds: ids })
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || `Added ${ids.length} contacts to audience list`);
        setSelectedIds(new Set());
        await reloadContacts();
      } else {
        showToast(data.error || "Failed to add contacts to list", "error");
      }
    } catch (err: any) {
      showToast(err.message || "Failed to add contacts to list", "error");
    } finally {
      setBulkAddingToList(false);
    }
  };

  // Check if New Email Exists using check-if-email-exists engine
  const handleCheckNewEmail = async () => {
    if (!newEmail || !newEmail.trim()) return;

    setCheckingNewEmail(true);
    setNewContactError(null);

    try {
      const res = await fetch("/api/v1/contacts/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail.trim() })
      });

      const data = await res.json();
      if (data.success && data.verification) {
        setNewEmailVerification(data.verification);
        if (data.verification.status === "SAFE") {
          showToast(`Mailbox exists & deliverable (${data.verification.durationMs}ms)`);
        } else if (data.verification.status === "RISKY") {
          showToast(`Risky mailbox: ${data.verification.message}`, "error");
        } else if (data.verification.status === "INVALID") {
          showToast(`Mailbox does not exist: ${data.verification.message}`, "error");
        } else {
          showToast(`Verification: ${data.verification.message || "Inconclusive"}`);
        }
      } else {
        setNewContactError(data.error || "Failed to verify email existence");
      }
    } catch (err: any) {
      setNewContactError(err.message || "Failed to connect to verification service");
    } finally {
      setCheckingNewEmail(false);
    }
  };

  // Check email in Edit Modal
  const handleCheckEditEmail = async () => {
    if (!editEmail || !editEmail.trim()) return;
    setCheckingEditEmail(true);
    setEditError(null);
    try {
      const res = await fetch("/api/v1/contacts/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: editEmail.trim(), skipDbCache: true })
      });
      const data = await res.json();
      if (data.success && data.verification) {
        setEditEmailVerification(data.verification);
        showToast(`Verification: ${data.verification.status} (${data.verification.message})`);
      } else {
        setEditError(data.error || "Failed to verify email");
      }
    } catch (err: any) {
      setEditError(err.message || "Failed to verify email");
    } finally {
      setCheckingEditEmail(false);
    }
  };

  // Verify deliverability for a single contact from table
  const handleVerifySingleContact = async (contact: ContactRecord) => {
    setVerifyingContactId(contact.id);
    try {
      const res = await fetch("/api/v1/contacts/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: contact.email, saveToContactId: contact.id, skipDbCache: true })
      });
      const data = await res.json();
      if (data.success && data.verification) {
        setContacts((prev) =>
          prev.map((c) =>
            c.id === contact.id
              ? {
                  ...c,
                  verificationStatus: data.verification.status,
                  verificationReason: data.verification.reason,
                  verificationCheckedAt: data.verification.checkedAt
                }
              : c
          )
        );
        showToast(`Verified ${contact.email}: ${data.verification.status} (${data.verification.reason})`);
      } else {
        showToast(data.error || "Verification failed", "error");
      }
    } catch (err: any) {
      showToast(err.message || "Network error", "error");
    } finally {
      setVerifyingContactId(null);
    }
  };

  // Bulk verify all selected contacts
  const handleBulkVerify = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    setBulkVerifying(true);
    try {
      const res = await fetch("/api/v1/contacts/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactIds: ids })
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.results)) {
        const resultMap = new Map(data.results.map((r: any) => [r.id, r.verification]));
        setContacts((prev) =>
          prev.map((c) => {
            const ver: any = resultMap.get(c.id);
            if (ver) {
              return {
                ...c,
                verificationStatus: ver.status,
                verificationReason: ver.reason,
                verificationCheckedAt: ver.checkedAt
              };
            }
            return c;
          })
        );
        showToast(`Successfully verified ${data.count} contacts!`);
      } else {
        showToast(data.error || "Failed to verify selected contacts", "error");
      }
    } catch (err: any) {
      showToast(err.message || "Network error", "error");
    } finally {
      setBulkVerifying(false);
    }
  };

  // Submit Create New Contact
  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail) return;

    // If pre-checked as INVALID and user hasn't overridden
    if (newEmailVerification && newEmailVerification.status === "INVALID" && !allowInvalidOverride) {
      setNewContactError(
        `Cannot save: Mailbox does not exist (${newEmailVerification.message}). Check "Allow adding anyway" if you wish to bypass.`
      );
      return;
    }

    setSubmittingNew(true);
    setNewContactError(null);

    try {
      const customFieldsObj: Record<string, string> = {};
      newCustomFields.forEach(({ key, value }) => {
        if (key.trim()) customFieldsObj[key.trim()] = value;
      });

      const res = await fetch("/api/v1/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail.trim(),
          firstName: newFirstName,
          lastName: newLastName,
          company: newCompany,
          title: newTitle,
          status: newStatus,
          customFields: customFieldsObj,
          listId: newListId || (selectedListId !== "ALL" ? selectedListId : undefined),
          verifyEmail: autoVerifyNewContact,
          verificationResult: newEmailVerification,
          allowInvalid: allowInvalidOverride
        })
      });

      const data = await res.json();
      if (data.success) {
        setIsNewContactOpen(false);
        setNewEmail("");
        setNewFirstName("");
        setNewLastName("");
        setNewCompany("");
        setNewTitle("");
        setNewCustomFields([]);
        setNewEmailVerification(null);
        setAllowInvalidOverride(false);
        const verBadge = data.verification ? ` [${data.verification.status}]` : "";
        showToast(`Contact ${newEmail} created!${verBadge}`);
        await reloadContacts();
      } else {
        if (data.verification) {
          setNewEmailVerification(data.verification);
        }
        setNewContactError(data.error || "Failed to create contact");
      }
    } catch (err: any) {
      setNewContactError(err.message || "Failed to create contact");
    } finally {
      setSubmittingNew(false);
    }
  };

  // Submit Create New List
  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName) return;

    setSubmittingList(true);
    try {
      const res = await fetch("/api/v1/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newListName, description: newListDesc })
      });

      const data = await res.json();
      if (data.success) {
        setIsNewListModalOpen(false);
        setNewListName("");
        setNewListDesc("");
        showToast(`Audience list "${data.list.name}" created!`);
        await reloadContacts();
      }
    } catch (err: any) {
      alert(err.message || "Failed to create list");
    } finally {
      setSubmittingList(false);
    }
  };

  // Filtered Contacts
  const filteredContacts = contacts.filter((c) => {
    const matchesList =
      selectedListId === "ALL" ||
      c.listMemberships?.some((m: any) => m.listId === selectedListId);

    const matchesStatus =
      statusFilter === "ALL" || c.status === statusFilter;

    const matchesVerification =
      verificationFilter === "ALL" ||
      (verificationFilter === "UNVERIFIED"
        ? !c.verificationStatus
        : c.verificationStatus === verificationFilter);

    const q = search.toLowerCase();
    const matchesSearch =
      !search ||
      c.email.toLowerCase().includes(q) ||
      (c.firstName && c.firstName.toLowerCase().includes(q)) ||
      (c.lastName && c.lastName.toLowerCase().includes(q)) ||
      (c.company && c.company.toLowerCase().includes(q)) ||
      (c.title && c.title.toLowerCase().includes(q));

    return matchesList && matchesStatus && matchesVerification && matchesSearch;
  });

  // Toggle selection
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredContacts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredContacts.map((c) => c.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in pb-16 relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-2xl text-xs font-semibold flex items-center gap-2 animate-in slide-in-from-top-2 duration-200 ${
            toastMessage.type === "success"
              ? "bg-emerald-600 text-white"
              : "bg-rose-600 text-white"
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Contacts & Audience Lists</h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage your recipient database with complete CRUD controls, custom tokens, and list segmentation.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsNewListModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs font-semibold transition-colors"
          >
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span>New List</span>
          </button>

          <button
            onClick={() => setIsCSVModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 text-xs font-semibold transition-colors"
          >
            <Upload className="w-3.5 h-3.5 text-cyan-400" />
            <span>Import CSV</span>
          </button>

          <button
            onClick={() => {
              setNewContactError(null);
              setNewListId(selectedListId !== "ALL" ? selectedListId : "");
              setIsNewContactOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition-all hover:scale-105"
          >
            <Plus className="w-4 h-4" />
            <span>Add Contact</span>
          </button>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-3">
        {/* List Tabs */}
        <div className="flex items-center justify-between gap-3 overflow-x-auto pb-1 text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedListId("ALL")}
              className={`px-3.5 py-1.5 rounded-xl font-medium transition-all ${
                selectedListId === "ALL"
                  ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/40"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
              }`}
            >
              All Contacts ({contacts.length})
            </button>
            {lists.map((l) => {
              const isSelected = selectedListId === l.id;
              return (
                <div
                  key={l.id}
                  className={`group inline-flex items-center gap-1 px-3 py-1 rounded-xl font-medium transition-all whitespace-nowrap border ${
                    isSelected
                      ? "bg-indigo-600/20 text-indigo-300 border-indigo-500/40 shadow-sm"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border-transparent hover:border-slate-800"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedListId(l.id)}
                    className="py-0.5 text-xs focus:outline-none"
                  >
                    {l.name} ({l._count?.members ?? 0})
                  </button>
                  <button
                    type="button"
                    title={`Delete audience list "${l.name}"`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setListToDelete(l);
                    }}
                    className="p-1 -mr-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/15 opacity-60 group-hover:opacity-100 transition-all focus:outline-none"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active Only</option>
                <option value="UNSUBSCRIBED">Unsubscribed</option>
                <option value="BOUNCED">Bounced</option>
              </select>
            </div>

            {/* Verification Deliverability Filter */}
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={verificationFilter}
                onChange={(e) => setVerificationFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
              >
                <option value="ALL">All Deliverability</option>
                <option value="SAFE">✓ Safe Only</option>
                <option value="RISKY">⚠ Risky</option>
                <option value="INVALID">✕ Invalid</option>
                <option value="UNKNOWN">? Unknown</option>
                <option value="UNVERIFIED">— Unverified</option>
              </select>
            </div>
          </div>
        </div>

        {/* Search and Quick Metrics */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-800/60">
          <div className="relative w-full sm:w-80">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, email, company, or title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-400 w-full sm:w-auto justify-between sm:justify-end">
            <span>Showing {filteredContacts.length} of {contacts.length} contacts</span>
            {selectedIds.size > 0 && (
              <span className="text-indigo-400 font-semibold">{selectedIds.size} selected</span>
            )}
          </div>
        </div>
      </div>

      {/* Active List Context Bar */}
      {selectedListId !== "ALL" && (() => {
        const activeList = lists.find((l) => l.id === selectedListId);
        if (!activeList) return null;
        return (
          <div className="flex items-center justify-between px-4 py-2.5 rounded-2xl bg-indigo-950/20 border border-indigo-500/20 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-slate-400">Audience List:</span>
              <span className="font-semibold text-white">{activeList.name}</span>
              <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[11px] font-medium">
                {activeList._count?.members ?? 0} contact{activeList._count?.members === 1 ? "" : "s"}
              </span>
              {activeList.description && (
                <span className="text-slate-400 text-[11px] italic max-w-md truncate">
                  — {activeList.description}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedListId("ALL")}
                className="px-2.5 py-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 text-[11px] transition-colors"
              >
                Show All Contacts
              </button>
              <button
                type="button"
                onClick={() => setListToDelete(activeList)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 hover:text-rose-300 text-[11px] font-semibold transition-all"
              >
                <Trash2 className="w-3 h-3" />
                <span>Delete List</span>
              </button>
            </div>
          </div>
        );
      })()}

      {/* Floating Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="sticky top-20 z-20 flex items-center justify-between px-5 py-3 rounded-2xl bg-indigo-950/90 border border-indigo-500/40 backdrop-blur-md shadow-2xl animate-in slide-in-from-top-2">
          <div className="flex items-center gap-3 text-xs font-semibold text-white">
            <span className="px-2 py-0.5 rounded-md bg-indigo-600 text-white text-[11px]">
              {selectedIds.size}
            </span>
            <span>contacts selected for bulk action</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-3 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-indigo-900/40 text-xs transition-colors"
            >
              Clear Selection
            </button>

            {/* Bulk Add to Audience List */}
            {lists.length > 0 && (
              <select
                disabled={bulkAddingToList || bulkDeleting || bulkVerifying}
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) {
                    handleBulkAddToList(e.target.value);
                    e.target.value = "";
                  }
                }}
                className="bg-indigo-900/70 hover:bg-indigo-900 border border-indigo-400/40 rounded-lg px-2.5 py-1.5 text-white text-xs font-semibold focus:outline-none transition-colors cursor-pointer"
              >
                <option value="" disabled>
                  {bulkAddingToList ? "Adding to list..." : "+ Add to Audience List..."}
                </option>
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l._count?.members ?? 0})
                  </option>
                ))}
              </select>
            )}

            <button
              disabled={bulkVerifying || bulkDeleting || bulkAddingToList}
              onClick={handleBulkVerify}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md transition-all"
              title="Verify deliverability with check-if-email-exists engine"
            >
              {bulkVerifying ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ShieldCheck className="w-3.5 h-3.5" />
              )}
              <span>Verify Deliverability</span>
            </button>
            <button
              disabled={bulkDeleting || bulkVerifying || bulkAddingToList}
              onClick={handleBulkDelete}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-md transition-all"
            >
              {bulkDeleting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
              <span>Delete Selected</span>
            </button>
          </div>
        </div>
      )}

      {/* Contacts Table */}
      {filteredContacts.length === 0 ? (
        <div className="py-20 text-center rounded-2xl bg-slate-900/30 border border-dashed border-slate-800">
          <Users className="w-10 h-10 text-indigo-400/60 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-white">No contacts match your filters</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Try adjusting your search query, selecting another list, or add contacts manually.
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <button
              onClick={() => setIsCSVModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors"
            >
              <Upload className="w-3.5 h-3.5" /> Import Spreadsheet
            </button>
            <button
              onClick={() => {
                setNewContactError(null);
                setNewListId(selectedListId !== "ALL" ? selectedListId : "");
                setIsNewContactOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add New Contact
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 select-none">
              <tr>
                <th className="py-3.5 px-4 w-10 text-center">
                  <button
                    onClick={toggleSelectAll}
                    className="text-slate-400 hover:text-white"
                    title={selectedIds.size === filteredContacts.length ? "Deselect All" : "Select All"}
                  >
                    {selectedIds.size > 0 && selectedIds.size === filteredContacts.length ? (
                      <CheckSquare className="w-4 h-4 text-indigo-400" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-600" />
                    )}
                  </button>
                </th>
                <th className="py-3.5 px-4 font-semibold">Contact</th>
                <th className="py-3.5 px-4 font-semibold">Company & Role</th>
                <th className="py-3.5 px-4 font-semibold">Custom Tokens</th>
                <th className="py-3.5 px-4 font-semibold">Audience List</th>
                <th className="py-3.5 px-4 font-semibold">Status</th>
                <th className="py-3.5 px-4 font-semibold">Verification</th>
                <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredContacts.map((c) => {
                const customFields = c.customFieldsJson ? JSON.parse(c.customFieldsJson) : {};
                const isSelected = selectedIds.has(c.id);

                return (
                  <tr
                    key={c.id}
                    className={`transition-colors ${
                      isSelected ? "bg-indigo-600/10 hover:bg-indigo-600/15" : "hover:bg-slate-800/30"
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => toggleSelectOne(c.id)}
                        className="text-slate-400 hover:text-white"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-indigo-400" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-600 hover:text-slate-400" />
                        )}
                      </button>
                    </td>

                    {/* Contact Name & Email */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-white">
                        {[c.firstName, c.lastName].filter(Boolean).join(" ") || "—"}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">{c.email}</div>
                    </td>

                    {/* Company & Role */}
                    <td className="py-3.5 px-4 text-slate-300">
                      <div className="font-medium">{c.company || "—"}</div>
                      {c.title && <div className="text-[11px] text-slate-400">{c.title}</div>}
                    </td>

                    {/* Custom Tokens */}
                    <td className="py-3.5 px-4 max-w-xs">
                      {Object.keys(customFields).length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(customFields).slice(0, 3).map(([k, v]) => (
                            <span
                              key={k}
                              className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] text-indigo-300"
                              title={`${k}: ${String(v)}`}
                            >
                              {k}: {String(v)}
                            </span>
                          ))}
                          {Object.keys(customFields).length > 3 && (
                            <span className="text-[10px] text-slate-500 self-center">
                              +{Object.keys(customFields).length - 3} more
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-500 text-[11px] italic">None</span>
                      )}
                    </td>

                    {/* List Membership */}
                    <td className="py-3.5 px-4">
                      {c.listMemberships && c.listMemberships.length > 0 ? (
                        c.listMemberships.map((m: any) => (
                          <span
                            key={m.listId}
                            className="inline-block px-2 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300 mr-1"
                          >
                            {m.list?.name}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-500 text-[11px]">Unassigned</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                          c.status === "ACTIVE"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : c.status === "UNSUBSCRIBED"
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                            : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                        }`}
                      >
                        {c.status === "ACTIVE" && <CheckCircle2 className="w-3 h-3" />}
                        {c.status === "UNSUBSCRIBED" && <UserX className="w-3 h-3" />}
                        {c.status === "BOUNCED" && <Ban className="w-3 h-3" />}
                        <span>{c.status}</span>
                      </span>
                    </td>

                    {/* Verification Status Badge */}
                    <td className="py-3.5 px-4">
                      {c.verificationStatus === "SAFE" ? (
                        <span
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          title={c.verificationReason || "Safe / Deliverable"}
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Safe</span>
                        </span>
                      ) : c.verificationStatus === "RISKY" ? (
                        <span
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          title={c.verificationReason || "Risky / Cannot be fully confirmed"}
                        >
                          <AlertTriangle className="w-3 h-3" />
                          <span>Risky</span>
                        </span>
                      ) : c.verificationStatus === "INVALID" ? (
                        <span
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          title={c.verificationReason || "Invalid"}
                        >
                          <Ban className="w-3 h-3" />
                          <span>Invalid</span>
                        </span>
                      ) : c.verificationStatus === "UNKNOWN" ? (
                        <span
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700"
                          title={c.verificationReason || "Unknown"}
                        >
                          <AlertCircle className="w-3 h-3" />
                          <span>Unknown</span>
                        </span>
                      ) : (
                        <span className="text-slate-500 text-[11px]">—</span>
                      )}
                    </td>

                    {/* CRUD Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleVerifySingleContact(c)}
                          disabled={verifyingContactId === c.id}
                          className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-emerald-600 text-slate-300 hover:text-white transition-all disabled:opacity-50"
                          title="Verify email deliverability (check-if-email-exists)"
                        >
                          {verifyingContactId === c.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                          ) : (
                            <ShieldCheck className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          onClick={() => handleOpenEdit(c)}
                          className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-indigo-600 text-slate-300 hover:text-white transition-all"
                          title="Edit Contact"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteContact(c.id, c.email)}
                          className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-rose-600 text-slate-400 hover:text-white transition-all"
                          title="Delete Contact"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL: ADD CONTACT */}
      {isNewContactOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <form
            onSubmit={handleCreateContact}
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-white text-base">Add New Contact</h3>
                <p className="text-xs text-slate-400">Add an individual recipient to your audience</p>
              </div>
              <button
                type="button"
                onClick={() => setIsNewContactOpen(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {newContactError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
                {newContactError}
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-300 font-medium">Email Address *</label>
                  <button
                    type="button"
                    onClick={handleCheckNewEmail}
                    disabled={!newEmail.trim() || checkingNewEmail}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-[11px] font-semibold text-indigo-300 disabled:opacity-50 disabled:pointer-events-none transition-all shadow-sm"
                  >
                    {checkingNewEmail ? (
                      <Loader2 className="w-3 h-3 animate-spin text-indigo-400" />
                    ) : (
                      <ShieldCheck className="w-3 h-3 text-indigo-400" />
                    )}
                    <span>Check if Email Exists</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="email"
                    required
                    placeholder="prospect@company.com"
                    value={newEmail}
                    onChange={(e) => {
                      setNewEmail(e.target.value);
                      if (newEmailVerification) {
                        setNewEmailVerification(null);
                        setAllowInvalidOverride(false);
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Checking animation */}
                {checkingNewEmail && (
                  <div className="mt-2 p-2.5 rounded-xl bg-indigo-950/40 border border-indigo-500/20 flex items-center gap-2.5 text-xs text-indigo-300 animate-in fade-in">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400 flex-shrink-0" />
                    <span>Checking email existence (check-if-email-exists: syntax, MX records, SMTP probe)...</span>
                  </div>
                )}

                {/* Verification Result Card */}
                {newEmailVerification && !checkingNewEmail && (
                  <div
                    className={`mt-2 p-3 rounded-xl border text-xs animate-in fade-in space-y-1.5 ${
                      newEmailVerification.status === "SAFE"
                        ? "bg-emerald-950/30 border-emerald-500/30 text-emerald-300"
                        : newEmailVerification.status === "RISKY"
                        ? "bg-amber-950/30 border-amber-500/30 text-amber-300"
                        : newEmailVerification.status === "INVALID"
                        ? "bg-rose-950/30 border-rose-500/30 text-rose-300"
                        : "bg-slate-900 border-slate-700 text-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-semibold">
                        {newEmailVerification.status === "SAFE" && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                        {newEmailVerification.status === "RISKY" && <AlertTriangle className="w-4 h-4 text-amber-400" />}
                        {newEmailVerification.status === "INVALID" && <Ban className="w-4 h-4 text-rose-400" />}
                        {newEmailVerification.status === "UNKNOWN" && <AlertCircle className="w-4 h-4 text-slate-400" />}
                        <span>
                          {newEmailVerification.status === "SAFE" && "Mailbox Exists & Deliverable"}
                          {newEmailVerification.status === "RISKY" && "Mailbox Exists (Risky / Catch-All / Role)"}
                          {newEmailVerification.status === "INVALID" && "Mailbox Does Not Exist / Invalid"}
                          {newEmailVerification.status === "UNKNOWN" && "Verification Inconclusive"}
                        </span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          newEmailVerification.status === "SAFE"
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                            : newEmailVerification.status === "RISKY"
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                            : newEmailVerification.status === "INVALID"
                            ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                            : "bg-slate-800 text-slate-300 border border-slate-700"
                        }`}
                      >
                        {newEmailVerification.status}
                      </span>
                    </div>

                    <p className="text-[11px] opacity-90">{newEmailVerification.message}</p>

                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/10 text-[10px] opacity-80">
                      <div>
                        <span className="text-slate-400">Mail Provider: </span>
                        <span className="font-medium text-white">{newEmailVerification.dns?.provider || "Standard MX"}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Response Time: </span>
                        <span className="font-medium text-white">{newEmailVerification.durationMs}ms</span>
                      </div>
                    </div>

                    {newEmailVerification.status === "INVALID" && (
                      <label className="flex items-center gap-2 pt-1.5 border-t border-rose-500/20 text-rose-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={allowInvalidOverride}
                          onChange={(e) => setAllowInvalidOverride(e.target.checked)}
                          className="rounded border-rose-500 text-rose-600 focus:ring-0"
                        />
                        <span className="text-[11px]">Allow adding this contact anyway (skip deliverability block)</span>
                      </label>
                    )}
                  </div>
                )}

                {/* Auto-verify setting toggle */}
                <div className="flex items-center justify-between pt-1.5 text-[11px] text-slate-400">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoVerifyNewContact}
                      onChange={(e) => setAutoVerifyNewContact(e.target.checked)}
                      className="rounded border-slate-800 text-indigo-600 focus:ring-0"
                    />
                    <span>Auto-verify with check-if-email-exists on save</span>
                  </label>
                  <span className="text-slate-500 text-[10px]">Syntax • MX • Mailbox</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">First Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Sarah"
                    value={newFirstName}
                    onChange={(e) => setNewFirstName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Last Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Connor"
                    value={newLastName}
                    onChange={(e) => setNewLastName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Company</label>
                  <input
                    type="text"
                    placeholder="e.g. Acme Labs"
                    value={newCompany}
                    onChange={(e) => setNewCompany(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Job Title</label>
                  <input
                    type="text"
                    placeholder="e.g. VP of Sales"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Status</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="UNSUBSCRIBED">UNSUBSCRIBED</option>
                    <option value="BOUNCED">BOUNCED</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Assign to List</label>
                  <select
                    value={newListId}
                    onChange={(e) => setNewListId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">No List Assigned</option>
                    {lists.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Custom Tokens Builder */}
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-medium flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-indigo-400" />
                    Custom Personalization Tokens
                  </span>
                  <button
                    type="button"
                    onClick={() => setNewCustomFields([...newCustomFields, { key: "", value: "" }])}
                    className="text-indigo-400 hover:text-indigo-300 text-[11px] font-medium flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Add Token
                  </button>
                </div>

                {newCustomFields.length === 0 ? (
                  <p className="text-[11px] text-slate-500 italic">
                    Add custom tokens like city, valuation, or phone to use in template tags: {"{{city}}"}
                  </p>
                ) : (
                  <div className="space-y-2 pt-1">
                    {newCustomFields.map((field, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Token (e.g. city)"
                          value={field.key}
                          onChange={(e) => {
                            const updated = [...newCustomFields];
                            updated[idx].key = e.target.value;
                            setNewCustomFields(updated);
                          }}
                          className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
                        />
                        <input
                          type="text"
                          placeholder="Value (e.g. Austin)"
                          value={field.value}
                          onChange={(e) => {
                            const updated = [...newCustomFields];
                            updated[idx].value = e.target.value;
                            setNewCustomFields(updated);
                          }}
                          className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-white text-xs focus:outline-none focus:border-indigo-500"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setNewCustomFields(newCustomFields.filter((_, i) => i !== idx));
                          }}
                          className="p-1 text-slate-500 hover:text-rose-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsNewContactOpen(false)}
                className="px-3.5 py-2 text-xs text-slate-400 hover:text-white rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingNew}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30"
              >
                {submittingNew ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                <span>Save Contact</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: EDIT CONTACT */}
      {editingContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <form
            onSubmit={handleUpdateContact}
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-white text-base">Edit Contact</h3>
                <p className="text-xs text-slate-400">Update details and token tags for {editingContact.email}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingContact(null)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
                {editError}
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-300 font-medium">Email Address *</label>
                  <button
                    type="button"
                    onClick={handleCheckEditEmail}
                    disabled={!editEmail.trim() || checkingEditEmail}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-[11px] font-semibold text-indigo-300 disabled:opacity-50 disabled:pointer-events-none transition-all shadow-sm"
                  >
                    {checkingEditEmail ? (
                      <Loader2 className="w-3 h-3 animate-spin text-indigo-400" />
                    ) : (
                      <ShieldCheck className="w-3 h-3 text-indigo-400" />
                    )}
                    <span>Re-verify Email</span>
                  </button>
                </div>
                <input
                  type="email"
                  required
                  value={editEmail}
                  onChange={(e) => {
                    setEditEmail(e.target.value);
                    if (editEmailVerification) setEditEmailVerification(null);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                />

                {checkingEditEmail && (
                  <div className="mt-2 p-2 rounded-xl bg-indigo-950/40 border border-indigo-500/20 flex items-center gap-2 text-xs text-indigo-300">
                    <Loader2 className="w-3 h-3 animate-spin text-indigo-400" />
                    <span>Checking email existence...</span>
                  </div>
                )}

                {editEmailVerification && !checkingEditEmail && (
                  <div
                    className={`mt-2 p-2.5 rounded-xl border text-xs space-y-1 ${
                      editEmailVerification.status === "SAFE"
                        ? "bg-emerald-950/30 border-emerald-500/30 text-emerald-300"
                        : editEmailVerification.status === "RISKY"
                        ? "bg-amber-950/30 border-amber-500/30 text-amber-300"
                        : editEmailVerification.status === "INVALID"
                        ? "bg-rose-950/30 border-rose-500/30 text-rose-300"
                        : "bg-slate-900 border-slate-700 text-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between font-semibold">
                      <span>Status: {editEmailVerification.status}</span>
                      <span className="text-[10px] opacity-75">{editEmailVerification.durationMs}ms</span>
                    </div>
                    <p className="text-[11px] opacity-90">{editEmailVerification.message}</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">First Name</label>
                  <input
                    type="text"
                    value={editFirstName}
                    onChange={(e) => setEditFirstName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Last Name</label>
                  <input
                    type="text"
                    value={editLastName}
                    onChange={(e) => setEditLastName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Company</label>
                  <input
                    type="text"
                    value={editCompany}
                    onChange={(e) => setEditCompany(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Job Title</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="UNSUBSCRIBED">UNSUBSCRIBED</option>
                    <option value="BOUNCED">BOUNCED</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Audience List</label>
                  <select
                    value={editListId}
                    onChange={(e) => setEditListId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="NONE">Unassigned (No List)</option>
                    {lists.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Custom Tokens Builder */}
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-medium flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-indigo-400" />
                    Custom Personalization Tokens
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditCustomFields([...editCustomFields, { key: "", value: "" }])}
                    className="text-indigo-400 hover:text-indigo-300 text-[11px] font-medium flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Add Token
                  </button>
                </div>

                {editCustomFields.length === 0 ? (
                  <p className="text-[11px] text-slate-500 italic">No custom tokens defined.</p>
                ) : (
                  <div className="space-y-2 pt-1">
                    {editCustomFields.map((field, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Token (e.g. city)"
                          value={field.key}
                          onChange={(e) => {
                            const updated = [...editCustomFields];
                            updated[idx].key = e.target.value;
                            setEditCustomFields(updated);
                          }}
                          className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
                        />
                        <input
                          type="text"
                          placeholder="Value"
                          value={field.value}
                          onChange={(e) => {
                            const updated = [...editCustomFields];
                            updated[idx].value = e.target.value;
                            setEditCustomFields(updated);
                          }}
                          className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-white text-xs focus:outline-none focus:border-indigo-500"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setEditCustomFields(editCustomFields.filter((_, i) => i !== idx));
                          }}
                          className="p-1 text-slate-500 hover:text-rose-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setEditingContact(null)}
                className="px-3.5 py-2 text-xs text-slate-400 hover:text-white rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingEdit}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30"
              >
                {submittingEdit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                <span>Save Changes</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: CREATE NEW LIST */}
      {isNewListModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <form
            onSubmit={handleCreateList}
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white text-base">Create Audience List</h3>
              <button
                type="button"
                onClick={() => setIsNewListModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1">List Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Q4 Enterprise SaaS Leads"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Description (Optional)</label>
                <textarea
                  rows={3}
                  placeholder="Brief context or segment criteria..."
                  value={newListDesc}
                  onChange={(e) => setNewListDesc(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsNewListModalOpen(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingList}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
              >
                {submittingList ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                <span>Create List</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* DELETE AUDIENCE LIST MODAL */}
      {listToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-rose-400">
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
                  <Trash2 className="w-5 h-5 text-rose-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-base">Delete Audience List</h3>
                  <p className="text-xs text-slate-400">Remove list from your workspace</p>
                </div>
              </div>
              <button
                type="button"
                disabled={isDeletingList}
                onClick={() => {
                  setListToDelete(null);
                  setDeleteListContactsOption(false);
                }}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs text-slate-300">
              <p className="leading-relaxed">
                Are you sure you want to delete{" "}
                <span className="font-semibold text-white bg-slate-800/80 border border-slate-700/60 px-2 py-0.5 rounded-lg">
                  {listToDelete.name}
                </span>
                ?
              </p>

              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={deleteListContactsOption}
                    onChange={(e) => setDeleteListContactsOption(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-700 bg-slate-900 text-rose-600 focus:ring-rose-500 focus:ring-offset-slate-900"
                  />
                  <div className="text-xs">
                    <span className="font-medium text-rose-300">Also delete contacts in this list</span>
                    <p className="text-slate-400 text-[11px] mt-0.5 leading-normal">
                      When unchecked, only this list category is removed; the {listToDelete._count?.members ?? 0} contact(s) remain intact under All Contacts.
                    </p>
                  </div>
                </label>
              </div>

              <div className="flex items-start gap-2 text-[11px] text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                <span>This list will be removed permanently. Active or scheduled campaigns referencing this audience will have their list detachment updated safely.</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                disabled={isDeletingList}
                onClick={() => {
                  setListToDelete(null);
                  setDeleteListContactsOption(false);
                }}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingList}
                onClick={handleConfirmDeleteList}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-md shadow-rose-600/30 transition-all disabled:opacity-50"
              >
                {isDeletingList ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>{isDeletingList ? "Deleting..." : "Delete List"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSV IMPORT MODAL */}
      <CSVImportModal
        isOpen={isCSVModalOpen}
        onClose={() => setIsCSVModalOpen(false)}
        onImportComplete={reloadContacts}
        existingLists={lists}
        initialListId={selectedListId !== "ALL" ? selectedListId : undefined}
      />
    </div>
  );
}
