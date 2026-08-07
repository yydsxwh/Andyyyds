/* Check prod SSH + whether WeChat AppSecret is set (no secret values printed). */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { Client } = require("ssh2");

const HOST = "47.242.157.181";
const KEY = path.join(os.homedir(), ".ssh", "yyds_aliyun");

const conn = new Client();
conn
  .on("ready", () => {
    const cmd = [
      "curl -s -o /dev/null -w local:%{http_code} http://127.0.0.1:3000/; echo",
      "pm2 jlist 2>/dev/null | head -c 400; echo",
      "cd /var/www/yyds-course-platform && node scripts/_peek_wechat_flags.js",
    ].join(" && ");
    conn.exec(cmd, (err, stream) => {
      if (err) {
        console.error("EXEC_FAIL", err.message);
        conn.end();
        return;
      }
      stream.on("data", (d) => process.stdout.write(d));
      stream.stderr.on("data", (d) => process.stderr.write(d));
      stream.on("close", () => conn.end());
    });
  })
  .on("error", (e) => {
    console.error("SSH_FAIL", e.message);
    process.exitCode = 1;
  })
  .connect({
    host: HOST,
    username: "admin",
    privateKey: fs.readFileSync(KEY),
    readyTimeout: 20000,
  });
