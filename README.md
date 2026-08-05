# YYDS 课程平台

知识付费卖课网站（同类型能力，非荔枝微课复制品）。

## 功能

- 课程广场（搜索 / 分类）
- 课程详情、试看、购买
- 模拟支付与优惠券（`YYDS20`）
- 我的学习 / 课时播放 / 进度标记
- 直播课占位
- 创作者中心（上架课程、订单与营收概览）
- 注册邀请码分销基础能力

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

- `src/app` 页面与 API
- `src/components` UI 组件
- `src/lib` 鉴权 / 数据库 / 工具
- `prisma` 数据模型与种子数据
