# بيعمل بصمة مشفرة لاسم مستخدم وباسورد لوحة الإدارة المؤقتة ويحطها في admin.html
# الباسورد بيتكتب هنا بس ومش بيتحفظ في أي ملف.
# التشغيل: powershell -ExecutionPolicy Bypass -File .\tools\set-admin-password.ps1
$ErrorActionPreference = 'Stop'
$adminFile = Join-Path $PSScriptRoot '..\admin.html'

$user = Read-Host 'Username [mostafa2122]'
if ([string]::IsNullOrWhiteSpace($user)) { $user = 'mostafa2122' }
$user = $user.Trim().ToLower()

function Read-Plain($prompt) {
    $sec = Read-Host $prompt -AsSecureString
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}
$p1 = Read-Plain 'New password'
$p2 = Read-Plain 'Repeat password'
if ($p1 -ne $p2) { Write-Host 'Passwords do not match. Nothing changed.' -ForegroundColor Red; exit 1 }
if ($p1.Length -lt 8) { Write-Host 'Use at least 8 characters (letters + numbers). Nothing changed.' -ForegroundColor Red; exit 1 }

$utf8 = New-Object System.Text.UTF8Encoding $false
$kdf = New-Object System.Security.Cryptography.Rfc2898DeriveBytes ($utf8.GetBytes("${user}:$p1")), ($utf8.GetBytes('fekra-admin-v1')), 150000, ([System.Security.Cryptography.HashAlgorithmName]::SHA256)
$hash = -join ($kdf.GetBytes(32) | ForEach-Object { $_.ToString('x2') })
$p1 = $null; $p2 = $null

$html = [IO.File]::ReadAllText($adminFile, $utf8)
$updated = [regex]::Replace($html, "var TEMP_ADMIN_HASH = '[0-9a-f]*';", "var TEMP_ADMIN_HASH = '$hash';")
if ($updated -eq $html -and -not $html.Contains($hash)) { Write-Host 'Could not find TEMP_ADMIN_HASH in admin.html. Nothing changed.' -ForegroundColor Red; exit 1 }
[IO.File]::WriteAllText($adminFile, $updated, $utf8)
Write-Host "Done. Admin login saved for user '$user'. Tell Claude: done" -ForegroundColor Green
