import Link from 'next/link';

export default function Home() {
  return (
    <div>
      <section className="hero">
        <span className="pill">Free · No ads · No sign-up required</span>
        <h1>Learn the images, not just the words.</h1>
        <p>
          RheumLens is a free, image-based rheumatology study tool. Flip through real clinical
          images — crystals under polarized light, rashes, radiographs, ultrasound, and more —
          reveal the finding, and train your eye. Built on the ACR Rheumatology Image Library.
        </p>
        <div className="btn-row" style={{ justifyContent: 'center' }}>
          <Link href="/study/session?mode=random&style=flip" className="btn">Start with flip cards →</Link>
          <Link href="/study" className="btn secondary">Browse by topic</Link>
        </div>
      </section>

      <section className="feature-grid">
        <div className="feature">
          <h3>Flip cards first</h3>
          <p>See the image, reveal the finding and teaching point, move on. Fast recognition review — no scoring, no pressure.</p>
        </div>
        <div className="feature">
          <h3>Real clinical images</h3>
          <p>Every card is anchored to an actual image — the kind tested on the boards — so you learn what clinches the diagnosis.</p>
        </div>
        <div className="feature">
          <h3>Use it your way</h3>
          <p>Practice anonymously — nothing required. Or sign in (optional) to save your progress across devices.</p>
        </div>
        <div className="feature">
          <h3>Board-style questions coming soon</h3>
          <p>Scored, image-based questions with distractors and explanations are on the way. Flip cards are live now.</p>
        </div>
      </section>
    </div>
  );
}
