/* Check prod SSH + whether WeChat AppSecret is set (no secret values printed). */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { Client } = require("ssh2");

const HOST = process.env.OPS_SSH_HOST;
const APP_DIR = process.env.OPS_APP_DIR;
const KEY = process.env.OPS_SSH_KEY_FILE
  ? path.resolve(process.env.OPS_SSH_KEY_FILE)
  : path.join(os.homedir(), ".ssh", "yyds_aliyun");

if (!HOST || !APP_DIR) {
  console.error("set OPS_SSH_HOST and OPS_APP_DIR");
  process.exit(1);
}

const conn = new Client();
conn
  .on("ready", () => {
    const cmd = [
      "curl -s -o /dev/null -w local:%{http_code} http://127.0.0.1:3000/; echo",
      "pm2 jlist 2>/dev/null | head -c 400; echo",
      `cd '${APP_DIR.replaceAll("'", "")}' && node scripts/_peek_wechat_flags.js`,
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
