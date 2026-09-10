# Andyyyds

多产品工作区：站点壳、公共包、以及按产品拆分的源码包。当前仍由同一个 Next.js 应用组装上线。

## 功能

- 课程广场（搜索 / 分类）
- 课程详情、试看、购买
- 模拟支付与优惠券（`YYDS20`）
- 我的学习 / 课时播放 / 进度标记
- 直播课占位
- 创作者中心（上架课程、订单与营收概览）
- **素材中心**：上传视频、自由分类、长命名（最多 200 字）
- **创建课程**：多选素材生成可售「单课」或「专栏」
- **三级分销**：后台可设一/二/三级比例，下级付费自动结算佣金

## 技术栈

- Next.js 16 + TypeScript + Tailwind CSS
- Prisma + SQLite
- Cookie Session（jose + bcryptjs）

## 快速开始

```bash
npm install
npm run db:reset
npm run dev
```

浏览器打开 [http://localhost:3000](http://localhost:3000)

### 演示账号

| 角色 | 邮箱 | 密码 |
|------|------|------|
| 学员 | student@yyds.local | 123456 |
| 讲师 | teacher@yyds.local | 123456 |
| 管理员 | admin@yyds.local | 123456 |

优惠券：`YYDS20`（满 99 减 20）

## 目录

- `packages/shared`（`@andyyyds/shared`）登录、支付、权限、国际化等公共能力
- `packages/company`（`@andyyyds/company`）公司介绍
- `packages/person`（`@andyyyds/person`）个人IP
- `packages/forum`（`@andyyyds/forum`）论坛
- `packages/meetup`（`@andyyyds/meetup`）约搭
- `packages/courses`（`@andyyyds/courses`）网课资料
- `packages/mathcode`（`@andyyyds/mathcode`）识图转LaTeX
- `packages/decorate`（`@andyyyds/decorate`）网站装扮（主题/配色/门面/首页挂件）
- `src/app` 站点路由与 API 薄封装（URL 不变）
- `src/components` 站点壳 UI（导航、支付页等）
- `prisma` 数据模型与种子数据
