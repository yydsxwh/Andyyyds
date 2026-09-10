# `@andyyyds/decorate`

从 [yydsxwh.com](https://www.yydsxwh.com/) 整包搬来的网站装扮产品。

## 能力

- 一键主题包（海岛/阳光、空间装扮、商务、经典）
- 配色、背景、版式密度
- 文字：字号、字体、颜色、特效、动画
- 门面：Logo、首页文案、Banner、CTA 跳转
- 首页时钟、颗秒标、PNG 挂件、门户卡片自由摆放
- 后台 `/studio/decorate`：试穿后点「保存装扮」才全站生效

## 目录

- `lib/` 装扮配置、主题库、排版与首页挂件规则
- `components/` 装扮后台与前台挂件
- `routes/`、`api/` 工作室页与保存/上传接口（`src/app` 只留薄入口）
- `styles/decorate.css` 文字动画与海岛主题动效

站点壳仍通过 `@andyyyds/shared/decorate` 等旧路径再导出读取配置，避免其它产品一次性改 import。
