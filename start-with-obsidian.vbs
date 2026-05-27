Set WshShell = CreateObject("WScript.Shell")

' Start Obsidian
WshShell.Run """E:\XIAZAI\obsidian\Obsidian.exe""", 1, False
WScript.Sleep 3000

' Start Pomodoro Timer (hidden, with npm absolute path)
WshShell.CurrentDirectory = "E:\AI\cuesor\first Claude code"
WshShell.Run """C:\Program Files\nodejs\npm.cmd"" start", 0, False
