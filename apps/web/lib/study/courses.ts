export type StudyCourseMeta = {
  slug: string
  title: string
  author: string
  module: string
  description: string
  tags: string[]
  readMinutes: number
}

export const STUDY_COURSES: StudyCourseMeta[] = [
  {
    slug: 'low-ticket-xisto',
    title: 'LOW TICKET',
    author: 'XISTO',
    module: 'Otimização e Escala de Ofertas Low Ticket',
    description:
      'Filosofia, métricas, regra dos 3 dias, pré-escala, escala vertical/horizontal e lateralização.',
    tags: ['Tráfego', 'Meta Ads', 'Low Ticket'],
    readMinutes: 12,
  },
]

export function getCourseBySlug(slug: string) {
  return STUDY_COURSES.find((c) => c.slug === slug)
}
