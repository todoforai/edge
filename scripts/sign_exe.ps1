param(
    [Parameter(Mandatory=$true)]
    [string]$ExePath,
    [Parameter(Mandatory=$false)]
    [string]$Thumbprint
)

# Check if EXE file exists
if (-not (Test-Path $ExePath)) {
    Write-Error "EXE file not found: $ExePath"
    exit 1
}

# Get the code signing certificate
if ($Thumbprint) {
    Write-Host "Using provided thumbprint: $Thumbprint"
    $cert = Get-ChildItem Cert:\CurrentUser\My | Where-Object { 
        $_.Thumbprint -eq $Thumbprint -and 
        $_.NotAfter -gt (Get-Date) -and
        $_.HasPrivateKey -eq $true
    }
} else {
    Write-Host "Auto-detecting certificate for TODO for AI Kft."
    $cert = Get-ChildItem Cert:\CurrentUser\My | Where-Object { 
        $_.Subject -like "*TODO for AI Kft.*" -and 
        $_.NotAfter -gt (Get-Date) -and
        $_.HasPrivateKey -eq $true
    }
}

if (-not $cert) {
    Write-Error "No valid code signing certificate found."
    exit 1
}

Write-Host "Found certificate: $($cert.Subject)"
Write-Host "Thumbprint: $($cert.Thumbprint)"
Write-Host "Expires: $($cert.NotAfter)"

# Sign the executable
Write-Host "Signing executable: $ExePath"
$result = Set-AuthenticodeSignature -FilePath $ExePath -Certificate $cert -TimestampServer "http://timestamp.digicert.com"

if ($result.Status -eq "Valid") {
    Write-Host "Successfully signed: $ExePath"
} else {
    Write-Error "Failed to sign executable. Status: $($result.Status)"
    exit 1
}