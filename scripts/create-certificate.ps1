<#
  Creates the certificate GitHub signs the Relix packages with. It's done only
  once, on your Windows PC.

  Usage, in PowerShell, from the relix folder:
    powershell -ExecutionPolicy Bypass -File scripts\create-certificate.ps1

  It puts the value of the RELIX_CERT secret on the clipboard and shows the
  password (RELIX_CERT_PASSWORD). Both are pasted on GitHub: Settings ›
  Secrets and variables › Actions › New repository secret.

  The certificate also stays in your Windows (certmgr.msc › Personal ›
  Certificates › "Relix"): you can export it again from there if you need to.
  The publisher name has to be the same as in Package.appxmanifest.
#>
param([string]$Publisher = 'CN=snyker-fair')

$ErrorActionPreference = 'Stop'

# Code signing (1.3.6.1.5.5.7.3.3), not a certificate authority (2.5.29.19), 10 years
$cert = New-SelfSignedCertificate -Type Custom -Subject $Publisher `
  -KeyUsage DigitalSignature -FriendlyName 'Relix' `
  -CertStoreLocation 'Cert:\CurrentUser\My' `
  -TextExtension @('2.5.29.37={text}1.3.6.1.5.5.7.3.3', '2.5.29.19={text}') `
  -NotAfter (Get-Date).AddYears(10)

# A random password of 24 letters and digits
$chars = [char[]]'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
$password = -join (1..24 | ForEach-Object { $chars | Get-Random })
$secure = ConvertTo-SecureString $password -AsPlainText -Force

$pfx = Join-Path $env:TEMP 'relix-signing.pfx'
Export-PfxCertificate -Cert $cert -FilePath $pfx -Password $secure | Out-Null
Set-Clipboard -Value ([Convert]::ToBase64String([IO.File]::ReadAllBytes($pfx)))
Remove-Item $pfx

Write-Host ''
Write-Host "Certificate created for $Publisher (expires $($cert.NotAfter.ToString('yyyy-MM-dd')))." -ForegroundColor Green
Write-Host ''
Write-Host '1. On GitHub, in the relix repository: Settings › Secrets and variables › Actions › New repository secret'
Write-Host '   Name: RELIX_CERT     Secret: paste (Ctrl + V), it is already on the clipboard'
Write-Host ''
Write-Host '2. Another new secret:'
Write-Host "   Name: RELIX_CERT_PASSWORD     Secret: $password"
Write-Host ''
Write-Host 'Once both are pasted, close this window: the password is not saved anywhere else.'
