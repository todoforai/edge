param(
    [Parameter(Mandatory=$true)]
    [string]$FilePath,
    
    [Parameter(Mandatory=$false)]
    [string]$Thumbprint = $env:WINDOWS_CERT_THUMBPRINT
)

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

# Sign the file using signtool
try {
    $signResult = & signtool.exe sign /sha1 $Thumbprint /fd SHA256 /tr http://timestamp.digicert.com /td SHA256 /v $FilePath
    
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
    $verifyResult = & signtool.exe verify /pa /v $FilePath
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Signature verification successful" -ForegroundColor Green
    } else {
        Write-Warning "Signature verification failed, but file was signed"
        Write-Host $verifyResult
    }
} catch {
    Write-Warning "Could not verify signature: $($_.Exception.Message)"
}