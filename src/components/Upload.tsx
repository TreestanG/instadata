import { useState, useRef, useEffect } from "react"
import { Upload as UploadIcon, FileArchive } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

interface UploadProps {
  onDataLoaded: (data: any) => void
}

export function Upload({ onDataLoaded }: UploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const workerRef = useRef<Worker | null>(null)

  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate()
      }
    }
  }, [])

  const handleFile = async (file: File) => {
    if (!file.name.endsWith(".zip")) {
      setError("Please upload a ZIP file")
      return
    }

    setLoading(true)
    setError(null)
    setProgress(0)

    if (workerRef.current) {
      workerRef.current.terminate()
    }

    workerRef.current = new Worker(
      new URL("../workers/zip-worker.ts", import.meta.url),
      { type: "module" }
    )

    workerRef.current.onmessage = (e) => {
      const { type, progress, data, error } = e.data

      if (type === "progress") {
        setProgress(progress)
      } else if (type === "result") {
        setLoading(false)
        onDataLoaded({ ...data, zipFile: file })
      } else if (type === "error") {
        setError(error)
        setLoading(false)
      }
    }

    workerRef.current.onerror = (err) => {
      setError("Worker error: " + err.message)
      setLoading(false)
    }

    workerRef.current.postMessage({ file })
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UploadIcon className="h-5 w-5" />
            Upload Instagram Export
          </CardTitle>
          <CardDescription>
            Upload your Instagram data ZIP file to analyze your messages
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging
                ? "border-primary bg-primary/10"
                : "border-border hover:border-primary/50"
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            {loading ? (
              <div className="space-y-4">
                <FileArchive className="h-12 w-12 mx-auto text-primary animate-pulse" />
                <p className="text-sm text-muted-foreground">
                  Parsing your data...
                </p>
                <Progress value={progress} className="w-full" />
                <p className="text-xs text-muted-foreground">{progress}%</p>
              </div>
            ) : (
              <>
                <UploadIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground mb-4">
                  Drag and drop your ZIP file here, or click to browse
                </p>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".zip"
                  onChange={handleChange}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  onClick={() => inputRef.current?.click()}
                >
                  Browse Files
                </Button>
              </>
            )}
          </div>
          {error && (
            <p className="mt-4 text-sm text-destructive text-center">{error}</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}