/**
 * 端到端冒烟测试：用一个真实流程验证整个引擎。
 * 跑法：pnpm --filter @xuexi/api run smoke
 *
 * 用 node:fetch 内置发起 HTTP 请求，避免依赖。
 */

const BASE = process.env.XUEXI_API_URL ?? 'http://localhost:4310'

async function http(method: string, path: string, body?: unknown) {
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['content-type'] = 'application/json'
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    return { __raw: text, status: res.status }
  }
}

function section(title: string) {
  console.log('\n' + '='.repeat(60))
  console.log('  ' + title)
  console.log('='.repeat(60))
}

async function main() {
  section('1) 创建小学生用户 + 创建软考用户')
  const child = await http('POST', '/api/users', {
    displayName: '小明',
    role: 'primary_school',
    meta: { grade: 4 },
  })
  const adult = await http('POST', '/api/users', {
    displayName: '我',
    role: 'ruankao',
    meta: { ruankaoLevel: 'junior', targetExamDate: '2026-11-07' },
  })
  const cuid = child.id
  const auid = adult.id
  console.log('小学生 userId =', cuid)
  console.log('软考   userId =', auid)

  section('2) 知识图谱 + 拓扑排序')
  const ps = await http('GET', '/api/graph/primary_school')
  const topo = await http('GET', '/api/graph/primary_school/topological')
  const rk = await http('GET', '/api/graph/ruankao')
  console.log(`小学知识点: ${ps.points.length}, 软考知识点: ${rk.points.length}`)
  console.log('小学拓扑序:')
  topo.order.slice(0, 6).forEach((p: any, i: number) =>
    console.log(`   ${i + 1}. ${p.title} (前置=${p.prerequisites.length})`)
  )

  section('3) 模拟证据：学生在"乘法的数量关系"上反复栽跟头')
  const weakKP = 'primary_school:primary-math-grade4-up:multiply-quantity'
  for (let i = 0; i < 3; i++) {
    await http('POST', '/api/evidence', {
      userId: cuid,
      knowledgePointId: weakKP,
      dimension: 'apply',
      correct: false,
      score: 0.2,
      feedback: '不理解单价×数量的关系',
    })
  }
  await http('POST', '/api/evidence', {
    userId: cuid,
    knowledgePointId: 'primary_school:primary-math-grade4-up:multiply-3by2',
    dimension: 'apply',
    correct: false,
    score: 0.3,
  })

  section('4) 跑薄弱点诊断')
  const diag = await http('POST', `/api/weakness/run/${cuid}`)
  if (diag.error) {
    console.log('诊断错误:', diag)
  } else {
    console.log('生成时间:', diag.report.generatedAt)
    console.log('摘要:', diag.report.summary)
    console.log('薄弱点:')
    diag.report.weakPoints.forEach((w: any) =>
      console.log(`   • ${w.knowledgePoint.title}  mastery=${(w.mastery * 100).toFixed(0)}%  root=${w.rootCause}`)
    )
    console.log('发现的模式:')
    diag.report.patterns.forEach((p: any) => console.log(`   • ${p.title}: ${p.description}`))
  }

  section('5) 生成学习计划')
  const plan = await http('POST', '/api/plans', {
    userId: cuid,
    goal: '两周把四年级乘法和角攻下来',
    dailyMinutes: 40,
    totalDays: 14,
  })
  console.log(`计划响应: ${JSON.stringify(plan).slice(0, 300)}`)
  console.log(`计划标题: ${plan.title}`)
  console.log(`总天数: ${plan.days.length} 天`)
  console.log('今日计划:')
  plan.days[0]?.tasks.forEach((t: any, i: number) =>
    console.log(`   ${i + 1}. [${t.kind}] ${t.title} (${t.estimateMinutes} 分钟)`)
  )

  section('6) 知识串联：以"分数乘法"为聚焦点')
  const links = await http(
    'GET',
    `/api/links/${cuid}/primary_school:primary-math-grade4-up:multiply-quantity`
  )
  console.log(`发现 ${links.connections.length} 条串联: `)
  links.connections.slice(0, 4).forEach((c: any) =>
    console.log(`   [${c.kind}] ${c.description}`)
  )

  section('7) AI 对话（local-stub 模式，配置 XUEXI_AI_API_KEY 即可启用真模型）')
  const chat = await http('POST', '/api/chat', {
    userId: cuid,
    knowledgePointId: weakKP,
    state: 'explaining',
    message: '我不懂单价×数量是什么意思，能举个例子吗？',
  })
  console.log('sessionId:', chat.sessionId)
  console.log('AI 回复：')
  console.log('  ' + (chat.message?.content ?? '').slice(0, 500))

  section('8) 软考用户：给自己出一道题并提交答案')
  const osSync = 'ruankao:ruankao-softmid-junior:os-sync'
  await http('POST', '/api/evidence', {
    userId: auid,
    knowledgePointId: osSync,
    dimension: 'explain',
    correct: false,
    score: 0.4,
    feedback: '生产者-消费者的信号量顺序总搞混',
  })
  await http('POST', '/api/evidence', {
    userId: auid,
    knowledgePointId: osSync,
    dimension: 'apply',
    correct: true,
    score: 0.6,
  })
  const adultDiag = await http('POST', `/api/weakness/run/${auid}`)
  console.log('软考摘要:', adultDiag.report.summary)
  console.log('软考薄弱点:')
  adultDiag.report.weakPoints.slice(0, 3).forEach((w: any) =>
    console.log(`   • ${w.knowledgePoint.title} master=${(w.mastery * 100).toFixed(0)}%`)
  )

  section('9) 仪表盘')
  const dash = await http('GET', `/api/dashboard/${cuid}`)
  console.log(JSON.stringify(dash, null, 2))

  console.log('\n✅ 冒烟测试完成')
}

main().catch((e) => {
  console.error('测试失败:', e)
  process.exit(1)
})
