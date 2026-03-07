"use client";

import { useState, useCallback, useRef } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/components/admin/role-context";

// Field aliases for auto-mapping from various inventory apps
// (Zoho Inventory, Shopify, WooCommerce, Tally, etc.)
const FIELD_ALIASES: Record<string, string[]> = {
  name: [
    "name",
    "item name",
    "product name",
    "title",
    "product title",
    "item",
    "product",
    "item description",
  ],
  description: [
    "description",
    "product description",
    "long description",
    "details",
    "body (html)",
    "body",
    "short description",
  ],
  price: [
    "price",
    "rate",
    "selling price",
    "unit price",
    "sales rate",
    "mrp",
    "variant price",
    "amount",
    "cost price",
  ],
  compare_at_price: [
    "compare at price",
    "compare price",
    "original price",
    "list price",
    "variant compare at price",
    "msrp",
  ],
  sku: [
    "sku",
    "item code",
    "product code",
    "barcode",
    "upc",
    "ean",
    "isbn",
    "variant sku",
    "hsn/sac",
    "hsn code",
    "part number",
  ],
  stock_quantity: [
    "stock",
    "quantity",
    "stock on hand",
    "opening stock",
    "qty",
    "inventory",
    "available quantity",
    "stock quantity",
    "variant inventory qty",
    "warehouse stock",
    "current stock",
    "quantity in stock",
  ],
  brand: [
    "brand",
    "manufacturer",
    "vendor",
    "supplier",
    "make",
    "brand name",
  ],
  category: [
    "category",
    "product category",
    "group",
    "type",
    "product type",
    "item group",
    "department",
    "collection",
    "product group",
  ],
  age_range: ["age range", "age group", "age", "target age"],
  tags: ["tags", "tag", "keywords", "labels", "product tags"],
  is_active: ["status", "active", "is active", "published", "visibility"],
  is_featured: ["featured", "is featured", "highlight", "promoted"],
};

const PRODUCT_FIELDS = [
  { key: "name", label: "Product Name", required: true },
  { key: "description", label: "Description" },
  { key: "price", label: "Price", required: true },
  { key: "compare_at_price", label: "Compare At Price" },
  { key: "sku", label: "SKU" },
  { key: "stock_quantity", label: "Stock Quantity" },
  { key: "brand", label: "Brand" },
  { key: "category", label: "Category" },
  { key: "age_range", label: "Age Range" },
  { key: "tags", label: "Tags" },
  { key: "is_active", label: "Active Status" },
  { key: "is_featured", label: "Featured" },
];

const SKIP_VALUE = "__skip__";

type Step = "upload" | "mapping" | "preview" | "importing" | "results";

interface ImportResults {
  success: number;
  failed: number;
  errors: { row: number; name: string; error: string }[];
}

function autoMapColumn(header: string): string {
  const normalized = header.toLowerCase().trim();
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    if (aliases.includes(normalized)) return field;
  }
  // Fuzzy: check if the header contains a known alias
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    for (const alias of aliases) {
      if (normalized.includes(alias) || alias.includes(normalized)) {
        return field;
      }
    }
  }
  return SKIP_VALUE;
}

function parseFileData(
  file: File
): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  return new Promise((resolve, reject) => {
    const ext = file.name.split(".").pop()?.toLowerCase();

    if (ext === "csv" || ext === "tsv" || ext === "txt") {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h: string) => h.trim(),
        complete: (result) => {
          const headers = result.meta.fields || [];
          resolve({ headers, rows: result.data as Record<string, string>[] });
        },
        error: (err) => reject(new Error(err.message)),
      });
    } else if (
      ext === "xlsx" ||
      ext === "xls" ||
      ext === "ods" ||
      ext === "numbers"
    ) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
            defval: "",
            raw: false,
          });
          const headers =
            json.length > 0 ? Object.keys(json[0]).map((h) => h.trim()) : [];
          resolve({ headers, rows: json });
        } catch {
          reject(new Error("Failed to read spreadsheet file"));
        }
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsArrayBuffer(file);
    } else {
      reject(
        new Error(
          "Unsupported file format. Please use CSV, Excel (.xlsx/.xls), or ODS files."
        )
      );
    }
  });
}

export function BulkImportButton() {
  const role = useUserRole();
  const canEdit = role === "admin" || role === "partner";

  const [open, setOpen] = useState(false);

  if (!canEdit) return null;

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mr-2"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        Bulk Import
      </Button>
      {open && <BulkImportDialog open={open} onClose={() => setOpen(false)} />}
    </>
  );
}

function BulkImportDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [results, setResults] = useState<ImportResults | null>(null);
  const [, setImporting] = useState(false);

  const handleFileSelect = useCallback(async (file: File) => {
    try {
      const parsed = await parseFileData(file);
      if (parsed.rows.length === 0) {
        throw new Error("File is empty or has no data rows");
      }
      setFileName(file.name);
      setHeaders(parsed.headers);
      setRows(parsed.rows);

      // Auto-map columns
      const autoMapping: Record<string, string> = {};
      const usedFields = new Set<string>();
      parsed.headers.forEach((header) => {
        const mapped = autoMapColumn(header);
        if (mapped !== SKIP_VALUE && !usedFields.has(mapped)) {
          autoMapping[header] = mapped;
          usedFields.add(mapped);
        } else {
          autoMapping[header] = SKIP_VALUE;
        }
      });
      setMapping(autoMapping);
      setStep("mapping");
    } catch (err) {
      toast({
        title: "Error reading file",
        description:
          err instanceof Error ? err.message : "Could not read the file",
        variant: "destructive",
      });
    }
  }, [toast]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  const updateMapping = (header: string, field: string) => {
    setMapping((prev) => {
      const next = { ...prev };
      // If this field was already mapped to another header, unmap it
      if (field !== SKIP_VALUE) {
        for (const [h, f] of Object.entries(next)) {
          if (f === field && h !== header) {
            next[h] = SKIP_VALUE;
          }
        }
      }
      next[header] = field;
      return next;
    });
  };

  const mappedFields = new Set(
    Object.values(mapping).filter((v) => v !== SKIP_VALUE)
  );
  const hasName = mappedFields.has("name");
  const hasPrice = mappedFields.has("price");
  const canProceed = hasName && hasPrice;

  // Build preview data
  const buildMappedProducts = () => {
    return rows.map((row) => {
      const product: Record<string, string> = {};
      for (const [header, field] of Object.entries(mapping)) {
        if (field !== SKIP_VALUE) {
          product[field] = row[header] || "";
        }
      }
      return product;
    });
  };

  const handleImport = async () => {
    setImporting(true);
    setStep("importing");

    const products = buildMappedProducts();

    try {
      const res = await fetch("/api/admin/products/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ products }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Import failed");
      }

      const data: ImportResults = await res.json();
      setResults(data);
      setStep("results");

      if (data.success > 0) {
        toast({
          title: "Import complete",
          description: `${data.success} products imported successfully${data.failed > 0 ? `, ${data.failed} failed` : ""}`,
        });
      }
    } catch (err) {
      toast({
        title: "Import failed",
        description:
          err instanceof Error ? err.message : "Could not import products",
        variant: "destructive",
      });
      setStep("preview");
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    if (results?.success) {
      window.location.reload();
    }
    onClose();
  };

  const previewProducts = step === "preview" ? buildMappedProducts() : [];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === "upload" && "Bulk Import Products"}
            {step === "mapping" && "Map Columns"}
            {step === "preview" && "Preview Import"}
            {step === "importing" && "Importing..."}
            {step === "results" && "Import Results"}
          </DialogTitle>
          <DialogDescription>
            {step === "upload" &&
              "Upload a CSV, Excel, or Google Sheets export file. Compatible with Zoho Inventory, Shopify, WooCommerce, and other inventory apps."}
            {step === "mapping" &&
              `${fileName} - ${rows.length} rows found. Map your file columns to product fields.`}
            {step === "preview" &&
              `Review ${rows.length} products before importing.`}
            {step === "importing" && "Please wait while products are imported."}
            {step === "results" && "Import has finished."}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: File Upload */}
        {step === "upload" && (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 p-10 hover:border-muted-foreground/50 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-muted-foreground mb-4"
            >
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <line x1="10" y1="9" x2="8" y2="9" />
            </svg>
            <p className="text-sm font-medium mb-1">
              Drop your file here or click to browse
            </p>
            <p className="text-xs text-muted-foreground">
              CSV, Excel (.xlsx, .xls), ODS, Google Sheets export
            </p>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".csv,.tsv,.txt,.xlsx,.xls,.ods,.numbers"
              onChange={handleInputChange}
            />
          </div>
        )}

        {/* Step 2: Column Mapping */}
        {step === "mapping" && (
          <div className="space-y-4">
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-2 text-left font-medium">
                      File Column
                    </th>
                    <th className="px-4 py-2 text-left font-medium">
                      Sample Data
                    </th>
                    <th className="px-4 py-2 text-left font-medium">
                      Map To
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {headers.map((header) => (
                    <tr key={header} className="border-b last:border-0">
                      <td className="px-4 py-2 font-medium">{header}</td>
                      <td className="px-4 py-2 text-muted-foreground max-w-[150px] truncate">
                        {rows[0]?.[header] || "—"}
                      </td>
                      <td className="px-4 py-2">
                        <Select
                          value={mapping[header] || SKIP_VALUE}
                          onValueChange={(val) => updateMapping(header, val)}
                        >
                          <SelectTrigger className="w-[180px] h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={SKIP_VALUE}>
                              -- Skip --
                            </SelectItem>
                            {PRODUCT_FIELDS.map((f) => (
                              <SelectItem
                                key={f.key}
                                value={f.key}
                                disabled={
                                  mappedFields.has(f.key) &&
                                  mapping[header] !== f.key
                                }
                              >
                                {f.label}
                                {f.required ? " *" : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center gap-2 text-sm">
              {hasName && hasPrice ? (
                <Badge variant="default">Ready to import</Badge>
              ) : (
                <Badge variant="destructive">
                  Map required fields: {!hasName && "Name"}{" "}
                  {!hasName && !hasPrice && "&"} {!hasPrice && "Price"}
                </Badge>
              )}
              <span className="text-muted-foreground">
                {mappedFields.size} of {PRODUCT_FIELDS.length} fields mapped
              </span>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("upload")}>
                Back
              </Button>
              <Button onClick={() => setStep("preview")} disabled={!canProceed}>
                Preview
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 3: Preview */}
        {step === "preview" && (
          <div className="space-y-4">
            <div className="rounded-lg border overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2 text-left font-medium text-xs w-8">
                      #
                    </th>
                    {PRODUCT_FIELDS.filter((f) => mappedFields.has(f.key)).map(
                      (f) => (
                        <th
                          key={f.key}
                          className="px-3 py-2 text-left font-medium text-xs"
                        >
                          {f.label}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {previewProducts.slice(0, 20).map((product, idx) => (
                    <tr key={idx} className="border-b last:border-0">
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {idx + 1}
                      </td>
                      {PRODUCT_FIELDS.filter((f) => mappedFields.has(f.key)).map(
                        (f) => (
                          <td
                            key={f.key}
                            className="px-3 py-2 text-xs max-w-[150px] truncate"
                          >
                            {product[f.key] || "—"}
                          </td>
                        )
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > 20 && (
              <p className="text-xs text-muted-foreground text-center">
                Showing 20 of {rows.length} rows
              </p>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("mapping")}>
                Back
              </Button>
              <Button onClick={handleImport}>
                Import {rows.length} Products
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 4: Importing */}
        {step === "importing" && (
          <div className="flex flex-col items-center justify-center py-10">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mb-4" />
            <p className="text-sm text-muted-foreground">
              Importing {rows.length} products...
            </p>
          </div>
        )}

        {/* Step 5: Results */}
        {step === "results" && results && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border p-4 text-center">
                <p className="text-2xl font-bold text-green-600">
                  {results.success}
                </p>
                <p className="text-sm text-muted-foreground">Imported</p>
              </div>
              <div className="rounded-lg border p-4 text-center">
                <p className="text-2xl font-bold text-red-600">
                  {results.failed}
                </p>
                <p className="text-sm text-muted-foreground">Failed</p>
              </div>
            </div>

            {results.errors.length > 0 && (
              <div className="rounded-lg border overflow-hidden">
                <div className="px-4 py-2 bg-muted/50 text-sm font-medium">
                  Errors
                </div>
                <div className="max-h-[200px] overflow-y-auto">
                  {results.errors.map((err, idx) => (
                    <div
                      key={idx}
                      className="px-4 py-2 border-b last:border-0 text-sm"
                    >
                      <span className="text-muted-foreground">
                        Row {err.row}:
                      </span>{" "}
                      <span className="font-medium">{err.name}</span> —{" "}
                      <span className="text-red-600">{err.error}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
