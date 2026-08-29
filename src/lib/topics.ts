export const topicLabels = {
  "civil-commercial": "民商事与公司法",
  "labor-social-security": "劳动与社会保障",
  "tort-traffic": "侵权与交通事故",
  "legal-practice-research": "法律实务与研究方法",
  "lawyer-toolbox": "律师工具箱",
  "technology-digital-life": "技术、效率与数字生活",
  "notes-observations": "随笔与观察",
} as const;

export const topicDescriptions: Record<keyof typeof topicLabels, string> = {
  "civil-commercial": "合同、公司、破产、物权及其他民商事问题。",
  "labor-social-security": "劳动合同、工资、休假与社会保障规则。",
  "tort-traffic": "人身损害、侵权责任与交通事故赔偿资料。",
  "legal-practice-research": "案例分析、法律解释与研究方法记录。",
  "lawyer-toolbox": "文档、排版、检索及法律工作中的工具实践。",
  "technology-digital-life": "软件、系统、自动化与个人数字生活。",
  "notes-observations": "读书、观影、成长和日常观察。",
};

export type Topic = keyof typeof topicLabels;
