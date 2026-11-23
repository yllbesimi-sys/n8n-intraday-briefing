# Starts n8n for the n8n-intraday project.
# Run it from inside the project folder:  .\start-n8n.ps1

# The folder this script lives in = the project folder
$project = $PSScriptRoot

# n8n supports Node.js 20.19 to 24.x only - stop early with a clear message otherwise
$nodeVersion = node -v
$nodeMajor = [int]($nodeVersion.TrimStart('v').Split('.')[0])
if ($nodeMajor -lt 20 -or $nodeMajor -gt 24) {
    Write-Host "Node.js $nodeVersion is not supported by n8n. Install Node.js 24 LTS." -ForegroundColor Red
    exit 1
}

# Make sure the data and logs folders exist
New-Item -ItemType Directory -Force -Path "$project\data", "$project\logs" | Out-Null

# Allow n8n's file nodes to read/write only these two folders (n8n 2.x blocks everything else by default)
$env:N8N_RESTRICT_FILE_ACCESS_TO = "$project\data;$project\logs"
Write-Host "n8n file access: $env:N8N_RESTRICT_FILE_ACCESS_TO" -ForegroundColor Green
Write-Host "Open http://localhost:5678 once it says the editor is ready. Ctrl+C stops n8n." -ForegroundColor Green

# n8n must be installed globally (see README / setup step). npx is not used because
# npm 12 blocks the install scripts n8n's database package (sqlite3) needs.
if (-not (Get-Command n8n -ErrorAction SilentlyContinue)) {
    Write-Host "n8n is not installed yet. Run the global install command from the setup steps first." -ForegroundColor Red
    exit 1
}

n8n
