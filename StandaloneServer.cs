using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Reflection;
using System.Text;
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

        [STAThread]
        static void Main(string[] args)
        {
            baseDir = AppDomain.CurrentDomain.BaseDirectory;
            currentAsm = Assembly.GetExecutingAssembly();

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
