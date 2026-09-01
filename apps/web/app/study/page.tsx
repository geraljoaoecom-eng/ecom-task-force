'use client'

import Link from 'next/link'
import { GraduationCap, BookOpen, Clock, ChevronRight } from 'lucide-react'
import AdminGuard from '../../components/AdminGuard'
import { STUDY_COURSES } from '@/lib/study/courses'

export default function StudyPage() {
  return (
    <AdminGuard>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <h1
          style={{
            color: '#F5D26C',
            fontSize: '1.75rem',
            fontWeight: 700,
            margin: '0 0 0.35rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <GraduationCap size={28} /> Study
        </h1>
        <p style={{ color: '#94a3b8', margin: '0 0 2rem', fontSize: '0.9rem' }}>
          Resumos de cursos e frameworks para consulta rápida.
        </p>

        <section>
          <h2
            style={{
              color: '#E8EDF2',
              fontSize: '1rem',
              fontWeight: 600,
              margin: '0 0 1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <BookOpen size={18} color="#F5D26C" />
            Resumo de cursos
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {STUDY_COURSES.map((course) => (
              <Link
                key={course.slug}
                href={`/study/${course.slug}`}
                style={{
                  display: 'block',
                  textDecoration: 'none',
                  background: '#141823',
                  border: '1px solid rgba(245, 210, 108, 0.22)',
                  borderRadius: '0.75rem',
                  padding: '1.125rem 1.25rem',
                  transition: 'border-color 0.2s, background 0.2s',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(245, 210, 108, 0.45)'
                  e.currentTarget.style.background = 'rgba(245, 210, 108, 0.04)'
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(245, 210, 108, 0.22)'
                  e.currentTarget.style.background = '#141823'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginBottom: '0.5rem' }}>
                      {course.tags.map((tag) => (
                        <span
                          key={tag}
                          style={{
                            fontSize: '0.625rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            padding: '0.2rem 0.45rem',
                            borderRadius: '0.25rem',
                            background: 'rgba(245, 210, 108, 0.1)',
                            color: '#F5D26C',
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div style={{ color: '#F5D26C', fontWeight: 700, fontSize: '1.0625rem', marginBottom: '0.25rem' }}>
                      {course.title}
                      <span style={{ color: '#64748b', fontWeight: 500, fontSize: '0.875rem', marginLeft: '0.5rem' }}>
                        {course.author}
                      </span>
                    </div>
                    <div style={{ color: '#E8EDF2', fontSize: '0.875rem', marginBottom: '0.375rem', fontWeight: 500 }}>
                      {course.module}
                    </div>
                    <p style={{ color: '#94a3b8', fontSize: '0.8125rem', margin: 0, lineHeight: 1.5 }}>
                      {course.description}
                    </p>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        marginTop: '0.625rem',
                        color: '#64748b',
                        fontSize: '0.75rem',
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Clock size={12} /> ~{course.readMinutes} min
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={20} color="#64748b" style={{ flexShrink: 0, marginTop: '0.25rem' }} />
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </AdminGuard>
  )
}
