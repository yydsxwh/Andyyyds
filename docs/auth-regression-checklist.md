# 认证回归清单（主站 Andyyyds）

合并前，凡改动涉及 auth / session / cookie / middleware / account / shared auth / login / logout / redirect / user context，必须验证下面 7 项。不要用「按钮消失了」代替真实 Session 检查。

Session Cookie 名：`yyds_session`。登录与登出必须共用 `packages/shared/src/auth-session-cookie.ts`。

1. **注册**：新账号能建出来，并进入已登录态。
2. **登录**：邮箱 / 手机 / 微信（若该环境已配置）都能写入 `yyds_session`。
3. **保持登录**：刷新页面后顶栏仍是当前用户，不是游客。
4. **登出**：点「退出」后服务端 `sessionEpoch` 增加，响应带 `Set-Cookie: yyds_session=; Max-Age=0`（path=/，secure 与登录一致）。
5. **登出后刷新**：再刷新、关标签重开，仍是未登录；浏览器后退不能继续读受保护数据。
6. **受保护 API**：未登录或已登出访问 `/api/cart`（或同等接口）返回 401；登录后返回 200。
7. **再登录**：同一账号能重新登录，新 Cookie 与旧 JWT 不同，且旧 Cookie 重放失败。

本地命令：

```bash
npx tsx packages/shared/src/auth-session-cookie.test.ts
npx tsx scripts/auth-regression.test.ts
```

第二项需要本机 `npm run dev`。不要连生产数据库，不要 `db:reset`。

当前没有 Playwright E2E；浏览器「点退出 → 头像消失 → 刷新仍未登录」仍须手工看一眼。
