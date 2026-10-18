<#
  Crea el certificado con que GitHub firma los paquetes de Relix. Se hace una
  sola vez, en tu PC con Windows.

  Uso, en PowerShell, desde la carpeta relix:
    powershell -ExecutionPolicy Bypass -File scripts\crear-certificado.ps1

  Deja en el portapapeles el valor del secreto RELIX_CERT y muestra la
  contraseña (RELIX_CERT_PASSWORD). Los dos se pegan en GitHub: Settings ›
  Secrets and variables › Actions › New repository secret.

  El certificado queda también en tu Windows (certmgr.msc › Personal ›
  Certificados › "Relix"): de ahí lo puedes volver a exportar si lo necesitas.
  El nombre del publicador tiene que ser el mismo de Package.appxmanifest.
#>
param([string]$Publisher = 'CN=snyker-fair')

$ErrorActionPreference = 'Stop'

# Firma de código (1.3.6.1.5.5.7.3.3), sin ser autoridad (2.5.29.19), 10 años
$cert = New-SelfSignedCertificate -Type Custom -Subject $Publisher `
  -KeyUsage DigitalSignature -FriendlyName 'Relix' `
  -CertStoreLocation 'Cert:\CurrentUser\My' `
  -TextExtension @('2.5.29.37={text}1.3.6.1.5.5.7.3.3', '2.5.29.19={text}') `
  -NotAfter (Get-Date).AddYears(10)

# Contraseña al azar de 24 letras y números
$chars = [char[]]'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
$password = -join (1..24 | ForEach-Object { $chars | Get-Random })
$secure = ConvertTo-SecureString $password -AsPlainText -Force

$pfx = Join-Path $env:TEMP 'relix-firma.pfx'
Export-PfxCertificate -Cert $cert -FilePath $pfx -Password $secure | Out-Null
Set-Clipboard -Value ([Convert]::ToBase64String([IO.File]::ReadAllBytes($pfx)))
Remove-Item $pfx

Write-Host ''
Write-Host "Certificado creado para $Publisher (vence el $($cert.NotAfter.ToString('yyyy-MM-dd')))." -ForegroundColor Green
Write-Host ''
Write-Host '1. En GitHub, en el repositorio relix: Settings › Secrets and variables › Actions › New repository secret'
Write-Host '   Name: RELIX_CERT     Secret: pega (Ctrl + V), ya está en el portapapeles'
Write-Host ''
Write-Host '2. Otro secreto nuevo:'
Write-Host "   Name: RELIX_CERT_PASSWORD     Secret: $password"
Write-Host ''
Write-Host 'Después de pegarlos, cierra esta ventana: la contraseña no queda guardada en ninguna otra parte.'
