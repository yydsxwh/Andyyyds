/**
 * 约搭时区城市类型：与数据文件拆分，避免类型与巨型列表互相牵制。
 */
export type MeetupTzCity = {
  id: string;
  labelZh: string;
  labelEn: string;
  /** 常用别名（如 NYC、汉城），中英搜索一并匹配 */
  aliases?: string[];
  timeZone: string;
  countryZh: string;
};
