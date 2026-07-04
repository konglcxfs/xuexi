import type { KnowledgePoint } from '@xuexi/shared'

const GRAPH = 'ruankao-softmid-junior'

/**
 * 软考中级 - 软件设计师 知识图谱骨架。
 * 真实备考时，引擎会从你的笔记/教材/题库提取更细的节点。
 * 这里先把大纲级别的骨架放进来，确保 plan / weakness / connection 都能跑。
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
    id: `ruankao:${GRAPH}:${args.code}`,
    role: 'ruankao',
    graph: GRAPH,
    code: args.code,
    title: args.title,
    description: args.description,
    prerequisites: (args.prerequisites ?? []).map((c) => `ruankao:${GRAPH}:${c}`),
    difficulty: args.difficulty ?? 0.5,
    tags: args.tags ?? [],
    mastery: { explain: 0.75, apply: 0.7, extend: 0.5 },
  }
}

export const RUANKAO_SOFTMID: KnowledgePoint[] = [
  // 计算机组成与体系结构
  kp({ code: 'cpu-basics', title: 'CPU 结构与工作原理', description: '运算器、控制器、寄存器组、指令周期。', tags: ['hardware', 'cpu'] }),
  kp({
    code: 'storage-hierarchy',
    title: '存储系统层次结构',
    description: '寄存器、Cache、主存、辅存的速度/容量权衡，局部性原理。',
    prerequisites: ['cpu-basics'],
    difficulty: 0.55,
    tags: ['hardware', 'memory'],
  }),
  kp({
    code: 'bus-io',
    title: '总线与 I/O 系统',
    description: '系统总线、I/O 控制方式（程序查询/中断/DMA）。',
    prerequisites: ['cpu-basics'],
    tags: ['hardware'],
  }),

  // 操作系统
  kp({ code: 'os-process', title: '进程与线程', description: '进程状态、线程模型、调度算法。', tags: ['os', 'process'] }),
  kp({
    code: 'os-sync',
    title: '进程同步与互斥',
    description: '临界区、信号量、管程、经典同步问题（生产者-消费者、读者-写者）。',
    prerequisites: ['os-process'],
    difficulty: 0.7,
    tags: ['os', 'process'],
  }),
  kp({ code: 'os-memory', title: '内存管理', description: '分页、分段、虚拟存储、页面置换算法。', tags: ['os', 'memory'] }),
  kp({ code: 'os-fs', title: '文件系统', description: '文件组织方式、目录结构、空闲空间管理。', tags: ['os', 'fs'] }),

  // 数据结构与算法
  kp({ code: 'ds-array', title: '数组与链表', description: '顺序表、链表的存储与操作复杂度。', tags: ['ds'] }),
  kp({ code: 'ds-stack-queue', title: '栈与队列', description: '顺序栈/链栈、循环队列。', prerequisites: ['ds-array'], tags: ['ds'] }),
  kp({ code: 'ds-tree', title: '树与二叉树', description: '二叉树的遍历、线索二叉树。', tags: ['ds', 'tree'] }),
  kp({
    code: 'ds-bst',
    title: '二叉排序树 / 平衡二叉树',
    description: 'BST、AVL 树的旋转操作。',
    prerequisites: ['ds-tree'],
    difficulty: 0.65,
    tags: ['ds', 'tree'],
  }),
  kp({ code: 'ds-graph', title: '图的基础', description: '图的存储、DFS/BFS。', prerequisites: ['ds-tree'], tags: ['ds', 'graph'] }),
  kp({
    code: 'ds-sort',
    title: '排序算法',
    description: '插入/希尔/堆/快速/归并排序的复杂度与稳定性。',
    prerequisites: ['ds-array'],
    difficulty: 0.5,
    tags: ['ds', 'sort'],
  }),
  kp({
    code: 'algo-dp',
    title: '动态规划',
    description: '最优子结构、重叠子问题、状态转移方程。',
    difficulty: 0.8,
    tags: ['algorithm', 'dp'],
  }),
  kp({
    code: 'algo-greedy',
    title: '贪心算法',
    description: '贪心选择性质、与 DP 的区别。',
    difficulty: 0.65,
    tags: ['algorithm'],
  }),

  // 软件工程
  kp({ code: 'se-process', title: '软件开发过程模型', description: '瀑布、增量、迭代、敏捷。', tags: ['se'] }),
  kp({ code: 'se-requirement', title: '需求工程', description: '需求获取、分析、规格说明、验证。', tags: ['se'] }),
  kp({ code: 'se-design', title: '软件设计（架构 / 详细）', description: '模块化、耦合内聚、设计模式。', difficulty: 0.6, tags: ['se'] }),
  kp({ code: 'se-test', title: '软件测试', description: '单元/集成/系统测试，黑盒/白盒，测试用例设计。', tags: ['se', 'test'] }),
  kp({ code: 'se-maintain', title: '软件维护与演化', description: '维护类型、CMM、CMMI。', tags: ['se', 'maintain'] }),

  // 数据库
  kp({ code: 'db-relational', title: '关系模型与关系代数', description: '关系、元组、域；选择、投影、连接、除。', tags: ['db'] }),
  kp({ code: 'db-sql', title: 'SQL 与查询优化', description: 'SELECT/JOIN/子查询/索引/执行计划。', difficulty: 0.6, tags: ['db', 'sql'] }),
  kp({ code: 'db-normalize', title: '范式理论（1NF/2NF/3NF/BCNF）', description: '函数依赖、键、范式判定。', difficulty: 0.65, tags: ['db'] }),

  // 计算机网络
  kp({ code: 'net-osi', title: 'OSI / TCP-IP 分层模型', description: '七层/四层模型的对应关系。', tags: ['net'] }),
  kp({ code: 'net-http', title: 'HTTP 与 HTTPS', description: '请求方法、状态码、TLS 握手。', difficulty: 0.5, tags: ['net', 'web'] }),

  // 面向对象
  kp({ code: 'oo-basics', title: '面向对象基础', description: '封装、继承、多态。', tags: ['oop'] }),
  kp({ code: 'oo-uml', title: 'UML 建模', description: '类图、用例图、时序图、活动图。', difficulty: 0.55, tags: ['oop', 'uml'] }),
  kp({ code: 'oo-pattern', title: '设计模式', description: '创建型/结构型/行为型 23 种模式。', difficulty: 0.75, tags: ['oop', 'pattern'] }),
]
