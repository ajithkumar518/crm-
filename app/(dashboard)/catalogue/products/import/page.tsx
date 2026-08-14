"use client";

import { useState } from "react";

export default function ProductImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [dryRun, setDryRun] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    setLoading(true);
    try {
      const res = await fetch(`/api/catalogue/products/import?dryRun=${dryRun}`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      setResult({ success: false, message: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Product Master Import</h1>
      <p className="text-sm text-gray-600 mb-6">
        Upload an Excel file with columns: Material Grade, Material Size, Part Number, RM Make, UOM, Material Category, Product Description.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded shadow">
        <div>
          <label className="block text-sm font-medium mb-1">Excel File</label>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm border rounded p-2"
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            id="dryRun"
            type="checkbox"
            checked={dryRun}
            onChange={(e) => setDryRun(e.target.checked)}
          />
          <label htmlFor="dryRun" className="text-sm">Preview only (dry run)</label>
        </div>
        <button
          type="submit"
          disabled={!file || loading}
          className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
        >
          {loading ? "Processing..." : dryRun ? "Preview" : "Import"}
        </button>
      </form>

      {result && (
        <div className="mt-6 bg-gray-50 p-4 rounded border">
          {result.success ? (
            <>
              <p className="font-medium">Total: {result.total} | Created: {result.created} | Errors: {result.errors}</p>
              {Array.isArray(result.details) && result.details.length > 0 && (
                <div className="mt-3 max-h-64 overflow-auto">
                  <table className="w-full text-sm border-collapse border">
                    <thead>
                      <tr className="bg-gray-200">
                        <th className="border p-2">Row</th>
                        <th className="border p-2">Code / Name</th>
                        <th className="border p-2">Status</th>
                        <th className="border p-2">Errors</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.details.map((r: any, i: number) => (
                        <tr key={i}>
                          <td className="border p-2">{r.row}</td>
                          <td className="border p-2">{r.productCode || r.customerCode} - {r.name}</td>
                          <td className="border p-2">{r.status}</td>
                          <td className="border p-2 text-red-600">{r.errors?.join("; ") || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (
            <p className="text-red-600">{result.message}</p>
          )}
        </div>
      )}
    </div>
  );
}
