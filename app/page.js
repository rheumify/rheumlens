import Link from 'next/link';

export default function Home() {
  return (
    <div>
      <section className="hero">
        <span className="pill">Free · No ads · No sign-up required</span>
        <h1>Learn the images, not just the words.</h1>
        <p>
          RheumLens is a free, image-based rheumatology question bank. Practice recognizing the
          real clinical images that show up on the boards — crystals under polarized light, rashes,
          radiographs, ultrasound, and more — built on the ACR Rheumatology Image Library.
        </p>
        <div className="btn-row" style={{ justifyContent: 'center' }}>
          <Link href="/study" className="btn">Start practicing →</Link>
        </div>
      </section>

      <section className="feature-grid">
        <div className="feature">
          <h3>Image-first questions</h3>
          <p>Every question is anchored to a real clinical image. See it, name it, learn what clinches it.</p>
        </div>
        <div className="feature">
          <h3>Board-style reasoning</h3>
          <p>Plausible distractors and explanations that tell you exactly what to look for and why.</p>
        </div>
        <div className="feature">
          <h3>Use it your way</h3>
          <p>Practice anonymously — nothing required. Or sign in (optional) to save your progress across devices.</p>
        </div>
        <div className="feature">
          <h3>Truly free</h3>
          <p>No paywall, no ads. An educational resource, full stop.</p>
        </div>
      </section>
    </div>
  );
}
