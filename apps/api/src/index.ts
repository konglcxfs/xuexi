import Fastify from 'fastify'
import cors from '@fastify/cors'
import {
  userRoutes,
  graphRoutes,
  masteryRoutes,
  weaknessRoutes,
  planRoutes,
  chatRoutes,
  linkerRoutes,
  memoryRoutes,
  dashboardRoutes,
} from './routes'
import {
  subjectRoutes,
  methodRoutes,
  pedagogyRoutes,
  sourceRoutes,
  profileRoutes,
  forestRoutes,
  aiProviderRoutes,
  subjectEnrollmentRoutes,
  curriculumRoutes,
  goalRoutes,
  dailyRoutes,
  familyRoutes,
} from './extension-routes'
import { seedKnowledgeBase } from './db/seed'
import { defaultSourceRegistry, PrimaryMathG4Adapter } from '@xuexi/learning-engine'

async function bootstrap() {
  // 确保知识库已写入
  seedKnowledgeBase()

  // 注册内置 SourceAdapter —— 小学数学四年级同步练习
  if (!defaultSourceRegistry.get('primary-math-g4-bank')) {
    defaultSourceRegistry.register(new PrimaryMathG4Adapter())
  }

  const app = Fastify({ logger: { level: 'info' } })
  await app.register(cors, { origin: true })

  // 健康检查
  app.get('/health', async () => ({
    status: 'ok',
    time: new Date().toISOString(),
    ai: engineInfo(),
  }))

  // 业务路由
  app.register(userRoutes, { prefix: '/api' })
  app.register(graphRoutes, { prefix: '/api' })
  app.register(masteryRoutes, { prefix: '/api' })
  app.register(weaknessRoutes, { prefix: '/api' })
  app.register(planRoutes, { prefix: '/api' })
  app.register(chatRoutes, { prefix: '/api' })
  app.register(linkerRoutes, { prefix: '/api' })
  app.register(memoryRoutes, { prefix: '/api' })
  app.register(dashboardRoutes, { prefix: '/api' })

  // 8 大体系扩展路由
  app.register(subjectRoutes, { prefix: '/api' })
  app.register(methodRoutes, { prefix: '/api' })
  app.register(pedagogyRoutes, { prefix: '/api' })
  app.register(sourceRoutes, { prefix: '/api' })
  app.register(profileRoutes, { prefix: '/api' })
  app.register(forestRoutes, { prefix: '/api' })
  app.register(aiProviderRoutes, { prefix: '/api' })
  app.register(subjectEnrollmentRoutes, { prefix: '/api' })
  app.register(curriculumRoutes, { prefix: '/api' })
  app.register(goalRoutes, { prefix: '/api' })
  app.register(dailyRoutes, { prefix: '/api' })
  app.register(familyRoutes, { prefix: '/api' })

  const port = Number(process.env.XUEXI_API_PORT ?? 4310)
  await app.listen({ port, host: '0.0.0.0' })
  // eslint-disable-next-line no-console
  console.log(`🚀 xuexi api listening on http://localhost:${port}`)
}

function engineInfo() {
  return process.env.XUEXI_AI_API_KEY
    ? `connected:${process.env.XUEXI_AI_BASE_URL ?? 'deepseek'}`
    : 'local-stub'
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('failed to bootstrap', err)
  process.exit(1)
})
