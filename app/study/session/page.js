'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import QuestionSession from '@/components/QuestionSession';

function SessionInner() {
  const sp = useSearchParams();
  const mode = sp.get('mode') || 'random';
  const category = sp.get('category') || null;
  const style = sp.get('style') === 'flip' ? 'flip' : 'quiz';
  return (
    <div>
      <Link href="/study" className="btn ghost" style={{ paddingLeft: 0 }}>← Practice menu</Link>
      <div style={{ marginTop: 8 }}>
        <QuestionSession mode={mode} category={category} style={style} />
      </div>
    </div>
  );
}

export default function SessionPage() {
  return (
    <Suspense fallback={<p className="center muted">Loading…</p>}>
      <SessionInner />
    </Suspense>
  );
}
