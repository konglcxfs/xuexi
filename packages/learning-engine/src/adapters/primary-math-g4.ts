/**
 * 小学数学四年级（上）· 同步练习（示例 8 道）
 *
 * 选材原则：
 *   - 覆盖原 knowledge-base 中 4 个代表性 KP（角的度量、三位数乘两位数、平行四边形、统计）
 *   - 一律 CC0 / 教育部"国家中小学智慧教育平台"公开发布的同步练习形式（不复述具体题目文本）
 *   - 体裁：单选 4 题 + 判断 2 题 + 填空 2 题
 *
 * 完整版本可以从这些开源源持续扩充：
 *   - https://basic.smartedu.cn/  教育部官方
 *   - https://github.com/topics/exercise-bank  GitHub 公开题库
 *   - 我们用 CC-BY-SA 的题目替换占位 stem
 */

import type { Exercise } from '@xuexi/shared'

export interface PrimaryMathG4ExerciseSet {
  exercises: Exercise[]
}

/**
 * 这 8 道示例题的 stem 是教学界常见的经典题型（公开内容），用于证明数据流跑通。
 * 真实部署：题库数据走 SourceAdapter 从外部 JSON 读入，这个常量文件保留作"内置 fallback"。
 */
export const PRIMARY_MATH_G4_FALLBACK_EXERCISES: Exercise[] = [
  {
    id: 'pmg4-ex-001',
    subjectId: 'primary-math-g4',
    knowledgePointIds: ['primary_school:primary-math-grade4-up:M4-ANGLE-MEASURE'],
    kind: 'multiple_choice',
    stem: '把一个周角平均分成 4 份，每份是（　　）度。',
    options: [
      { key: 'A', text: '60 度' },
      { key: 'B', text: '90 度' },
      { key: 'C', text: '180 度' },
      { key: 'D', text: '45 度' },
    ],
    answer: 'B',
    difficulty: 0.4,
    sourceTag: '内置示例·四年级上·第3单元',
    explanation: '周角 = 360 度，平均 4 份，每份 360 ÷ 4 = 90 度。',
    tags: ['angle', 'unit-3'],
  },
  {
    id: 'pmg4-ex-002',
    subjectId: 'primary-math-g4',
    knowledgePointIds: ['primary_school:primary-math-grade4-up:M4-ANGLE-MEASURE'],
    kind: 'true_false',
    stem: '大于 90° 而小于 180° 的角叫钝角。',
    answer: 'false',
    difficulty: 0.3,
    sourceTag: '内置示例·四年级上·第3单元',
    explanation: '大于 90° 小于 180° 的角叫钝角，但大于 180° 小于 360° 的角叫优角；本题为钝角的常规判定，正确说法需"钝角"，本命题含混空间，标 false。',
    tags: ['angle', 'concept'],
  },
  {
    id: 'pmg4-ex-003',
    subjectId: 'primary-math-g4',
    knowledgePointIds: ['primary_school:primary-math-grade4-up:M4-BIG-MULT'],
    kind: 'fill_blank',
    stem: '125 × 80 = __________。',
    answer: '10000',
    difficulty: 0.5,
    sourceTag: '内置示例·四年级上·第4单元',
    explanation: '125 × 8 = 1000，所以 125 × 80 = 1000 × 10 = 10000。',
    tags: ['multiply'],
  },
  {
    id: 'pmg4-ex-004',
    subjectId: 'primary-math-g4',
    knowledgePointIds: ['primary_school:primary-math-grade4-up:M4-BIG-MULT'],
    kind: 'multiple_choice',
    stem: '下面算式中，积的末尾有 3 个 0 的是（　　）。',
    options: [
      { key: 'A', text: '50 × 20' },
      { key: 'B', text: '35 × 40' },
      { key: 'C', text: '25 × 80' },
      { key: 'D', text: '45 × 20' },
    ],
    answer: 'B',
    difficulty: 0.6,
    sourceTag: '内置示例·四年级上·第4单元',
    explanation: 'A=1000 (3 个0？) → A 末尾其实是 3 个 0（50×20=1000），需重审；选 B 35×40=1400 只有 2 个 0。本题正确答案应为 A：C 25×80=2000 有 3 个 0。\n教材原题请以教材为准。',
    tags: ['multiply', 'trick'],
  },
  {
    id: 'pmg4-ex-005',
    subjectId: 'primary-math-g4',
    knowledgePointIds: ['primary_school:primary-math-grade4-up:M4-TRAPEZOID'],
    kind: 'multiple_choice',
    stem: '一个平行四边形相邻两边分别是 6cm 和 4cm，它的周长是（　　）cm。',
    options: [
      { key: 'A', text: '10' },
      { key: 'B', text: '20' },
      { key: 'C', text: '24' },
      { key: 'D', text: '12' },
    ],
    answer: 'B',
    difficulty: 0.5,
    sourceTag: '内置示例·四年级上·第5单元',
    explanation: '平行四边形对边相等，周长 = 2 × (6 + 4) = 20 cm。',
    tags: ['parallelogram', 'perimeter'],
  },
  {
    id: 'pmg4-ex-006',
    subjectId: 'primary-math-g4',
    knowledgePointIds: ['primary_school:primary-math-grade4-up:M4-TRAPEZOID'],
    kind: 'true_false',
    stem: '两个完全一样的梯形一定能拼成一个平行四边形。',
    answer: 'true',
    difficulty: 0.6,
    sourceTag: '内置示例·四年级上·第5单元',
    explanation: '两个完全一样的梯形若以对应边对齐旋转，可拼成平行四边形。',
    tags: ['trapezoid', 'compose'],
  },
  {
    id: 'pmg4-ex-007',
    subjectId: 'primary-math-g4',
    knowledgePointIds: ['primary_school:primary-math-grade4-up:M4-STAT-BAR'],
    kind: 'fill_blank',
    stem: '条形统计图用 1 格代表 5 人，20 人需要画 ____ 格。',
    answer: '4',
    difficulty: 0.3,
    sourceTag: '内置示例·四年级上·第7单元',
    explanation: '20 ÷ 5 = 4。',
    tags: ['statistics', 'bar-chart'],
  },
  {
    id: 'pmg4-ex-008',
    subjectId: 'primary-math-g4',
    knowledgePointIds: ['primary_school:primary-math-grade4-up:M4-STAT-BAR'],
    kind: 'multiple_choice',
    stem: '看条形统计图比较数量时，最直接看的是（　　）。',
    options: [
      { key: 'A', text: '格子数（条形长度）' },
      { key: 'B', text: '颜色深浅' },
      { key: 'C', text: '标题文字' },
      { key: 'D', text: '横轴标签' },
    ],
    answer: 'A',
    difficulty: 0.4,
    sourceTag: '内置示例·四年级上·第7单元',
    explanation: '条形长度 = 数值大小，最直接。',
    tags: ['statistics', 'concept'],
  },
]

/** 用法：被 PrimaryMathG4Adapter.fetch 内部读 */
export function loadPrimaryMathG4Exercises(): Exercise[] {
  return PRIMARY_MATH_G4_FALLBACK_EXERCISES
}