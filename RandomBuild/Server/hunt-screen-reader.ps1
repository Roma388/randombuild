# RANDOMBUILD local Hunt screen reader
# Captures the complete virtual desktop (every connected monitor) and performs OCR locally with Windows.Media.Ocr.
# No network requests and no third-party services are used.

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)

try {
    Add-Type -AssemblyName System.Drawing
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Runtime.WindowsRuntime

    # Делает координаты окна физическими пикселями и позволяет получить
    # именно клиентскую область Hunt, даже когда игра открыта рядом с браузером
    # на широком мониторе или на втором дисплее.
    Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
public static class RandomBuildWindowCapture {
    [StructLayout(LayoutKind.Sequential)]
    private struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
    [StructLayout(LayoutKind.Sequential)]
    private struct POINT { public int X; public int Y; }
    private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    private static Timer _inputTimer;
    private static readonly object _inputLock = new object();
    private static readonly Queue<long[]> _inputQueue = new Queue<long[]>();
    private static bool _leftButtonWasDown;
    private static bool _spaceWasDown;
    private static bool _enterWasDown;

    [DllImport("user32.dll")]
    private static extern short GetAsyncKeyState(int virtualKey);

    [DllImport("user32.dll", SetLastError=true)]
    private static extern bool GetCursorPos(out POINT point);

    [DllImport("user32.dll", SetLastError=true)]
    private static extern bool GetClientRect(IntPtr hWnd, out RECT rect);
    [DllImport("user32.dll", SetLastError=true)]
    private static extern bool ClientToScreen(IntPtr hWnd, ref POINT point);
    [DllImport("user32.dll")]
    public static extern bool IsIconic(IntPtr hWnd);
    [DllImport("user32.dll")]
    private static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)]
    private static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int maxCount);
    [DllImport("user32.dll")]
    private static extern bool SetProcessDPIAware();
    [DllImport("user32.dll", SetLastError=true)]
    private static extern bool SetProcessDpiAwarenessContext(IntPtr dpiContext);
    [DllImport("user32.dll")]
    private static extern bool EnumWindows(EnumWindowsProc callback, IntPtr lParam);

    public static bool EnablePerMonitorDpiAwareness() {
        // DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2 = -4
        if (SetProcessDpiAwarenessContext(new IntPtr(-4))) return true;
        return SetProcessDPIAware();
    }

    // Read-only input observation. No hooks, injection, synthetic input or
    // window messages are sent to Hunt. The timer only records mouse-click
    // and Space key-down coordinates so the app can tell which loadout slot
    // the player edited and which catalogue card they selected.
    public static void StartInputMonitor() {
        if (_inputTimer != null) return;
        _inputTimer = new Timer(PollInput, null, 0, 20);
    }

    private static void EnqueueInput(long kind, int x, int y) {
        lock (_inputLock) {
            while (_inputQueue.Count >= 256) _inputQueue.Dequeue();
            _inputQueue.Enqueue(new long[] { kind, x, y, DateTime.UtcNow.Ticks });
        }
    }

    private static void PollInput(object state) {
        try {
            bool leftDown = (((int)GetAsyncKeyState(0x01)) & 0x8000) != 0;
            bool spaceDown = (((int)GetAsyncKeyState(0x20)) & 0x8000) != 0;
            bool enterDown = (((int)GetAsyncKeyState(0x0D)) & 0x8000) != 0;
            POINT point;
            if ((leftDown && !_leftButtonWasDown) || (spaceDown && !_spaceWasDown) || (enterDown && !_enterWasDown)) {
                if (GetCursorPos(out point)) {
                    if (leftDown && !_leftButtonWasDown) EnqueueInput(1, point.X, point.Y);
                    if (spaceDown && !_spaceWasDown) EnqueueInput(2, point.X, point.Y);
                    if (enterDown && !_enterWasDown) EnqueueInput(3, point.X, point.Y);
                }
            }
            _leftButtonWasDown = leftDown;
            _spaceWasDown = spaceDown;
            _enterWasDown = enterDown;
        } catch { }
    }

    public static string DrainInputEventsJson() {
        lock (_inputLock) {
            StringBuilder json = new StringBuilder("[");
            bool first = true;
            while (_inputQueue.Count > 0) {
                long[] item = _inputQueue.Dequeue();
                if (!first) json.Append(',');
                first = false;
                json.Append("{\"kind\":").Append(item[0])
                    .Append(",\"x\":").Append(item[1])
                    .Append(",\"y\":").Append(item[2])
                    .Append(",\"capturedTicks\":").Append(item[3]).Append('}');
            }
            return json.Append(']').ToString();
        }
    }

    public static int[] GetClientScreenBounds(IntPtr hWnd) {
        RECT rect;
        POINT origin = new POINT();
        if (hWnd == IntPtr.Zero || !GetClientRect(hWnd, out rect)) return new int[0];
        origin.X = rect.Left; origin.Y = rect.Top;
        if (!ClientToScreen(hWnd, ref origin)) return new int[0];
        int width = rect.Right - rect.Left;
        int height = rect.Bottom - rect.Top;
        if (width <= 0 || height <= 0) return new int[0];
        return new int[] { origin.X, origin.Y, width, height };
    }

    public static string GetWindowTitle(IntPtr hWnd) {
        StringBuilder title = new StringBuilder(512);
        GetWindowText(hWnd, title, title.Capacity);
        return title.ToString();
    }

    // Не полагаемся на Process.MainWindowHandle: у Hunt могут быть несколько
    // процессов, и первый в списке нередко является безоконным helper-процессом.
    // Перебираем видимые окна всех процессов HuntGame и берём крупнейшее игровое.
    // Возвращаем [HWND, PID, X, Y, WIDTH, HEIGHT, VISIBLE_HUNT_WINDOWS].
    public static long[] FindLargestHuntWindow(int[] processIds) {
        HashSet<int> allowed = new HashSet<int>(processIds ?? new int[0]);
        long[] best = new long[7];
        long bestArea = 0;
        int visibleCount = 0;

        EnumWindows((hWnd, lParam) => {
            if (!IsWindowVisible(hWnd)) return true;
            uint processId;
            GetWindowThreadProcessId(hWnd, out processId);
            if (!allowed.Contains((int)processId)) return true;

            int[] bounds = GetClientScreenBounds(hWnd);
            if (bounds.Length != 4 || bounds[2] < 800 || bounds[3] < 500) return true;
            visibleCount++;
            long area = (long)bounds[2] * (long)bounds[3];
            if (area > bestArea) {
                bestArea = area;
                best[0] = hWnd.ToInt64();
                best[1] = processId;
                best[2] = bounds[0];
                best[3] = bounds[1];
                best[4] = bounds[2];
                best[5] = bounds[3];
            }
            return true;
        }, IntPtr.Zero);

        best[6] = visibleCount;
        return best;
    }
}
'@ -ErrorAction Stop
    [void][RandomBuildWindowCapture]::EnablePerMonitorDpiAwareness()
    [RandomBuildWindowCapture]::StartInputMonitor()

    $null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
    $null = [Windows.Storage.Streams.RandomAccessStream, Windows.Storage.Streams, ContentType = WindowsRuntime]
    $null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType = WindowsRuntime]
    $null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
    $null = [Windows.Foundation.IAsyncOperation`1, Windows.Foundation, ContentType = WindowsRuntime]
    $null = [Windows.Graphics.Imaging.SoftwareBitmap, Windows.Foundation, ContentType = WindowsRuntime]
    $null = [Windows.Globalization.Language, Windows.Globalization, ContentType = WindowsRuntime]

    # WinRT methods return IAsyncOperation<T>. Use GetAwaiter<T>().GetResult(),
    # the supported bridge used by Windows PowerShell 5.1 for WinRT operations.
    $script:GetAwaiterBaseMethod = [System.WindowsRuntimeSystemExtensions].GetMember('GetAwaiter') |
        Where-Object {
            $_.GetParameters().Count -eq 1 -and
            $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
        } |
        Select-Object -First 1

    if ($null -eq $script:GetAwaiterBaseMethod) {
        throw 'Не удалось инициализировать Windows Runtime OCR.'
    }

    function Wait-WinRtOperation {
        param(
            [Parameter(Mandatory = $true)] [object] $Operation,
            [Parameter(Mandatory = $true)] [Type] $ResultType
        )
        $awaiter = $script:GetAwaiterBaseMethod.MakeGenericMethod($ResultType).Invoke($null, @($Operation))
        return $awaiter.GetResult()
    }

    $script:OcrEngine = $null
    try {
        $ruLanguage = [Windows.Globalization.Language]::new('ru-RU')
        $script:OcrEngine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($ruLanguage)
    } catch {
        $script:OcrEngine = $null
    }
    if ($null -eq $script:OcrEngine) {
        $script:OcrEngine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
    }
    if ($null -eq $script:OcrEngine) {
        throw 'Windows OCR не нашёл установленного языкового пакета распознавания. Для названий предметов нужен русский OCR; для баланса подойдёт любой OCR-пакет с распознаванием цифр.'
    }

    function Get-OcrLines {
        param([Parameter(Mandatory = $true)] [System.Drawing.Bitmap] $Bitmap)

        $tempPath = Join-Path $env:TEMP ('randombuild-ocr-' + [Guid]::NewGuid().ToString('N') + '.png')
        $stream = $null
        $softwareBitmap = $null
        $scaledBitmap = $null
        $ocrBitmap = $Bitmap
        $ocrScale = 1.0
        try {
            $maximumDimension = [int]$script:OcrEngine.MaxImageDimension
            if ($maximumDimension -gt 0 -and ($Bitmap.Width -gt $maximumDimension -or $Bitmap.Height -gt $maximumDimension)) {
                $ocrScale = [Math]::Min(
                    $maximumDimension / [double]$Bitmap.Width,
                    $maximumDimension / [double]$Bitmap.Height
                )
                $scaledWidth = [Math]::Max(1, [int][Math]::Floor($Bitmap.Width * $ocrScale))
                $scaledHeight = [Math]::Max(1, [int][Math]::Floor($Bitmap.Height * $ocrScale))
                $scaledBitmap = [System.Drawing.Bitmap]::new($scaledWidth, $scaledHeight, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
                $scaleGraphics = [System.Drawing.Graphics]::FromImage($scaledBitmap)
                try {
                    $scaleGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
                    $scaleGraphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
                    $scaleGraphics.DrawImage($Bitmap, 0, 0, $scaledWidth, $scaledHeight)
                } finally {
                    $scaleGraphics.Dispose()
                }
                $ocrBitmap = $scaledBitmap
            }

            $ocrBitmap.Save($tempPath, [System.Drawing.Imaging.ImageFormat]::Png)
            $storageFile = Wait-WinRtOperation `
                ([Windows.Storage.StorageFile]::GetFileFromPathAsync($tempPath)) `
                ([Windows.Storage.StorageFile])
            $stream = Wait-WinRtOperation `
                ($storageFile.OpenAsync([Windows.Storage.FileAccessMode]::Read)) `
                ([Windows.Storage.Streams.IRandomAccessStream])
            $decoder = Wait-WinRtOperation `
                ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) `
                ([Windows.Graphics.Imaging.BitmapDecoder])
            $softwareBitmap = Wait-WinRtOperation `
                ($decoder.GetSoftwareBitmapAsync()) `
                ([Windows.Graphics.Imaging.SoftwareBitmap])
            $ocrResult = Wait-WinRtOperation `
                ($script:OcrEngine.RecognizeAsync($softwareBitmap)) `
                ([Windows.Media.Ocr.OcrResult])

            $items = New-Object System.Collections.Generic.List[object]
            foreach ($line in $ocrResult.Lines) {
                $left = [double]::MaxValue
                $top = [double]::MaxValue
                $right = 0.0
                $bottom = 0.0
                foreach ($word in $line.Words) {
                    $rect = $word.BoundingRect
                    $left = [Math]::Min($left, [double]$rect.X)
                    $top = [Math]::Min($top, [double]$rect.Y)
                    $right = [Math]::Max($right, [double]($rect.X + $rect.Width))
                    $bottom = [Math]::Max($bottom, [double]($rect.Y + $rect.Height))
                }
                if ($left -ne [double]::MaxValue) {
                    $items.Add([pscustomobject]@{
                        text = [string]$line.Text
                        x = [Math]::Round(($left / $ocrScale), 1)
                        y = [Math]::Round(($top / $ocrScale), 1)
                        width = [Math]::Round((($right - $left) / $ocrScale), 1)
                        height = [Math]::Round((($bottom - $top) / $ocrScale), 1)
                    })
                }
            }
            return $items.ToArray()
        }
        finally {
            if ($null -ne $softwareBitmap) { $softwareBitmap.Dispose() }
            if ($null -ne $stream) { $stream.Dispose() }
            if ($null -ne $scaledBitmap) { $scaledBitmap.Dispose() }
            if (Test-Path -LiteralPath $tempPath) {
                Remove-Item -LiteralPath $tempPath -Force -ErrorAction SilentlyContinue
            }
        }
    }

    function New-Crop {
        param(
            [System.Drawing.Bitmap] $Source,
            [int] $X,
            [int] $Y,
            [int] $Width,
            [int] $Height,
            [double] $Scale = 1.0
        )
        $x0 = [Math]::Max(0, [Math]::Min($X, $Source.Width - 1))
        $y0 = [Math]::Max(0, [Math]::Min($Y, $Source.Height - 1))
        $w = [Math]::Max(1, [Math]::Min($Width, $Source.Width - $x0))
        $h = [Math]::Max(1, [Math]::Min($Height, $Source.Height - $y0))
        $rect = [System.Drawing.Rectangle]::new($x0, $y0, $w, $h)
        $cropped = $Source.Clone($rect, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
        if ($Scale -le 1.0) { return $cropped }

        $scaled = [System.Drawing.Bitmap]::new([int][Math]::Round($w * $Scale), [int][Math]::Round($h * $Scale))
        $graphics = [System.Drawing.Graphics]::FromImage($scaled)
        try {
            $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
            $graphics.DrawImage($cropped, 0, 0, $scaled.Width, $scaled.Height)
        } finally {
            $graphics.Dispose()
            $cropped.Dispose()
        }
        return $scaled
    }

    while ($true) {
        $bitmap = $null
        $graphics = $null
        $moneyCrop = $null
        $monitorCrop = $null
        try {
            # IMPORTANT: capture the complete Windows virtual desktop.
            # VirtualScreen is the union of ALL connected monitors and may
            # have a negative X or Y when a display is placed left/above primary.
            $virtualBounds = [System.Windows.Forms.SystemInformation]::VirtualScreen
            if ($virtualBounds.Width -le 0 -or $virtualBounds.Height -le 0) {
                throw 'Windows не вернула корректную область виртуального рабочего стола.'
            }

            $bitmap = [System.Drawing.Bitmap]::new(
                $virtualBounds.Width,
                $virtualBounds.Height,
                [System.Drawing.Imaging.PixelFormat]::Format24bppRgb
            )
            $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
            $graphics.CopyFromScreen(
                $virtualBounds.Left,
                $virtualBounds.Top,
                0,
                0,
                $virtualBounds.Size,
                [System.Drawing.CopyPixelOperation]::SourceCopy
            )

            # OCR EACH monitor at its native resolution. This scans all pixels
            # on every display; it does not assume that Hunt is on monitor 1 or 2.
            # The coordinates are converted into the common virtual-desktop space.
            $allScreenLines = New-Object System.Collections.Generic.List[object]
            $monitorNames = New-Object System.Collections.Generic.List[string]
            $allScreens = @([System.Windows.Forms.Screen]::AllScreens)
            foreach ($screen in $allScreens) {
                $screenBounds = $screen.Bounds
                $offsetX = [int]($screenBounds.Left - $virtualBounds.Left)
                $offsetY = [int]($screenBounds.Top - $virtualBounds.Top)
                $monitorCrop = New-Crop $bitmap $offsetX $offsetY $screenBounds.Width $screenBounds.Height 1.0
                try {
                    $monitorLines = @(Get-OcrLines $monitorCrop)
                    foreach ($line in $monitorLines) {
                        $allScreenLines.Add([pscustomobject]@{
                            text = [string]$line.text
                            x = [Math]::Round(($offsetX + [double]$line.x), 1)
                            y = [Math]::Round(($offsetY + [double]$line.y), 1)
                            width = [double]$line.width
                            height = [double]$line.height
                            monitor = [string]$screen.DeviceName
                        })
                    }
                    $monitorNames.Add([string]$screen.DeviceName)
                }
                finally {
                    if ($null -ne $monitorCrop) { $monitorCrop.Dispose(); $monitorCrop = $null }
                }
            }

            # Window metadata is used only to map OCR results to the Hunt UI.
            # It NEVER restricts capture: every monitor has already been captured
            # and OCR-scanned above. If HWND discovery fails, use the monitor on
            # which the unique Hunt loadout heading was recognized.
            $huntProcesses = @(Get-Process -Name 'HuntGame' -ErrorAction SilentlyContinue)
            $huntProcessIds = [int[]]@($huntProcesses | ForEach-Object { [int]$_.Id })
            $windowInfo = [RandomBuildWindowCapture]::FindLargestHuntWindow($huntProcessIds)
            $visibleHuntWindows = [int]$windowInfo[6]
            $targetFound = $false
            $targetX = 0
            $targetY = 0
            $targetWidth = 0
            $targetHeight = 0
            $windowTitle = ''
            $selectedProcessId = $null
            $captureMethod = 'virtual_desktop_all_monitors'

            $gameHandle = [IntPtr]$windowInfo[0]
            if ($gameHandle -ne [IntPtr]::Zero -and -not [RandomBuildWindowCapture]::IsIconic($gameHandle)) {
                $clientBounds = [RandomBuildWindowCapture]::GetClientScreenBounds($gameHandle)
                if ($null -ne $clientBounds -and $clientBounds.Length -eq 4 -and $clientBounds[2] -ge 800 -and $clientBounds[3] -ge 500) {
                    $targetX = [int]($clientBounds[0] - $virtualBounds.Left)
                    $targetY = [int]($clientBounds[1] - $virtualBounds.Top)
                    $targetWidth = [int]$clientBounds[2]
                    $targetHeight = [int]$clientBounds[3]
                    $windowTitle = [RandomBuildWindowCapture]::GetWindowTitle($gameHandle)
                    $selectedProcessId = [int]$windowInfo[1]
                    $targetFound = $true
                    $captureMethod = 'virtual_desktop_all_monitors_hunt_window_hint'
                }
            }

            # Fallback: if process/window enumeration did not locate Hunt,
            # find the unique title on ANY monitor and use that monitor's bounds.
            if (-not $targetFound) {
                $loadoutTitleLine = $allScreenLines |
                    Where-Object { $_.text -match '(?i)текущее.{0,24}снаряжение|current.{0,24}(equipment|loadout)' } |
                    Select-Object -First 1
                if ($null -ne $loadoutTitleLine) {
                    foreach ($screen in $allScreens) {
                        $sx = [int]($screen.Bounds.Left - $virtualBounds.Left)
                        $sy = [int]($screen.Bounds.Top - $virtualBounds.Top)
                        if (
                            $loadoutTitleLine.x -ge $sx -and
                            $loadoutTitleLine.x -lt ($sx + $screen.Bounds.Width) -and
                            $loadoutTitleLine.y -ge $sy -and
                            $loadoutTitleLine.y -lt ($sy + $screen.Bounds.Height)
                        ) {
                            $targetX = $sx
                            $targetY = $sy
                            $targetWidth = [int]$screen.Bounds.Width
                            $targetHeight = [int]$screen.Bounds.Height
                            $windowTitle = 'Hunt identified by OCR on ' + [string]$screen.DeviceName
                            $targetFound = $true
                            $captureMethod = 'virtual_desktop_all_monitors_ocr_fallback'
                            break
                        }
                    }
                }
            }

            # Keep the raw full-desktop OCR results. For the application logic,
            # normalize recognized Hunt lines to the target region so that slot
            # geometry is independent of which monitor contains the game.
            $targetLines = @()
            if ($targetFound) {
                $targetRight = $targetX + $targetWidth
                $targetBottom = $targetY + $targetHeight
                $targetLines = @(
                    foreach ($line in $allScreenLines) {
                        if (
                            $line.x -ge $targetX -and $line.x -lt $targetRight -and
                            $line.y -ge $targetY -and $line.y -lt $targetBottom
                        ) {
                            [pscustomobject]@{
                                text = $line.text
                                x = [Math]::Round(($line.x - $targetX), 1)
                                y = [Math]::Round(($line.y - $targetY), 1)
                                width = $line.width
                                height = $line.height
                            }
                        }
                    }
                )
            }

            $moneyText = ''
            $balance = $null
            $balanceText = ''
            $headerText = ''
            $panelText = ''
            $loadoutAnchorCount = 0
            $catalogLines = @()
            $isLoadout = $false

            if ($targetFound) {
                # Hunt Dollars: ROI is now positioned relative to the detected
                # game area, but its pixels come from the full-desktop capture.
                $moneyX = [int][Math]::Round($targetWidth * 0.082)
                $moneyY = [int][Math]::Round($targetHeight * 0.000)
                $moneyW = [int][Math]::Round($targetWidth * 0.072)
                $moneyH = [int][Math]::Round($targetHeight * 0.075)
                $moneyCrop = New-Crop $bitmap ($targetX + $moneyX) ($targetY + $moneyY) $moneyW $moneyH 4.0
                $moneyLines = @(Get-OcrLines $moneyCrop)
                $moneyText = (($moneyLines | ForEach-Object { $_.text }) -join ' ')
                $digitRuns = [regex]::Matches($moneyText, '\d[\d\s.,]*\d|\d') |
                    ForEach-Object { ($_.Value -replace '\D', '') } |
                    Where-Object { $_.Length -ge 1 -and $_.Length -le 7 } |
                    Sort-Object Length -Descending
                if ($digitRuns.Count -gt 0) {
                    $balanceText = [string]$digitRuns[0]
                    $parsedBalance = 0
                    if ([int]::TryParse($balanceText, [ref]$parsedBalance)) { $balance = $parsedBalance }
                }

                $headerLines = @($targetLines | Where-Object { $_.x -lt ($targetWidth * 0.55) -and $_.y -lt ($targetHeight * 0.22) })
                $panelLines = @($targetLines | Where-Object { $_.x -lt ($targetWidth * 0.31) -and $_.y -gt ($targetHeight * 0.10) -and $_.y -lt ($targetHeight * 0.92) })
                $headerText = (($headerLines | ForEach-Object { $_.text }) -join ' ')
                $panelText = (($panelLines | ForEach-Object { $_.text }) -join ' ')
                $combinedHeaderText = "$headerText | $panelText"

                foreach ($anchor in @('основной слот', 'дополнительный слот', 'приспособления', 'навыки')) {
                    if ($panelText.ToLowerInvariant().Contains($anchor)) { $loadoutAnchorCount += 1 }
                }
                $isLoadout = ($combinedHeaderText -match '(?i)текущее.*снаряжение|current.*equipment|current.*loadout') -or ($loadoutAnchorCount -ge 2)

                if ($isLoadout) {
                    $catalogLines = @(
                        $targetLines | Where-Object {
                            $_.x -ge ($targetWidth * 0.25) -and
                            $_.y -ge ($targetHeight * 0.15)
                        }
                    )
                }
            }
            else {
                # Even when a game HWND is not available, publish full-area scan
                # metadata so diagnostics show that ALL monitors were scanned.
                $headerText = (($allScreenLines | ForEach-Object { $_.text }) -join ' ')
                $combinedHeaderText = $headerText
            }

            $rawInputEventsJson = [RandomBuildWindowCapture]::DrainInputEventsJson()
            $rawInputEvents = @($rawInputEventsJson | ConvertFrom-Json)
            $inputEvents = @(
                foreach ($inputEvent in $rawInputEvents) {
                    [pscustomobject]@{
                        type = $(if ([long]$inputEvent.kind -eq 1) { 'mouse' } elseif ([long]$inputEvent.kind -eq 3) { 'enter' } else { 'space' })
                        x = [int]$inputEvent.x
                        y = [int]$inputEvent.y
                        capturedTicks = [long]$inputEvent.capturedTicks
                    }
                }
            )

            $payload = [pscustomobject]@{
                status = 'ok'
                capturedAt = [DateTime]::UtcNow.ToString('o')
                screenWidth = $(if ($targetFound) { $targetWidth } else { $virtualBounds.Width })
                screenHeight = $(if ($targetFound) { $targetHeight } else { $virtualBounds.Height })
                virtualScreenX = [int]$virtualBounds.Left
                virtualScreenY = [int]$virtualBounds.Top
                virtualScreenWidth = [int]$virtualBounds.Width
                virtualScreenHeight = [int]$virtualBounds.Height
                monitorCount = [int]$allScreens.Count
                monitorsScanned = @($monitorNames.ToArray())
                scanArea = 'all_monitors'
                captureMethod = $captureMethod
                windowTitle = $windowTitle
                processId = $selectedProcessId
                processCount = $huntProcesses.Count
                visibleHuntWindows = $visibleHuntWindows
                windowX = $(if ($targetFound) { [int]($targetX + $virtualBounds.Left) } else { [int]$virtualBounds.Left })
                windowY = $(if ($targetFound) { [int]($targetY + $virtualBounds.Top) } else { [int]$virtualBounds.Top })
                targetFound = $targetFound
                balance = $balance
                balanceText = $balanceText
                moneyOcrText = $moneyText
                screenMode = $(if ($isLoadout) { 'loadout' } else { 'other' })
                headerOcrText = $combinedHeaderText
                loadoutAnchorCount = $loadoutAnchorCount
                catalogLines = $catalogLines
                inputEvents = $inputEvents
                ocrLanguage = $script:OcrEngine.RecognizerLanguage.LanguageTag
            }
            [Console]::Out.WriteLine(($payload | ConvertTo-Json -Compress -Depth 8))
            [Console]::Out.Flush()
        }
        catch {
            $payload = [pscustomobject]@{
                status = 'error'
                capturedAt = [DateTime]::UtcNow.ToString('o')
                error = $_.Exception.Message
            }
            [Console]::Out.WriteLine(($payload | ConvertTo-Json -Compress -Depth 5))
            [Console]::Out.Flush()
        }
        finally {
            if ($null -ne $moneyCrop) { $moneyCrop.Dispose() }
            if ($null -ne $monitorCrop) { $monitorCrop.Dispose() }
            if ($null -ne $graphics) { $graphics.Dispose() }
            if ($null -ne $bitmap) { $bitmap.Dispose() }
        }
        Start-Sleep -Milliseconds 1000
    }

}
catch {
    $payload = [pscustomobject]@{
        status = 'fatal'
        capturedAt = [DateTime]::UtcNow.ToString('o')
        error = $_.Exception.Message
    }
    [Console]::Out.WriteLine(($payload | ConvertTo-Json -Compress -Depth 5))
    [Console]::Out.Flush()
    exit 1
}
