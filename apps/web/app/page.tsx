import { listHalls } from '@lenati/graph';

export const dynamic = 'force-dynamic';

const FALLBACK = [{ id: 'biology', name: 'Biology', blurb: 'The human body, cells and molecules.', open: true }];

async function halls() {
  try { return { halls: await listHalls(), live: true }; }
  catch { return { halls: FALLBACK, live: false }; }
}

export default async function Home() {
  const { halls: list, live } = await halls();
  return (
    <main className="wrap">
      <div className="brand">Lenati</div>
      <h1>An encyclopedia you can walk into.</h1>
      <p className="lede">
        The first hall is the human body. Turn it, open it, and zoom from the whole person into an organ, a tissue,
        a single cell, its nucleus and down to the histones that DNA wraps around.
      </p>
      <a className="cta" href="/atlas">Open the Body Atlas <span aria-hidden>→</span></a>
      <ul className="halls">
        {list.map(h => (
          <li key={h.id} className={`hall${h.open ? ' open' : ''}`}>
            {h.open ? (
              <a href="/atlas"><h2>{h.name}</h2><p>{h.blurb}</p><span className="tag">open</span></a>
            ) : (
              <><h2>{h.name}</h2><p>{h.blurb}</p><span className="tag">coming later</span></>
            )}
          </li>
        ))}
      </ul>
      {!live && <p className="note">The database is not connected, so this list is a placeholder.</p>}
    </main>
  );
}
