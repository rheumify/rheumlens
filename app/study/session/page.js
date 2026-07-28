'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import QuestionSession from '@/components/QuestionSession';

// Questions (quiz mode) are held back for the flip-cards-first launch; every
// session is forced to flip until this is flipped on.
const QUIZ_ENABLED = false;

function SessionInner() {
  const sp = useSearchParams();
  const mode = sp.get('mode') || 'random';
  const category = sp.get('category') || null;
  const imageType = sp.get('imageType') || null;
  const style = QUIZ_ENABLED && sp.get('style') === 'quiz' ? 'quiz' : 'flip';
  return (
    <div>
      <Link href="/study" className="btn ghost" style={{ paddingLeft: 0 }}>← Practice menu</Link>
      <div style={{ marginTop: 8 }}>
        <QuestionSession mode={mode} category={category} imageType={imageType} style={style} />
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
