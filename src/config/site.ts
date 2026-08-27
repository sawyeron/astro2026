export const site = {
  name: "小法进阶",
  origin: "https://imouyang.com",
  locale: "zh-CN",
  timeZone: "Asia/Shanghai",
} as const;

export type SiteConfig = typeof site;
