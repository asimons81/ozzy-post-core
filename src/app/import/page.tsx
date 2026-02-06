import CSVImporter from "@/components/import/CSVImporter";

export default function ImportPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[#2a2c31] bg-[#050506] p-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-[#e0e0e0]">
              Import CSV
            </h1>
            <p className="mt-2 text-sm text-[#a7a7a7] max-w-2xl">
              Drop a CSV, map columns to the expected fields, preview the first 5
              rows, then send the mapped payload to a server action.
            </p>
          </div>
          <div className="hidden md:block text-right">
            <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-[#00f2ff]">
              Cyber-Industrial
            </div>
            <div className="mt-1 text-xs text-[#7d7d7d]">
              Client parse, server save
            </div>
          </div>
        </div>
      </div>

      <CSVImporter />
    </div>
  );
}

