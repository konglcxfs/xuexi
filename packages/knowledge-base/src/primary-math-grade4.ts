import type { KnowledgePoint } from '@xuexi/shared'

const GRAPH = 'primary-math-grade4-up'

/**
 * 四年级上册数学知识点图谱（人教版 / 北师大版共有的核心骨架）。
 * 包含：1-4 单元 - 大数的认识 / 角的度量 / 两位数乘除 / 平行四边形 / 常规统计。
 * 五六单元 - 流畅乘除 + 可能性 + 总复习。
 *
 * 每个节点都标注了 prerequisite 关系，引擎可以基于此排序讲解。
 */
function kp(args: {
  code: string
  title: string
  description: string
  prerequisites?: string[]
  difficulty?: number
  tags?: string[]
}): KnowledgePoint {
  return {
    id: `primary_school:${GRAPH}:${args.code}`,
    role: 'primary_school',
    graph: GRAPH,
    code: args.code,
    title: args.title,
    description: args.description,
    prerequisites: (args.prerequisites ?? []).map((c) => `primary_school:${GRAPH}:${c}`),
    difficulty: args.difficulty ?? 0.5,
    tags: args.tags ?? [],
    mastery: { explain: 0.7, apply: 0.65, extend: 0.4 },
  }
}

export const PRIMARY_MATH_GRADE4_UP: KnowledgePoint[] = [
  // 第一单元：大数的认识
  kp({
    code: 'number-place-value',
    title: '数位与计数单位',
    description: '认识万级、亿级的数位顺序表，掌握十进制计数法。',
    tags: ['number', 'base'],
  }),
  kp({
    code: 'number-read-write',
    title: '多位数的读法和写法',
    description: '能正确读、写亿以内的数；中间有 0、末尾有 0 的读写规则。',
    prerequisites: ['number-place-value'],
    difficulty: 0.4,
    tags: ['number'],
  }),
  kp({
    code: 'number-size-compare',
    title: '多位数的比较大小',
    description: '位数不同的数比较；位数相同的数从最高位开始比较。',
    prerequisites: ['number-place-value'],
    difficulty: 0.35,
    tags: ['number'],
  }),
  kp({
    code: 'number-rounding',
    title: '用"四舍五入"法求近似数',
    description: '掌握四舍五入到万位、亿位，理解"近似数"的实际意义。',
    prerequisites: ['number-place-value', 'number-read-write'],
    difficulty: 0.45,
    tags: ['number'],
  }),

  // 第二单元：公顷和平方千米
  kp({
    code: 'unit-area-large',
    title: '公顷和平方千米',
    description: '认识面积单位公顷、平方千米；理解它们与平方米的关系。',
    tags: ['measurement', 'unit'],
  }),

  // 第三单元：角的度量
  kp({
    code: 'angle-concept',
    title: '角的初步认识',
    description: '从一个点引出两条射线所组成的图形叫角；角的大小与边的长短无关。',
    tags: ['geometry', 'angle'],
  }),
  kp({
    code: 'angle-measure',
    title: '角的度量（量角器）',
    description: '认识量角器，掌握用量角器画角和量角的方法（°）。',
    prerequisites: ['angle-concept'],
    difficulty: 0.55,
    tags: ['geometry', 'angle'],
  }),
  kp({
    code: 'angle-classify',
    title: '角的分类（锐角/直角/钝角/平角/周角）',
    description: '认识各类角，理解它们之间的关系。',
    prerequisites: ['angle-concept'],
    difficulty: 0.4,
    tags: ['geometry', 'angle'],
  }),

  // 第四单元：三位数乘两位数
  kp({
    code: 'multiply-3by2',
    title: '三位数乘两位数',
    description: '笔算乘法：三位数乘两位数，包括因数中间有 0、末尾有 0 的特殊情况。',
    difficulty: 0.5,
    tags: ['arithmetic', 'multiply'],
  }),
  kp({
    code: 'multiply-quantity',
    title: '乘法的数量关系（单价×数量=总价 / 速度×时间=路程）',
    description: '理解生活中常见的两种乘法模型，能根据题意列式。',
    prerequisites: ['multiply-3by2'],
    difficulty: 0.45,
    tags: ['arithmetic', 'multiply', 'word-problem'],
  }),

  // 第五单元：平行四边形和梯形
  kp({
    code: 'shape-quadrilateral',
    title: '平行四边形和梯形的认识',
    description: '认识平行四边形和梯形的特征；理解"平行"和"垂线"。',
    prerequisites: ['angle-classify'],
    difficulty: 0.5,
    tags: ['geometry'],
  }),
  kp({
    code: 'shape-parallel-lines',
    title: '画垂线和平行线',
    description: '会用三角尺画垂线，会用直尺和三角尺画平行线。',
    prerequisites: ['shape-quadrilateral'],
    difficulty: 0.55,
    tags: ['geometry'],
  }),

  // 第六单元：除数是两位数的除法
  kp({
    code: 'divide-2digit',
    title: '除数是两位数的除法',
    description: '掌握除数是整十数的除法、四舍五入试商的方法。',
    difficulty: 0.55,
    tags: ['arithmetic', 'divide'],
  }),
  kp({
    code: 'divide-quantity',
    title: '除法的数量关系（总价÷单价=数量 等）',
    description: '运用除法解决实际问题的两种典型模型。',
    prerequisites: ['divide-2digit'],
    difficulty: 0.45,
    tags: ['arithmetic', 'divide', 'word-problem'],
  }),

  // 第七单元：条形统计图
  kp({
    code: 'stats-bar-chart',
    title: '条形统计图',
    description: '认识条形统计图（1 格代表多少个单位），能根据数据绘图。',
    tags: ['statistics'],
  }),
  kp({
    code: 'stats-read-data',
    title: '从统计图中读取信息',
    description: '能从条形图中读出最大、最小、相差多少等。',
    prerequisites: ['stats-bar-chart'],
    difficulty: 0.3,
    tags: ['statistics'],
  }),

  // 第八单元：数学广角（优化 / 烙饼 / 田忌赛马等）
  kp({
    code: 'strategy-optimize',
    title: '优化策略（烙饼/沏茶问题）',
    description: '通过合理安排顺序节省时间。',
    difficulty: 0.5,
    tags: ['strategy', 'logic'],
  }),
]
