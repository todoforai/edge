param(
    [Parameter(Mandatory=$true)]
    [string]$FilePath,
    
    [Parameter(Mandatory=$false)]
    [string]$Thumbprint = $env:WINDOWS_CERT_THUMBPRINT
)

# Function to find signtool.exe
function Find-SignTool {
    # Common locations for signtool.exe
    $possiblePaths = @(
        "${env:ProgramFiles(x86)}\Windows Kits\10\bin\x64\signtool.exe",
        "${env:ProgramFiles(x86)}\Windows Kits\10\bin\x86\signtool.exe",
        "${env:ProgramFiles}\Windows Kits\10\bin\x64\signtool.exe",
        "${env:ProgramFiles}\Windows Kits\10\bin\x86\signtool.exe"
    )
    
    # Also search in subdirectories of Windows Kits
    $windowsKitsPath = "${env:ProgramFiles(x86)}\Windows Kits\10\bin"
    if (Test-Path $windowsKitsPath) {
        $subDirs = Get-ChildItem -Path $windowsKitsPath -Directory | Where-Object { $_.Name -match "^\d+\.\d+\.\d+\.\d+$" }
        foreach ($subDir in $subDirs) {
            $possiblePaths += "$($subDir.FullName)\x64\signtool.exe"
            $possiblePaths += "$($subDir.FullName)\x86\signtool.exe"
        }
    }
    
    # Find the first existing signtool.exe
    foreach ($path in $possiblePaths) {
        if (Test-Path $path) {
            Write-Host "Found signtool.exe at: $path"
            return $path
        }
    }
    
    # Try to find it in PATH
    $signToolInPath = Get-Command signtool.exe -ErrorAction SilentlyContinue
    if ($signToolInPath) {
        Write-Host "Found signtool.exe in PATH: $($signToolInPath.Source)"
        return $signToolInPath.Source
    }
    
    return $null
}

# Check if file exists
if (-not (Test-Path $FilePath)) {
    Write-Error "File not found: $FilePath"
    exit 1
}

# Check if thumbprint is provided
if ([string]::IsNullOrEmpty($Thumbprint)) {
    Write-Error "Certificate thumbprint not provided. Set WINDOWS_CERT_THUMBPRINT environment variable or pass -Thumbprint parameter."
    exit 1
}

# Get file extension to determine type
$extension = [System.IO.Path]::GetExtension($FilePath).ToLower()
$supportedExtensions = @('.exe', '.msi', '.dll')

if ($extension -notin $supportedExtensions) {
    Write-Error "Unsupported file type: $extension. Supported types: $($supportedExtensions -join ', ')"
    exit 1
}

Write-Host "Signing $extension file: $FilePath"
Write-Host "Using certificate thumbprint: $Thumbprint"

# Find signtool.exe
$signTool = Find-SignTool
if (-not $signTool) {
    Write-Error "signtool.exe not found. Please ensure Windows SDK is installed."
    Write-Host "Searched locations:"
    Write-Host "  - ${env:ProgramFiles(x86)}\Windows Kits\10\bin\*\x64\signtool.exe"
    Write-Host "  - ${env:ProgramFiles(x86)}\Windows Kits\10\bin\*\x86\signtool.exe"
    Write-Host "  - PATH environment variable"
    exit 1
}

# Sign the file using signtool
try {
    $signResult = & $signTool sign /sha1 $Thumbprint /fd SHA256 /tr http://timestamp.digicert.com /td SHA256 /v $FilePath
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Successfully signed: $FilePath" -ForegroundColor Green
    } else {
        Write-Error "Signing failed with exit code: $LASTEXITCODE"
        Write-Host $signResult
        exit 1
    }
} catch {
    Write-Error "Error during signing: $($_.Exception.Message)"
    exit 1
}

# Verify the signature
Write-Host "Verifying signature..."
try {
    $verifyResult = & $signTool verify /pa /v $FilePath
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Signature verification successful" -ForegroundColor Green
    } else {
        Write-Warning "Signature verification failed, but file was signed"
        Write-Host $verifyResult
    }
} catch {
    Write-Warning "Could not verify signature: $($_.Exception.Message)"
}