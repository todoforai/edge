param(
    [Parameter(Mandatory=$true)]
    [string]$FilePath,
    
    [Parameter(Mandatory=$false)]
    [string]$SigningUrl = $env:SIGNING_SERVICE_URL,
    
    [Parameter(Mandatory=$false)]
    [string]$ApiKey = $env:SIGNING_API_KEY
)

function Invoke-RemoteSign {
    param(
        [string]$FilePath,
        [string]$SigningUrl,
        [string]$ApiKey
    )
    
    if (-not (Test-Path $FilePath)) {
        Write-Error "File not found: $FilePath"
        return $false
    }
    
    if ([string]::IsNullOrEmpty($SigningUrl) -or [string]::IsNullOrEmpty($ApiKey)) {
        Write-Error "SIGNING_SERVICE_URL and SIGNING_API_KEY must be set"
        return $false
    }
    
    $uri = "$SigningUrl/sign"
    $fileName = [System.IO.Path]::GetFileName($FilePath)
    
    Write-Host "Signing file remotely: $fileName"
    
    try {
        # Use Invoke-RestMethod with -InFile for simpler multipart upload
        $headers = @{
            'Authorization' = "Bearer $ApiKey"
        }
        
        $signedPath = "$FilePath.signed"
        
        # PowerShell 7+ has better multipart support, but for compatibility:
        $form = @{
            file = Get-Item $FilePath
        }
        
        Invoke-RestMethod -Uri $uri -Method Post -Headers $headers -Form $form -OutFile $signedPath
        
        if (Test-Path $signedPath) {
            # Replace original with signed version
            Move-Item $signedPath $FilePath -Force
            Write-Host "Successfully signed: $fileName" -ForegroundColor Green
            return $true
        } else {
            Write-Error "Signed file not received"
            return $false
        }
        
    } catch {
        Write-Warning "Remote signing failed: $($_.Exception.Message)"
        if (Test-Path "$FilePath.signed") {
            Remove-Item "$FilePath.signed" -Force
        }
        return $false
    }
}

# If called directly, sign the specified file
if ($FilePath) {
    $success = Invoke-RemoteSign -FilePath $FilePath -SigningUrl $SigningUrl -ApiKey $ApiKey
    if (-not $success) {
        exit 1
    }
}