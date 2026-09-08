const MAX_PDF_BYTES = 100 * 1024 * 1024

export function isPdfSplitViewFile(file: File): boolean {
  return file.size > 0 && file.size <= MAX_PDF_BYTES &&
    (file.type === 'application/pdf' || (!file.type && file.name.toLowerCase().endsWith('.pdf')))
}
