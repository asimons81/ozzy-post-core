"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Papa from "papaparse";
import { Upload, AlertTriangle, CheckCircle2, ArrowRight } from "lucide-react";
import {
  saveImportedPosts,
  type ImportFieldKey,
  type ImportMapping,
  type ImportedPostRow,
} from "@/app/import/actions";

type CsvRow = Record<string, string>;

const EXPECTED_FIELDS: Array<{ key: ImportFieldKey; label: string; hint: string }> =
  [
    { key: "postId", label: "Post ID", hint: "Unique post identifier" },
    { key: "text", label: "Text", hint: "Post content/body" },
    { key: "createdAt", label: "Created At", hint: "Timestamp or date string" },
    { key: "likes", label: "Likes", hint: "Count" },
    { key: "reposts", label: "Reposts", hint: "Count" },
    { key: "replies", label: "Replies", hint: "Count" },
    { key: "quotes", label: "Quotes", hint: "Count" },
    { key: "impressions", label: "Impressions", hint: "Count" },
    { key: "engagementRate", label: "Engagement Rate", hint: "Percent or decimal" },
    { key: "clicks", label: "Clicks", hint: "Count" },
  ];

function norm(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[_-]+/g, " ")
    .replace(/[^\w\s%]/g, "");
}

function toNumber(raw: unknown): number | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;

  // Allow "1,234", "12.3%", "  45  " etc.
  const cleaned = s.replace(/,/g, "").replace(/%/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function suggestedHeaderForField(field: ImportFieldKey, headers: string[]) {
  const nHeaders = headers.map((h) => ({ raw: h, n: norm(h) }));

  const candidates: Record<ImportFieldKey, string[]> = {
    postId: ["post id", "postid", "id", "tweet id", "tweetid", "status id", "statusid"],
    text: ["text", "content", "body", "message", "post", "tweet text", "tweet"],
    createdAt: ["created at", "created", "timestamp", "time", "date", "datetime"],
    likes: ["likes", "like", "favorites", "favourites"],
    reposts: ["reposts", "repost", "retweets", "retweet", "shares", "share"],
    replies: ["replies", "reply", "comments", "comment"],
    quotes: ["quotes", "quote", "quote tweets", "quote tweet"],
    impressions: ["impressions", "impression", "views", "view"],
    engagementRate: ["engagement rate", "engagementrate", "er", "engagement %", "engagement percent"],
    clicks: ["clicks", "click", "link clicks", "url clicks"],
  };

  const wanted = candidates[field].map(norm);

  // Exact normalized match first.
  for (const w of wanted) {
    const hit = nHeaders.find((h) => h.n === w);
    if (hit) return hit.raw;
  }

  // Contains match fallback.
  for (const w of wanted) {
    const hit = nHeaders.find((h) => h.n.includes(w) || w.includes(h.n));
    if (hit) return hit.raw;
  }

  return "";
}

function emptyMapping(): ImportMapping {
  return {
    postId: "",
    text: "",
    createdAt: "",
    likes: "",
    reposts: "",
    replies: "",
    quotes: "",
    impressions: "",
    engagementRate: "",
    clicks: "",
  };
}

function mapCsvRow(row: CsvRow, mapping: ImportMapping): ImportedPostRow {
  const get = (k: ImportFieldKey) => {
    const h = mapping[k];
    if (!h) return null;
    const v = row[h];
    if (v == null) return null;
    const s = String(v).trim();
    return s ? s : null;
  };

  return {
    postId: get("postId"),
    text: get("text"),
    createdAt: get("createdAt"),
    likes: toNumber(get("likes")),
    reposts: toNumber(get("reposts")),
    replies: toNumber(get("replies")),
    quotes: toNumber(get("quotes")),
    impressions: toNumber(get("impressions")),
    engagementRate: toNumber(get("engagementRate")),
    clicks: toNumber(get("clicks")),
  };
}

export default function CSVImporter() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [mapping, setMapping] = useState<ImportMapping>(emptyMapping());

  const [parseError, setParseError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<"idle" | "ok" | "err">("idle");
  const [isPending, startTransition] = useTransition();

  const hasData = rows.length > 0 && headers.length > 0;

  const mappedRows: ImportedPostRow[] = useMemo(() => {
    if (!hasData) return [];
    return rows.map((r) => mapCsvRow(r, mapping));
  }, [hasData, rows, mapping]);

  const previewRows = useMemo(() => mappedRows.slice(0, 5), [mappedRows]);

  const mappingCompleteness = useMemo(() => {
    const chosen = Object.values(mapping).filter(Boolean);
    const uniqueChosen = new Set(chosen).size;
    const hasDuplicates = uniqueChosen !== chosen.length;
    const requiredOk = Boolean(mapping.postId && mapping.text && mapping.createdAt);
    return { requiredOk, hasDuplicates };
  }, [mapping]);

  function resetState() {
    setParseError(null);
    setImportResult("idle");
    setHeaders([]);
    setRows([]);
    setMapping(emptyMapping());
  }

  function handleFile(file: File) {
    resetState();
    setFileName(file.name);

    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete: (result) => {
        if (result.errors?.length) {
          setParseError(result.errors[0]?.message ?? "CSV parse failed");
          return;
        }

        const parsedRows = (result.data ?? []).filter((r) => r && Object.keys(r).length > 0);
        const parsedHeaders =
          (result.meta?.fields ?? Object.keys(parsedRows[0] ?? {})).filter(Boolean);

        if (!parsedHeaders.length) {
          setParseError("No headers detected. Ensure the first row contains column names.");
          return;
        }

        setHeaders(parsedHeaders);
        setRows(parsedRows);

        const nextMapping = emptyMapping();
        for (const f of EXPECTED_FIELDS) {
          nextMapping[f.key] = suggestedHeaderForField(f.key, parsedHeaders);
        }
        setMapping(nextMapping);
      },
      error: (err) => setParseError(err.message ?? "CSV parse failed"),
    });
  }

  async function onImport() {
    setImportResult("idle");
    startTransition(async () => {
      try {
        const payload = {
          fileName,
          mapping,
          rows: mappedRows,
        };
        const res = await saveImportedPosts(payload);
        setImportResult(res.success ? "ok" : "err");
      } catch {
        setImportResult("err");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[#2a2c31] bg-[#0f1012] p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-[#7d7d7d]">
              Step 1
            </div>
            <div className="mt-1 text-lg font-semibold text-[#e0e0e0]">
              Upload CSV
            </div>
            <div className="mt-1 text-sm text-[#a7a7a7]">
              Drag and drop a file, or click the zone to browse.
            </div>
          </div>

          {fileName ? (
            <div className="text-right">
              <div className="text-xs text-[#e0e0e0]">{fileName}</div>
              <div className="mt-1 text-[10px] font-mono uppercase tracking-[0.25em] text-[#00f2ff]">
                {rows.length.toLocaleString()} rows
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-5">
          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
            }}
            onDragEnter={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDragging(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDragging(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDragging(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) handleFile(file);
            }}
            className={[
              "group relative overflow-hidden rounded-2xl border p-6 outline-none transition-colors",
              isDragging
                ? "border-[#00f2ff] bg-[#050506]"
                : "border-[#2a2c31] bg-[#050506] hover:border-[#00f2ff]/50",
            ].join(" ")}
          >
            <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="absolute -top-24 -left-24 h-56 w-56 rounded-full bg-[#00f2ff]/10 blur-2xl" />
              <div className="absolute -bottom-24 -right-24 h-56 w-56 rounded-full bg-[#00f2ff]/10 blur-2xl" />
            </div>

            <div className="relative flex items-center gap-4">
              <div className="grid h-12 w-12 place-items-center rounded-xl border border-[#2a2c31] bg-[#0f1012] text-[#00f2ff]">
                <Upload size={20} />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-[#e0e0e0]">
                  Drop CSV here
                </div>
                <div className="mt-1 text-xs text-[#7d7d7d]">
                  Parses on-device for preview only
                </div>
              </div>
              <div className="ml-auto hidden sm:flex items-center gap-2 text-xs font-mono uppercase tracking-[0.25em] text-[#7d7d7d]">
                Browse
                <ArrowRight size={14} className="text-[#00f2ff]" />
              </div>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />

          {parseError ? (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-[#2a2c31] bg-[#050506] p-3 text-sm text-[#e0e0e0]">
              <AlertTriangle className="mt-0.5 text-[#00f2ff]" size={16} />
              <div>
                <div className="font-semibold">Parse error</div>
                <div className="mt-1 text-xs text-[#a7a7a7]">{parseError}</div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#2a2c31] bg-[#0f1012] p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-[#7d7d7d]">
                Step 2
              </div>
              <div className="mt-1 text-lg font-semibold text-[#e0e0e0]">
                Map Columns
              </div>
              <div className="mt-1 text-sm text-[#a7a7a7]">
                Match CSV headers to the expected fields.
              </div>
            </div>

            <div className="text-right">
              <div
                className={[
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-mono uppercase tracking-[0.25em]",
                  mappingCompleteness.requiredOk && !mappingCompleteness.hasDuplicates
                    ? "border-[#00f2ff]/30 text-[#00f2ff]"
                    : "border-[#2a2c31] text-[#7d7d7d]",
                ].join(" ")}
              >
                {mappingCompleteness.requiredOk && !mappingCompleteness.hasDuplicates ? (
                  <>
                    <CheckCircle2 size={12} />
                    Ready
                  </>
                ) : (
                  <>
                    <AlertTriangle size={12} />
                    Needs mapping
                  </>
                )}
              </div>
              <div className="mt-2 text-xs text-[#7d7d7d]">
                Requires: Post ID, Text, Created At
              </div>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {!hasData ? (
              <div className="rounded-xl border border-[#2a2c31] bg-[#050506] p-4 text-sm text-[#a7a7a7]">
                Upload a CSV to populate headers.
              </div>
            ) : null}

            {hasData
              ? EXPECTED_FIELDS.map((f) => (
                  <div
                    key={f.key}
                    className="flex items-center gap-3 rounded-xl border border-[#2a2c31] bg-[#050506] p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-[#e0e0e0]">
                        {f.label}
                      </div>
                      <div className="mt-1 text-xs text-[#7d7d7d]">{f.hint}</div>
                    </div>

                    <div className="w-[220px]">
                        <select
                          value={mapping[f.key]}
                          onChange={(e) =>
                          setMapping((m: ImportMapping) => ({ ...m, [f.key]: e.target.value }))
                          }
                          className="w-full rounded-lg border border-[#2a2c31] bg-[#0f1012] px-3 py-2 text-sm text-[#e0e0e0] outline-none focus:border-[#00f2ff]/70"
                        >
                        <option value="">(ignore)</option>
                        {headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))
              : null}

            {hasData && mappingCompleteness.hasDuplicates ? (
              <div className="rounded-xl border border-[#2a2c31] bg-[#050506] p-4 text-xs text-[#a7a7a7]">
                Duplicate mappings detected: two fields are pointing at the same
                CSV column.
              </div>
            ) : null}
          </div>

          <div className="mt-5 flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-xl border border-[#2a2c31] bg-[#050506] px-4 py-2 text-sm text-[#e0e0e0] hover:border-[#00f2ff]/50 transition-colors"
            >
              Choose another file
            </button>

            <button
              type="button"
              onClick={onImport}
              disabled={
                !hasData ||
                !mappingCompleteness.requiredOk ||
                mappingCompleteness.hasDuplicates ||
                isPending
              }
              className={[
                "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors",
                !hasData ||
                !mappingCompleteness.requiredOk ||
                mappingCompleteness.hasDuplicates ||
                isPending
                  ? "cursor-not-allowed border border-[#2a2c31] bg-[#050506] text-[#7d7d7d]"
                  : "border border-[#00f2ff]/40 bg-[#00f2ff]/10 text-[#00f2ff] hover:bg-[#00f2ff]/15",
              ].join(" ")}
            >
              {isPending ? "Importing..." : "Import (server action)"}
              <ArrowRight size={16} />
            </button>
          </div>

          {importResult !== "idle" ? (
            <div className="mt-4 rounded-xl border border-[#2a2c31] bg-[#050506] p-4 text-sm text-[#e0e0e0]">
              {importResult === "ok" ? (
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 text-[#00f2ff]" size={16} />
                  <div>
                    <div className="font-semibold">Import queued</div>
                    <div className="mt-1 text-xs text-[#a7a7a7]">
                      Server action logged the payload (check server console).
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 text-[#00f2ff]" size={16} />
                  <div>
                    <div className="font-semibold">Import failed</div>
                    <div className="mt-1 text-xs text-[#a7a7a7]">
                      The server action threw an error.
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-[#2a2c31] bg-[#0f1012] p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-[#7d7d7d]">
                Step 3
              </div>
              <div className="mt-1 text-lg font-semibold text-[#e0e0e0]">
                Preview (First 5)
              </div>
              <div className="mt-1 text-sm text-[#a7a7a7]">
                Mapped values as they’ll be sent to the server action.
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-[#00f2ff]">
                {mappedRows.length ? mappedRows.length.toLocaleString() : "0"}{" "}
                mapped
              </div>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-[#2a2c31] bg-[#050506]">
            <div className="overflow-x-auto">
              <table className="min-w-[900px] w-full border-collapse text-left text-xs">
                <thead className="bg-[#0f1012]">
                  <tr>
                    {EXPECTED_FIELDS.map((f) => (
                      <th
                        key={f.key}
                        className="border-b border-[#2a2c31] px-3 py-2 font-mono uppercase tracking-[0.2em] text-[#7d7d7d]"
                      >
                        {f.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {!hasData ? (
                    <tr>
                      <td
                        colSpan={EXPECTED_FIELDS.length}
                        className="px-4 py-10 text-center text-sm text-[#7d7d7d]"
                      >
                        Upload a CSV to see a preview.
                      </td>
                    </tr>
                  ) : previewRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={EXPECTED_FIELDS.length}
                        className="px-4 py-10 text-center text-sm text-[#7d7d7d]"
                      >
                        No rows parsed.
                      </td>
                    </tr>
                  ) : (
                    previewRows.map((r, idx) => (
                      <tr
                        key={idx}
                        className="odd:bg-[#050506] even:bg-[#07070a]"
                      >
                        {EXPECTED_FIELDS.map((f) => {
                          const v = r[f.key];
                          const rendered =
                            v == null ? (
                              <span className="text-[#3f4147]">-</span>
                            ) : typeof v === "number" ? (
                              <span className="text-[#e0e0e0]">
                                {Number.isInteger(v) ? v : v}
                              </span>
                            ) : (
                              <span className="text-[#e0e0e0]">{v}</span>
                            );

                          return (
                            <td
                              key={f.key}
                              className="border-t border-[#2a2c31] px-3 py-2 align-top"
                            >
                              <div className="max-w-[260px] truncate">
                                {rendered}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 text-xs text-[#7d7d7d]">
            Tip: if your CSV uses different header names, adjust mappings on the
            left. Values are not yet validated or persisted.
          </div>
        </div>
      </div>
    </div>
  );
}
