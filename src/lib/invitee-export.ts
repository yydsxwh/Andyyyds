/**
 * 邀请下级导出：UTF-8 BOM CSV（Excel 可直接打开）与简易 SpreadsheetML（.xls）。
 */

import { ROLE_LABEL, type Role } from "./roles";

export type InviteeExportRow = {
  name: string;
  email: string;
  phone: string;
  role: string;
  referralCode: string;
  createdAt: string | Date;
  orderCount: number;
  enrollmentCount: number;
  paidOrderCount: number;
};

function roleLabel(role: string) {
  return ROLE_LABEL[role as Role] || role;
}

function escapeCsvCell(value: string | number) {
  const s = String(value ?? "");
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function formatDate(value: string | Date) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("zh-CN", { hour12: false });
}

/** Excel 友好 CSV（带 BOM） */
export function inviteesToCsv(
  rows: InviteeExportRow[],
  inviterName: string,
): string {
  const header = [
    "邀请人",
    "下级姓名",
    "邮箱",
    "手机号",
    "角色",
    "邀请码",
    "注册时间",
    "订单数",
    "已支付订单数",
    "报名数",
  ];
  const lines = [
    header.map(escapeCsvCell).join(","),
    ...rows.map((r) =>
      [
        inviterName,
        r.name,
        r.email,
        r.phone || "",
        roleLabel(r.role),
        r.referralCode,
        formatDate(r.createdAt),
        r.orderCount,
        r.paidOrderCount,
        r.enrollmentCount,
      ]
        .map(escapeCsvCell)
        .join(","),
    ),
  ];
  return `\uFEFF${lines.join("\r\n")}`;
}

function escapeXml(value: string | number) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** SpreadsheetML，Excel 可当作 .xls 打开 */
export function inviteesToExcelXml(
  rows: InviteeExportRow[],
  inviterName: string,
): string {
  const headers = [
    "邀请人",
    "下级姓名",
    "邮箱",
    "手机号",
    "角色",
    "邀请码",
    "注册时间",
    "订单数",
    "已支付订单数",
    "报名数",
  ];
  const headerRow = headers
    .map((h) => `<Cell><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`)
    .join("");
  const dataRows = rows
    .map((r) => {
      const cells = [
        inviterName,
        r.name,
        r.email,
        r.phone || "",
        roleLabel(r.role),
        r.referralCode,
        formatDate(r.createdAt),
        r.orderCount,
        r.paidOrderCount,
        r.enrollmentCount,
      ].map((v, i) => {
        const isNum = i >= 7;
        return `<Cell><Data ss:Type="${isNum ? "Number" : "String"}">${escapeXml(v)}</Data></Cell>`;
      });
      return `<Row>${cells.join("")}</Row>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="邀请下级">
  <Table>
   <Row>${headerRow}</Row>
   ${dataRows}
  </Table>
 </Worksheet>
</Workbook>`;
}

export function safeExportFilename(name: string, ext: string) {
  const base = (name || "user")
    .replace(/[\\/:*?"<>|]+/g, "_")
    .trim()
    .slice(0, 40);
  const stamp = new Date().toISOString().slice(0, 10);
  return `${base}-邀请下级-${stamp}.${ext}`;
}
