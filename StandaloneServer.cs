using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Net;
using System.Reflection;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Windows.Forms;

namespace VibePlayer
{
    class Program
    {
        private static HttpListener listener;
        private static string baseDir;
        private static int port = 5173;
        private static Assembly currentAsm;
        private static DateTime lastHeartbeat = DateTime.UtcNow;
        private static readonly object activityLock = new object();
        private static NotifyIcon trayIcon;

        private class DownloadJob
        {
            public string Id;
            public string Url;
            public string Status;
            public double Progress;
            public string Speed;
            public string Eta;
            public string Title;
            public string FileName;
            public string RelPath;
            public string Error;
        }

        private static Dictionary<string, DownloadJob> downloadJobs = new Dictionary<string, DownloadJob>();
        private static readonly object jobsLock = new object();

        private static string GetYtDlpPath()
        {
            string userProfile = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
            string wingetYt = Path.Combine(userProfile, @"AppData\Local\Microsoft\WinGet\Packages\yt-dlp.yt-dlp_Microsoft.Winget.Source_8wekyb3d8bbwe\yt-dlp.exe");
            string localYt = Path.Combine(baseDir, @"bin\yt-dlp.exe");
            string rootYt = Path.Combine(baseDir, @"yt-dlp.exe");
            if (File.Exists(localYt)) return localYt;
            if (File.Exists(rootYt)) return rootYt;
            if (File.Exists(wingetYt)) return wingetYt;
            return "yt-dlp.exe";
        }

        private static string GetFfmpegDir()
        {
            string userProfile = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
            string wingetFfmpeg = Path.Combine(userProfile, @"AppData\Local\Microsoft\WinGet\Packages\yt-dlp.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-N-126374-g089a48eb36-win64-gpl\bin");
            string localBin = Path.Combine(baseDir, "bin");
            if (File.Exists(Path.Combine(localBin, "ffmpeg.exe"))) return localBin;
            if (File.Exists(Path.Combine(wingetFfmpeg, "ffmpeg.exe"))) return wingetFfmpeg;
            return "";
        }

        private static string GetNodePath()
        {
            string pf = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
            string node = Path.Combine(pf, @"nodejs\node.exe");
            if (File.Exists(node)) return node;
            return "node.exe";
        }

        private static string EscapeJson(string s)
        {
            if (string.IsNullOrEmpty(s)) return "";
            return s.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\r", "").Replace("\n", " ");
        }

        [STAThread]
        static void Main(string[] args)
        {
            baseDir = AppDomain.CurrentDomain.BaseDirectory;
            currentAsm = Assembly.GetExecutingAssembly();
            AppDomain.CurrentDomain.UnhandledException += (s, e) => {
                try { File.WriteAllText(Path.Combine(baseDir, "error.log"), e.ExceptionObject.ToString()); } catch {}
            };

            // Try port 5173, if busy try next ports
            for (int p = 5173; p <= 5190; p++)
            {
                try
                {
                    listener = new HttpListener();
                    listener.Prefixes.Add("http://127.0.0.1:" + p + "/");
                    listener.Start();
                    port = p;
                    break;
                }
                catch
                {
                    if (listener != null) ((IDisposable)listener).Dispose();
                    listener = null;
                }
            }

            if (listener == null)
            {
                MessageBox.Show("Could not start VibePlayer local server on ports 5173-5190.", "VibePlayer Error");
                return;
            }

            // Start background server thread
            Thread serverThread = new Thread(ListenLoop);
            serverThread.IsBackground = true;
            serverThread.Start();

            // Start 5-minute inactivity watchdog thread:
            // Automatically terminates server 5 minutes after the browser window is closed
            Thread watchdog = new Thread(() =>
            {
                while (true)
                {
                    Thread.Sleep(5000);
                    double idleMinutes = 0;
                    lock (activityLock)
                    {
                        idleMinutes = (DateTime.UtcNow - lastHeartbeat).TotalMinutes;
                    }

                    if (idleMinutes >= 5.0)
                    {
                        try
                        {
                            if (trayIcon != null)
                            {
                                trayIcon.Visible = false;
                                trayIcon.Dispose();
                            }
                            if (listener != null)
                            {
                                listener.Stop();
                                ((IDisposable)listener).Dispose();
                            }
                        }
                        catch { }
                        Environment.Exit(0);
                    }
                }
            });
            watchdog.IsBackground = true;
            watchdog.Start();

            // Open default browser
            string url = "http://127.0.0.1:" + port + "/";
            try
            {
                Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
            }
            catch
            {
                Process.Start("explorer.exe", url);
            }

            // System tray icon with custom Kaer Morhen icon
            trayIcon = new NotifyIcon();
            trayIcon.Text = "VibePlayer - Witcher Edition";
            try
            {
                Stream iconStream = currentAsm.GetManifestResourceStream("app.ico");
                if (iconStream != null)
                {
                    using (iconStream) { trayIcon.Icon = new System.Drawing.Icon(iconStream); }
                }
                else if (File.Exists(Path.Combine(baseDir, "app.ico")))
                {
                    trayIcon.Icon = new System.Drawing.Icon(Path.Combine(baseDir, "app.ico"));
                }
                else
                {
                    trayIcon.Icon = System.Drawing.SystemIcons.Application;
                }
            }
            catch
            {
                trayIcon.Icon = System.Drawing.SystemIcons.Application;
            }
            trayIcon.Visible = true;

            ContextMenu menu = new ContextMenu();
            menu.MenuItems.Add("Open in Browser", (s, e) => {
                Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
            });
            menu.MenuItems.Add("Exit", (s, e) => {
                trayIcon.Visible = false;
                Application.Exit();
            });
            trayIcon.ContextMenu = menu;

            trayIcon.ShowBalloonTip(3000, "VibePlayer", "VibePlayer running at " + url + "\n(All 3D assets embedded in .exe)", ToolTipIcon.Info);

            Application.Run();
        }

        private static void ListenLoop()
        {
            while (listener != null && listener.IsListening)
            {
                try
                {
                    var ctx = listener.GetContext();
                    ThreadPool.QueueUserWorkItem((state) => HandleRequest(ctx));
                }
                catch
                {
                    break;
                }
            }
        }

        private static void HandleRequest(HttpListenerContext context)
        {
            var req = context.Request;
            var res = context.Response;

            try
            {
                lock (activityLock)
                {
                    lastHeartbeat = DateTime.UtcNow;
                }

                string rawUrl = req.Url.AbsolutePath;

                if (rawUrl.Equals("/api/heartbeat", StringComparison.OrdinalIgnoreCase))
                {
                    res.Headers.Add("Access-Control-Allow-Origin", "*");
                    res.StatusCode = 200;
                    res.ContentType = "text/plain";
                    byte[] ok = Encoding.UTF8.GetBytes("OK");
                    res.OutputStream.Write(ok, 0, ok.Length);
                    res.Close();
                    return;
                }

                // API: GET /api/tracks
                if (rawUrl.Equals("/api/tracks", StringComparison.OrdinalIgnoreCase) && req.HttpMethod == "GET")
                {
                    res.Headers.Add("Access-Control-Allow-Origin", "*");
                    res.StatusCode = 200;
                    res.ContentType = "application/json; charset=utf-8";
                    string audioDir = Path.Combine(baseDir, "assets", "audio");
                    var items = new List<string>();
                    if (Directory.Exists(audioDir))
                    {
                        var dirInfo = new DirectoryInfo(audioDir);
                        var files = dirInfo.GetFiles("*.*");
                        Array.Sort(files, (a, b) => b.LastWriteTimeUtc.CompareTo(a.LastWriteTimeUtc));
                        foreach (var fi in files)
                        {
                            string ext2 = fi.Extension.ToLowerInvariant();
                            if (ext2 == ".mp3" || ext2 == ".m4a" || ext2 == ".wav" || ext2 == ".ogg" || ext2 == ".webm")
                            {
                                string name = Path.GetFileNameWithoutExtension(fi.Name);
                                double mb = (double)fi.Length / (1024.0 * 1024.0);
                                items.Add(string.Format("{{\"name\":\"{0}\",\"fileName\":\"{1}\",\"relPath\":\"assets/audio/{2}\",\"sizeMB\":\"{3}\"}}",
                                    EscapeJson(name), EscapeJson(fi.Name), EscapeJson(fi.Name), mb.ToString("0.00", CultureInfo.InvariantCulture)));
                            }
                        }
                    }
                    string json = "{\"tracks\":[" + string.Join(",", items.ToArray()) + "]}";
                    byte[] bytes = Encoding.UTF8.GetBytes(json);
                    res.OutputStream.Write(bytes, 0, bytes.Length);
                    res.Close();
                    return;
                }

                // API: GET /api/yt/info?url=...
                if (rawUrl.Equals("/api/yt/info", StringComparison.OrdinalIgnoreCase) && req.HttpMethod == "GET")
                {
                    res.Headers.Add("Access-Control-Allow-Origin", "*");
                    res.ContentType = "application/json; charset=utf-8";
                    string ytUrl = req.QueryString["url"];
                    if (string.IsNullOrEmpty(ytUrl))
                    {
                        res.StatusCode = 400;
                        byte[] errBytes = Encoding.UTF8.GetBytes("{\"error\":\"Missing url parameter\"}");
                        res.OutputStream.Write(errBytes, 0, errBytes.Length);
                        res.Close();
                        return;
                    }

                    try
                    {
                        string ytPath = GetYtDlpPath();
                        string nodePath = GetNodePath();
                        var psi = new ProcessStartInfo();
                        psi.FileName = ytPath;
                        psi.Arguments = string.Format("--no-playlist --js-runtimes node:\"{0}\" --print \"%(title)s|||%(uploader)s|||%(duration_string)s|||%(thumbnail)s\" \"{1}\"", nodePath, ytUrl);
                        psi.UseShellExecute = false;
                        psi.RedirectStandardOutput = true;
                        psi.RedirectStandardError = true;
                        psi.CreateNoWindow = true;
                        psi.StandardOutputEncoding = Encoding.UTF8;

                        using (var proc = Process.Start(psi))
                        {
                            string output = proc.StandardOutput.ReadToEnd();
                            string errOut = proc.StandardError.ReadToEnd();
                            proc.WaitForExit(30000);

                            if (proc.ExitCode == 0 && !string.IsNullOrEmpty(output))
                            {
                                string[] parts = output.Trim().Split(new string[] { "|||" }, StringSplitOptions.None);
                                string title = parts.Length > 0 ? parts[0] : "Unknown Title";
                                string uploader = parts.Length > 1 ? parts[1] : "YouTube";
                                string duration = parts.Length > 2 ? parts[2] : "00:00";
                                string thumbnail = parts.Length > 3 ? parts[3] : "";

                                string json = string.Format("{{\"ok\":true,\"title\":\"{0}\",\"uploader\":\"{1}\",\"duration\":\"{2}\",\"thumbnail\":\"{3}\",\"url\":\"{4}\"}}",
                                    EscapeJson(title), EscapeJson(uploader), EscapeJson(duration), EscapeJson(thumbnail), EscapeJson(ytUrl));

                                res.StatusCode = 200;
                                byte[] b = Encoding.UTF8.GetBytes(json);
                                res.OutputStream.Write(b, 0, b.Length);
                            }
                            else
                            {
                                res.StatusCode = 500;
                                string json = string.Format("{{\"error\":\"yt-dlp failed\",\"details\":\"{0}\"}}", EscapeJson(errOut));
                                byte[] b = Encoding.UTF8.GetBytes(json);
                                res.OutputStream.Write(b, 0, b.Length);
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        res.StatusCode = 500;
                        string json = string.Format("{{\"error\":\"{0}\"}}", EscapeJson(ex.Message));
                        byte[] b = Encoding.UTF8.GetBytes(json);
                        res.OutputStream.Write(b, 0, b.Length);
                    }
                    res.Close();
                    return;
                }

                // API: GET /api/yt/stream?url=...
                if (rawUrl.Equals("/api/yt/stream", StringComparison.OrdinalIgnoreCase) && req.HttpMethod == "GET")
                {
                    res.Headers.Add("Access-Control-Allow-Origin", "*");
                    res.Headers.Add("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
                    res.Headers.Add("Access-Control-Allow-Headers", "Range, Content-Type, Accept");
                    string ytUrl = req.QueryString["url"];
                    if (string.IsNullOrEmpty(ytUrl))
                    {
                        res.StatusCode = 400;
                        res.Close();
                        return;
                    }

                    try
                    {
                        string ytPath = GetYtDlpPath();
                        string nodePath = GetNodePath();
                        var psi = new ProcessStartInfo();
                        psi.FileName = ytPath;
                        psi.Arguments = string.Format("--no-playlist --js-runtimes node:\"{0}\" -g -f ba/b \"{1}\"", nodePath, ytUrl);
                        psi.UseShellExecute = false;
                        psi.RedirectStandardOutput = true;
                        psi.CreateNoWindow = true;
                        psi.StandardOutputEncoding = Encoding.UTF8;

                        string directUrl = null;
                        using (var proc = Process.Start(psi))
                        {
                            directUrl = proc.StandardOutput.ReadLine();
                            proc.WaitForExit(15000);
                        }

                        if (string.IsNullOrEmpty(directUrl))
                        {
                            res.StatusCode = 502;
                            res.Close();
                            return;
                        }

                        HttpWebRequest proxyReq = (HttpWebRequest)WebRequest.Create(directUrl.Trim());
                        proxyReq.UserAgent = "Mozilla/5.0";
                        string rangeHeader = req.Headers["Range"];
                        if (!string.IsNullOrEmpty(rangeHeader))
                        {
                            var match = Regex.Match(rangeHeader, @"bytes=(\d+)-(\d*)");
                            if (match.Success)
                            {
                                long start = long.Parse(match.Groups[1].Value);
                                if (!string.IsNullOrEmpty(match.Groups[2].Value))
                                {
                                    long end = long.Parse(match.Groups[2].Value);
                                    proxyReq.AddRange((int)start, (int)end);
                                }
                                else
                                {
                                    proxyReq.AddRange((int)start);
                                }
                            }
                        }

                        using (HttpWebResponse proxyRes = (HttpWebResponse)proxyReq.GetResponse())
                        {
                            res.StatusCode = (int)proxyRes.StatusCode;
                            res.ContentType = proxyRes.ContentType;
                            res.Headers.Add("Accept-Ranges", "bytes");
                            if (proxyRes.ContentLength >= 0) res.ContentLength64 = proxyRes.ContentLength;
                            string cr = proxyRes.Headers["Content-Range"];
                            if (!string.IsNullOrEmpty(cr)) res.Headers.Add("Content-Range", cr);

                            using (Stream s = proxyRes.GetResponseStream())
                            {
                                byte[] buf = new byte[64 * 1024];
                                int read;
                                while ((read = s.Read(buf, 0, buf.Length)) > 0)
                                {
                                    res.OutputStream.Write(buf, 0, read);
                                }
                            }
                        }
                    }
                    catch
                    {
                        try { res.StatusCode = 500; } catch { }
                    }
                    try { res.Close(); } catch { }
                    return;
                }

                // API: POST /api/yt/download
                if (rawUrl.Equals("/api/yt/download", StringComparison.OrdinalIgnoreCase) && req.HttpMethod == "POST")
                {
                    res.Headers.Add("Access-Control-Allow-Origin", "*");
                    res.ContentType = "application/json; charset=utf-8";
                    string body = "";
                    using (var reader = new StreamReader(req.InputStream, req.ContentEncoding))
                    {
                        body = reader.ReadToEnd();
                    }

                    var urlMatch = Regex.Match(body, "\"url\"\\s*:\\s*\"([^\"]+)\"");
                    string ytUrl = urlMatch.Success ? urlMatch.Groups[1].Value.Replace("\\/", "/") : "";

                    if (string.IsNullOrEmpty(ytUrl))
                    {
                        res.StatusCode = 400;
                        byte[] b = Encoding.UTF8.GetBytes("{\"error\":\"Missing url\"}");
                        res.OutputStream.Write(b, 0, b.Length);
                        res.Close();
                        return;
                    }

                    string jobId = "yt_" + DateTime.UtcNow.Ticks.ToString();
                    var job = new DownloadJob { Id = jobId, Url = ytUrl, Status = "starting", Progress = 0 };
                    lock (jobsLock) { downloadJobs[jobId] = job; }

                    string audioDir = Path.Combine(baseDir, "assets", "audio");
                    if (!Directory.Exists(audioDir)) Directory.CreateDirectory(audioDir);

                    string ytPath = GetYtDlpPath();
                    string nodePath = GetNodePath();
                    string ffmpegDir = GetFfmpegDir();
                    string outTemplate = Path.Combine(audioDir, "%(title)s.%(ext)s");

                    string args = string.Format("--no-playlist --js-runtimes node:\"{0}\" -x --audio-format mp3 --audio-quality 320k --embed-metadata -o \"{1}\"", nodePath, outTemplate);
                    if (!string.IsNullOrEmpty(ffmpegDir))
                    {
                        args += string.Format(" --ffmpeg-location \"{0}\"", ffmpegDir);
                    }
                    args += string.Format(" \"{0}\"", ytUrl);

                    ThreadPool.QueueUserWorkItem((state) =>
                    {
                        try
                        {
                            var psi = new ProcessStartInfo(ytPath, args);
                            psi.UseShellExecute = false;
                            psi.RedirectStandardOutput = true;
                            psi.RedirectStandardError = true;
                            psi.CreateNoWindow = true;
                            psi.StandardOutputEncoding = Encoding.UTF8;

                            using (var proc = Process.Start(psi))
                            {
                                proc.OutputDataReceived += (s, e) =>
                                {
                                    if (string.IsNullOrEmpty(e.Data)) return;
                                    string line = e.Data;
                                    var m = Regex.Match(line, @"\[download\]\s+(\d+(?:\.\d+)?)%\s+of\s+~?([^\s]+)\s+at\s+([^\s]+)\s+ETA\s+([^\s]+)");
                                    if (m.Success)
                                    {
                                        job.Status = "downloading";
                                        double p;
                                        if (double.TryParse(m.Groups[1].Value, NumberStyles.Any, CultureInfo.InvariantCulture, out p))
                                        {
                                            job.Progress = p;
                                        }
                                        job.Speed = m.Groups[3].Value;
                                        job.Eta = m.Groups[4].Value;
                                    }
                                    if (line.Contains("[ExtractAudio]"))
                                    {
                                        job.Status = "converting";
                                        job.Progress = 98;
                                        job.Speed = "Converting MP3...";
                                    }
                                    var tm = Regex.Match(line, @"Destination:\s*(.+?\.(?:webm|m4a|mp3))", RegexOptions.IgnoreCase);
                                    if (tm.Success)
                                    {
                                        string rName = Path.GetFileName(tm.Groups[1].Value);
                                        job.FileName = Path.ChangeExtension(rName, ".mp3");
                                        job.Title = Path.GetFileNameWithoutExtension(rName);
                                        job.RelPath = "assets/audio/" + job.FileName;
                                    }
                                };

                                proc.BeginOutputReadLine();
                                proc.WaitForExit();

                                if (proc.ExitCode == 0)
                                {
                                    job.Status = "completed";
                                    job.Progress = 100;
                                    job.Speed = "Done";
                                    if (string.IsNullOrEmpty(job.FileName))
                                    {
                                        var dirInfo = new DirectoryInfo(audioDir);
                                        var mp3s = dirInfo.GetFiles("*.mp3");
                                        if (mp3s.Length > 0)
                                        {
                                            Array.Sort(mp3s, (a, b) => b.LastWriteTimeUtc.CompareTo(a.LastWriteTimeUtc));
                                            job.FileName = mp3s[0].Name;
                                            job.Title = Path.GetFileNameWithoutExtension(mp3s[0].Name);
                                            job.RelPath = "assets/audio/" + job.FileName;
                                        }
                                    }
                                }
                                else
                                {
                                    job.Status = "error";
                                    job.Error = "Process exited with code " + proc.ExitCode;
                                }
                            }
                        }
                        catch (Exception ex)
                        {
                            job.Status = "error";
                            job.Error = ex.Message;
                        }
                    });

                    res.StatusCode = 200;
                    byte[] resp = Encoding.UTF8.GetBytes(string.Format("{{\"ok\":true,\"jobId\":\"{0}\"}}", jobId));
                    res.OutputStream.Write(resp, 0, resp.Length);
                    res.Close();
                    return;
                }

                // API: GET /api/yt/progress
                if (rawUrl.Equals("/api/yt/progress", StringComparison.OrdinalIgnoreCase) && req.HttpMethod == "GET")
                {
                    res.Headers.Add("Access-Control-Allow-Origin", "*");
                    res.ContentType = "application/json; charset=utf-8";
                    string jobId = req.QueryString["jobId"];
                    DownloadJob job = null;
                    lock (jobsLock)
                    {
                        if (!string.IsNullOrEmpty(jobId) && downloadJobs.ContainsKey(jobId))
                        {
                            job = downloadJobs[jobId];
                        }
                    }

                    if (job == null)
                    {
                        res.StatusCode = 404;
                        byte[] b = Encoding.UTF8.GetBytes("{\"error\":\"Job not found\"}");
                        res.OutputStream.Write(b, 0, b.Length);
                    }
                    else
                    {
                        string json = string.Format("{{\"id\":\"{0}\",\"status\":\"{1}\",\"progress\":{2},\"speed\":\"{3}\",\"eta\":\"{4}\",\"title\":\"{5}\",\"fileName\":\"{6}\",\"relPath\":\"{7}\",\"error\":{8}}}",
                            job.Id, job.Status, job.Progress.ToString("0.0", CultureInfo.InvariantCulture),
                            EscapeJson(job.Speed ?? ""), EscapeJson(job.Eta ?? ""), EscapeJson(job.Title ?? ""), EscapeJson(job.FileName ?? ""),
                            EscapeJson(job.RelPath ?? ""), job.Error != null ? "\"" + EscapeJson(job.Error) + "\"" : "null");
                        res.StatusCode = 200;
                        byte[] b = Encoding.UTF8.GetBytes(json);
                        res.OutputStream.Write(b, 0, b.Length);
                    }
                    res.Close();
                    return;
                }

                if (string.IsNullOrEmpty(rawUrl) || rawUrl == "/")
                {
                    rawUrl = "/index.html";
                }

                string fileName = rawUrl.TrimStart('/');
                string filePath = Path.Combine(baseDir, fileName.Replace('/', Path.DirectorySeparatorChar));

                res.Headers.Add("Access-Control-Allow-Origin", "*");
                res.Headers.Add("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
                res.Headers.Add("Access-Control-Allow-Headers", "*");

                if (req.HttpMethod == "OPTIONS")
                {
                    res.StatusCode = 200;
                    res.Close();
                    return;
                }

                Stream dataStream = null;
                long totalLength = 0;

                // 1. Check local file on disk first
                if (File.Exists(filePath))
                {
                    try
                    {
                        var fs = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.Read);
                        totalLength = fs.Length;
                        dataStream = fs;
                    }
                    catch { }
                }

                // 2. If not on disk, serve from embedded assembly resource
                if (dataStream == null)
                {
                    string normSlash = fileName.Replace('\\', '/');
                    string normBackslash = fileName.Replace('/', '\\');
                    string normDot = normSlash.Replace('/', '.');

                    dataStream = currentAsm.GetManifestResourceStream(normSlash);
                    if (dataStream == null) dataStream = currentAsm.GetManifestResourceStream(normDot);
                    if (dataStream == null) dataStream = currentAsm.GetManifestResourceStream(normBackslash);
                    if (dataStream == null) dataStream = currentAsm.GetManifestResourceStream(fileName);

                    if (dataStream == null)
                    {
                        foreach (string n in currentAsm.GetManifestResourceNames())
                        {
                            if (n.Equals(normSlash, StringComparison.OrdinalIgnoreCase) ||
                                n.Equals(normDot, StringComparison.OrdinalIgnoreCase) ||
                                n.EndsWith("." + normDot, StringComparison.OrdinalIgnoreCase) ||
                                n.EndsWith(normDot, StringComparison.OrdinalIgnoreCase) ||
                                n.EndsWith(normSlash, StringComparison.OrdinalIgnoreCase))
                            {
                                dataStream = currentAsm.GetManifestResourceStream(n);
                                break;
                            }
                        }
                    }

                    if (dataStream != null)
                    {
                        totalLength = dataStream.Length;
                    }
                }

                if (dataStream == null)
                {
                    res.StatusCode = 404;
                    byte[] notFound = Encoding.UTF8.GetBytes("File Not Found: " + rawUrl);
                    res.ContentType = "text/plain; charset=utf-8";
                    res.OutputStream.Write(notFound, 0, notFound.Length);
                    res.Close();
                    return;
                }

                string ext = Path.GetExtension(fileName).ToLowerInvariant();
                string contentType = "application/octet-stream";
                switch (ext)
                {
                    case ".html": contentType = "text/html; charset=utf-8"; break;
                    case ".js": contentType = "application/javascript; charset=utf-8"; break;
                    case ".css": contentType = "text/css; charset=utf-8"; break;
                    case ".json": contentType = "application/json"; break;
                    case ".glb": contentType = "model/gltf-binary"; break;
                    case ".gltf": contentType = "model/gltf+json"; break;
                    case ".png": contentType = "image/png"; break;
                    case ".jpg": case ".jpeg": contentType = "image/jpeg"; break;
                    case ".mp3": contentType = "audio/mpeg"; break;
                    case ".wav": contentType = "audio/wav"; break;
                    case ".wasm": contentType = "application/wasm"; break;
                }

                res.ContentType = contentType;
                res.Headers.Add("Accept-Ranges", "bytes");

                using (dataStream)
                {
                    string rangeHeader = req.Headers["Range"];
                    if (!string.IsNullOrEmpty(rangeHeader) && rangeHeader.StartsWith("bytes="))
                    {
                        string[] parts = rangeHeader.Substring(6).Split('-');
                        long start = 0;
                        long end = totalLength - 1;

                        if (!string.IsNullOrEmpty(parts[0]))
                            long.TryParse(parts[0], out start);
                        if (parts.Length > 1 && !string.IsNullOrEmpty(parts[1]))
                            long.TryParse(parts[1], out end);

                        if (end >= totalLength) end = totalLength - 1;
                        long lengthToRead = end - start + 1;

                        res.StatusCode = 206;
                        res.Headers.Add("Content-Range", string.Format("bytes {0}-{1}/{2}", start, end, totalLength));
                        res.ContentLength64 = lengthToRead;

                        if (dataStream.CanSeek) dataStream.Seek(start, SeekOrigin.Begin);
                        byte[] buffer = new byte[64 * 1024];
                        long remaining = lengthToRead;
                        while (remaining > 0)
                        {
                            int toRead = (int)Math.Min(buffer.Length, remaining);
                            int read = dataStream.Read(buffer, 0, toRead);
                            if (read <= 0) break;
                            res.OutputStream.Write(buffer, 0, read);
                            remaining -= read;
                        }
                    }
                    else
                    {
                        res.StatusCode = 200;
                        res.ContentLength64 = totalLength;
                        byte[] buffer = new byte[64 * 1024];
                        int read;
                        while ((read = dataStream.Read(buffer, 0, buffer.Length)) > 0)
                        {
                            res.OutputStream.Write(buffer, 0, read);
                        }
                    }
                }
            }
            catch
            {
            }
            finally
            {
                try { res.Close(); } catch { }
            }
        }
    }
}
