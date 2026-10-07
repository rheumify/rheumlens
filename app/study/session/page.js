'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import QuestionSession from '@/components/QuestionSession';

// Quiz mode is live (7 Oct 2026). Cards without a written question are filtered
// out of quiz decks inside QuestionSession, so a quiz set is only ever the
// subset of the library that carries one.
const QUIZ_ENABLED = true;

// A filter param may be repeated (?joint=Hip&joint=Knee) or comma-separated
// (?joint=Hip,Knee). Return a clean array either way.
function multi(sp, key) {
  return sp.getAll(key)
    .flatMap((v) => String(v).split(','))
    .map((s) => s.trim())
    .filter(Boolean);
}

function SessionInner() {
  const sp = useSearchParams();
  const mode = sp.get('mode') || 'random';
  const category = multi(sp, 'category');
  const imageType = multi(sp, 'imageType');
  const joint = multi(sp, 'joint');
  const style = QUIZ_ENABLED && sp.get('style') === 'quiz' ? 'quiz' : 'flip';
  return (
    <div>
      <Link href="/study" className="btn ghost" style={{ paddingLeft: 0 }}>← Practice menu</Link>
      <div style={{ marginTop: 8 }}>
        <QuestionSession mode={mode} category={category} imageType={imageType} joint={joint} style={style} />
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
