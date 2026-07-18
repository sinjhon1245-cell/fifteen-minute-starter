param(
    [int]$Port = 5173
)

$root = Split-Path -Parent $PSScriptRoot
Add-Type -AssemblyName System.Net.HttpListener -ErrorAction SilentlyContinue

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Output "Serving $root at http://localhost:$Port/"

$mimeMap = @{
    ".html"       = "text/html; charset=utf-8"
    ".css"        = "text/css; charset=utf-8"
    ".js"         = "application/javascript; charset=utf-8"
    ".json"       = "application/json; charset=utf-8"
    ".webmanifest"= "application/manifest+json; charset=utf-8"
    ".png"        = "image/png"
    ".svg"        = "image/svg+xml"
    ".ico"        = "image/x-icon"
}

try {
    while ($listener.IsListening) {
        try {
            $context = $listener.GetContext()
        } catch {
            continue
        }

        try {
            $request = $context.Request
            $response = $context.Response

            $localPath = [System.Uri]::UnescapeDataString($request.Url.LocalPath)
            if ($localPath -eq "/") { $localPath = "/index.html" }
            $filePath = Join-Path $root ($localPath.TrimStart("/"))
            $fullRoot = (Resolve-Path $root).Path

            if ((Test-Path $filePath -PathType Leaf) -and ((Resolve-Path $filePath).Path).StartsWith($fullRoot)) {
                $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
                $contentType = $mimeMap[$ext]
                if (-not $contentType) { $contentType = "application/octet-stream" }
                $bytes = [System.IO.File]::ReadAllBytes($filePath)
                $response.ContentType = $contentType
                $response.ContentLength64 = $bytes.Length
                $response.StatusCode = 200
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
            } else {
                $notFoundPath = Join-Path $root "index.html"
                $bytes = [System.IO.File]::ReadAllBytes($notFoundPath)
                $response.ContentType = "text/html; charset=utf-8"
                $response.StatusCode = 404
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
            }
        } catch {
            try { $context.Response.StatusCode = 500 } catch {}
        } finally {
            try { $context.Response.OutputStream.Close() } catch {}
        }
    }
} finally {
    $listener.Stop()
}
