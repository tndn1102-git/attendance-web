' ASCII ONLY. Runs a .cmd with NO console window, waits for it, returns its exit code.
' Why (2026-09-11): scheduled .cmd tasks open a visible console at 07:10/08:05. plum-ep11-comment
' died with 0xC000013A (console closed) right after posting the comment, so the pin never ran.
' Usage in Task Scheduler:  wscript.exe "D:\test3\suno-sleep-yt\tools\run_hidden.vbs" "D:\...\x.cmd"
Dim sh, rc
Set sh = CreateObject("WScript.Shell")
rc = sh.Run("cmd.exe /c """ & WScript.Arguments(0) & """", 0, True)
WScript.Quit rc
