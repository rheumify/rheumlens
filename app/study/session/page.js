'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import QuestionSession from '@/components/QuestionSession';

// Questions (quiz mode) are held back for the flip-cards-first launch; every
// session is forced to flip until this is flipped on.
const QUIZ_ENABLED = false;

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
