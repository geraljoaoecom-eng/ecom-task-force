'use client'

import { notFound } from 'next/navigation'
import AdminGuard from '../../../components/AdminGuard'
import { LowTicketXistoContent, StudyCourseLayout } from '@/components/StudyCourseReader'
import { getCourseBySlug } from '@/lib/study/courses'

const CONTENT: Record<string, () => JSX.Element> = {
  'low-ticket-xisto': LowTicketXistoContent,
}

export default function StudyCoursePage({ params }: { params: { slug: string } }) {
  const course = getCourseBySlug(params.slug)
  const Content = CONTENT[params.slug]

  if (!course || !Content) {
    notFound()
    return null
  }

  return (
    <AdminGuard>
      <StudyCourseLayout course={course}>
        <Content />
      </StudyCourseLayout>
    </AdminGuard>
  )
}
