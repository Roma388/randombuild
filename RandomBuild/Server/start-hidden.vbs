Set WshShell = CreateObject("WScript.Shell")

projectPath = "C:\Users\Admin\Desktop\RandomBuild"
nodePath = "C:\Program Files\nodejs\node.exe"
serverPath = projectPath & "\server\server.js"
logPath = projectPath & "\server\auth-server.log"

WshShell.CurrentDirectory = projectPath

command = Chr(34) & nodePath & Chr(34) & " " & _
          Chr(34) & serverPath & Chr(34) & " >> " & _
          Chr(34) & logPath & Chr(34) & " 2>&1"

WshShell.Run "cmd.exe /c " & Chr(34) & command & Chr(34), 0, False