using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Threading;
using System.Windows.Forms;

namespace WitcherLobbyLauncher
{
    static class Program
    {
        [STAThread]
        static void Main()
        {
            string appDir = AppDomain.CurrentDomain.BaseDirectory;
            string serverScript = Path.Combine(appDir, "server.js");
            string url = "http://127.0.0.1:5173/";

            // Check if server is already running
            bool isRunning = false;
            try
            {
                HttpWebRequest req = (HttpWebRequest)WebRequest.Create(url);
                req.Timeout = 1000;
                req.Method = "HEAD";
                using (HttpWebResponse res = (HttpWebResponse)req.GetResponse())
                {
                    if (res.StatusCode == HttpStatusCode.OK) isRunning = true;
                }
            }
            catch { }

            // If not running, start node server.js in background
            if (!isRunning && File.Exists(serverScript))
            {
                try
                {
                    ProcessStartInfo psi = new ProcessStartInfo();
                    psi.FileName = "node";
                    psi.Arguments = "\"" + serverScript + "\"";
                    psi.WorkingDirectory = appDir;
                    psi.UseShellExecute = false;
                    psi.CreateNoWindow = true;
                    psi.WindowStyle = ProcessWindowStyle.Hidden;
                    Process.Start(psi);
                    Thread.Sleep(800); // Give server a moment to bind
                }
                catch (Exception ex)
                {
                    MessageBox.Show("Node.js required to run local 3D server: " + ex.Message, "Witcher 3 Lobby");
                }
            }

            // Open default browser
            try
            {
                Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
            }
            catch
            {
                Process.Start("explorer.exe", url);
            }
        }
    }
}
