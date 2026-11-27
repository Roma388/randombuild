
Option Explicit

Dim shell, fso, projectPath, nodePath
Dim vitePath, logPath, command
Dim i, viteReady, authReady, http, logFile

Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

projectPath = "C:\Users\Admin\Desktop\RandomBuild"
nodePath = "C:\Program Files\nodejs\node.exe"
vitePath = projectPath & "\node_modules\vite\bin\vite.js"
logPath = projectPath & "\server\vite-server.log"

shell.CurrentDirectory = projectPath

command = Chr(34) & nodePath & Chr(34) & " " & _
          Chr(34) & vitePath & Chr(34) & _
          " --host 127.0.0.1 --strictPort >> " & _
          Chr(34) & logPath & Chr(34) & " 2>&1"

shell.Run "cmd.exe /c " & Chr(34) & command & Chr(34), 0, False

viteReady = False
authReady = False

For i = 1 To 60

    If Not viteReady Then
        On Error Resume Next

        Set http = CreateObject("WinHttp.WinHttpRequest.5.1")
        http.SetTimeouts 1000, 1000, 1000, 1000
        http.Open "GET", "http://127.0.0.1:5173/", False
        http.Send

        If Err.Number = 0 Then
            If http.Status = 200 Then
                viteReady = True
            End If
        End If

        Err.Clear
        On Error GoTo 0
    End If

    If Not authReady Then
        On Error Resume Next

        Set http = CreateObject("WinHttp.WinHttpRequest.5.1")
        http.SetTimeouts 1000, 1000, 1000, 1000
        http.Open "GET", "http://127.0.0.1:3001/", False
        http.Send

        If Err.Number = 0 Then
            If http.Status >= 200 And http.Status < 500 Then
                authReady = True
            End If
        End If

        Err.Clear
        On Error GoTo 0
    End If

    If viteReady And authReady Then
        Exit For
    End If

    WScript.Sleep 1000

Next

If viteReady And authReady Then

    shell.Run "explorer.exe ""http://127.0.0.1:5173/""", 1, False

End If