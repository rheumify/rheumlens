'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { getStats, getSeenIds, mergeServerRows } from '@/lib/progress';

const PREVIEW = process.env.NEXT_PUBLIC_SHOW_DRAFTS === 'true';
// Quiz mode is live (7 Oct 2026).
const QUIZ_ENABLED = true;

// A card appears in a quiz only if "Question Live" is ticked (Ali has reviewed the
// question) and it carries a keyed answer plus all four options. Every count on this
// page is taken against the deck for the chosen style.
function hasQuestion(c) {
  return Boolean(
    c.questionLive &&
    c.correct && c.options && c.options.A && c.options.B && c.options.C && c.options.D
  );
}

// Order the joint chips anatomically (head-to-toe) rather than alphabetically.
const JOINT_ORDER = [
  'TMJ', 'Cervical spine', 'Thoracic spine', 'Lumbar spine', 'Sacroiliac/Pelvis',
  'Shoulder', 'Elbow', 'Wrist', 'Hand', 'Hip', 'Knee', 'Ankle', 'Foot',
  'Multiple', 'Other',
];

const DIMS = [
  { key: 'category', label: 'Topic' },
  { key: 'imageType', label: 'Image type' },
  { key: 'joint', label: 'Joint / region' },
];

export default function StudyHub() {
  const [cards, setCards] = useState(null); // full published deck (used for facet counts)
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [style, setStyle] = useState('flip');
  const [signedIn, setSignedIn] = useState(false);
  const [seenIds, setSeenIds] = useState([]);
  const [sel, setSel] = useState({ category: [], imageType: [], joint: [] });

  useEffect(() => {
    // Let a link choose the style, so the home page can drop someone straight
    // into questions: /study?style=quiz. Anything else stays on flip cards.
    const qs = new URLSearchParams(window.location.search);
    if (QUIZ_ENABLED && qs.get('style') === 'quiz') setStyle('quiz');

    setStats(getStats());
    setSeenIds(getSeenIds());
    const url = new URL('/api/questions', window.location.origin);
    if (PREVIEW) url.searchParams.set('preview', 'true');
    fetch(url)
      .then((r) => r.json())
      .then((d) => { setCards(d.questions || []); if (d.error) setError(d.error); })
      .catch((e) => setError(e.message));
    fetch('/api/progress')
      .then((r) => r.json())
      .then((d) => setSignedIn(!!d.signedIn))
      .catch(() => {});
    // Pull saved progress for a signed-in account and fold it into the local
    // store, so these counts describe the person rather than the browser.
    fetch('/api/progress/record')
      .then((r) => r.json())
      .then((d) => { if (d.signedIn && d.rows) mergeServerRows(d.rows); })
      .catch(() => {})
      .finally(() => { setStats(getStats()); setSeenIds(getSeenIds()); });
  }, []);
