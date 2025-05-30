param(
    [Parameter(Mandatory=$true)]
    [string]$MsiPath
)

# Check if MSI file exists
if (-not (Test-Path $MsiPath)) {
    Write-Error "MSI file not found: $MsiPath"
    exit 1
}

# Get the code signing certificate
$cert = Get-ChildItem Cert:\CurrentUser\My | Where-Object { 
    $_.Subject -like "*TODO for AI Kft.*" -and 
    $_.NotAfter -gt (Get-Date) -and
    $_.HasPrivateKey -eq $true
}

if (-not $cert) {
    Write-Error "No valid code signing certificate found for TODO for AI Kft."
    exit 1
}

Write-Host "Found certificate: $($cert.Subject)"
Write-Host "Thumbprint: $($cert.Thumbprint)"
Write-Host "Expires: $($cert.NotAfter)"

# Sign the MSI file
try {
    Write-Host "Signing MSI file: $MsiPath"
    $result = Set-AuthenticodeSignature -FilePath $MsiPath -Certificate $cert -TimestampServer "http://timestamp.digicert.com"
    
    if ($result.Status -eq "Valid") {
        Write-Host "✅ MSI file signed successfully!"
        Write-Host "Status: $($result.Status)"
        Write-Host "Status Message: $($result.StatusMessage)"
    } else {
        Write-Error "❌ Signing failed!"
        Write-Error "Status: $($result.Status)"
        Write-Error "Status Message: $($result.StatusMessage)"
        exit 1
    }
} catch {
    Write-Error "❌ Error during signing: $($_.Exception.Message)"
    exit 1
}