import { ZipReader, BlobReader, BlobWriter, type Entry } from "@zip.js/zip.js"

const urlCache = new Map<string, string>()

// Reuse a single entry index per File to avoid re-scanning the ZIP for every image
let cachedFile: File | null = null
let cachedReader: ZipReader<BlobReader> | null = null
let cachedEntryMap: Map<string, Entry> | null = null

async function getEntryMap(zipFile: File): Promise<Map<string, Entry>> {
  if (cachedFile === zipFile && cachedEntryMap) return cachedEntryMap

  // Close previous reader if switching files
  if (cachedReader) {
    try { await cachedReader.close() } catch { /* ignore */ }
  }

  const reader = new ZipReader(new BlobReader(zipFile))
  const entries = await reader.getEntries()
  const map = new Map<string, Entry>()
  for (const entry of entries) {
    if (!entry.directory) {
      map.set(entry.filename, entry)
    }
  }

  cachedFile = zipFile
  cachedReader = reader
  cachedEntryMap = map
  return map
}

function findEntry(entryMap: Map<string, Entry>, path: string): Entry | undefined {
  // Exact match
  if (entryMap.has(path)) return entryMap.get(path)

  // Strip leading slash
  const normalized = path.replace(/^\//, "")
  if (entryMap.has(normalized)) return entryMap.get(normalized)

  // Try suffix match — the ZIP may have a root folder prefix the URI doesn't include
  for (const [filename, entry] of entryMap) {
    if (filename.endsWith("/" + normalized) || filename.endsWith(normalized)) {
      return entry
    }
  }

  // Last resort: match just the basename
  const basename = normalized.split("/").pop()
  if (basename) {
    for (const [filename, entry] of entryMap) {
      if (filename.endsWith("/" + basename)) {
        return entry
      }
    }
  }

  return undefined
}

export async function getMediaUrl(zipFile: File, path: string): Promise<string | null> {
  if (urlCache.has(path)) return urlCache.get(path)!

  const entryMap = await getEntryMap(zipFile)
  const entry = findEntry(entryMap, path)

  if (!entry || !("getData" in entry)) {
    console.warn("[zip-media] Entry not found for path:", path)
    return null
  }

  const fileEntry = entry as Entry & { getData: (writer: BlobWriter) => Promise<Blob> }
  const blob = await fileEntry.getData(new BlobWriter())
  const url = URL.createObjectURL(blob)
  urlCache.set(path, url)
  return url
}
