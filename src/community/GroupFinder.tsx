import { useState } from 'react';
import { useCommunity } from './CommunityContext';
import { Heading, Badge } from '../components';
import { CommunityStatus } from './ChurchPage';
import { recommendGroups, type FitPreferences } from './matching';
export function GroupFinder() {
  const c = useCommunity();
  const [prefs, setPrefs] = useState<FitPreferences>({
    household: '',
    kids: '',
    day: '',
    location: null,
    nearbyOnly: false,
  });
  const [locationError, setLocationError] = useState('');
  const [locating, setLocating] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const results = recommendGroups(
    c.directory,
    showAll
      ? {
          household: '',
          kids: '',
          day: '',
          location: prefs.location,
          nearbyOnly: false,
        }
      : prefs,
  );
  function locate() {
    setLocationError('');
    if (!navigator.geolocation) {
      setLocationError(
        'Location is unavailable. You can still explore groups by family needs and meeting day.',
      );
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPrefs((v) => ({
          ...v,
          location: {
            latitude: p.coords.latitude,
            longitude: p.coords.longitude,
          },
        }));
        setLocating(false);
      },
      () => {
        setLocationError(
          'Location was unavailable or permission was declined. No distances have been guessed.',
        );
        setLocating(false);
      },
      { timeout: 10000, maximumAge: 60000, enableHighAccuracy: false },
    );
  }
  return (
    <>
      <Heading
        title="Find your people."
        subtitle={`${c.church?.name ?? 'Your church'} · A few questions can help you find a place to begin.`}
      />
      <CommunityStatus />
      <div className="finder-layout">
        <section className="panel form-stack">
          <div className="eyebrow">YOUR NEXT STEP</div>
          <h2>What fits your season?</h2>
          <p>
            Every question is optional. Answers help sort suggestions and stay
            on this page; they do not determine who may join.
          </p>
          <label>
            Household / life stage
            <select
              aria-label="Household / life stage"
              value={prefs.household}
              onChange={(e) =>
                setPrefs({ ...prefs, household: e.target.value })
              }
            >
              <option value="">Prefer not to say</option>
              <option value="single">Single</option>
              <option value="married">Married</option>
              <option value="other">Another household situation</option>
            </select>
          </label>
          <label>
            Will children join you?
            <select
              aria-label="Will children join you?"
              value={prefs.kids}
              onChange={(e) => setPrefs({ ...prefs, kids: e.target.value })}
            >
              <option value="">Not specified</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>
          <label>
            Preferred meeting day
            <select
              aria-label="Preferred meeting day"
              value={prefs.day}
              onChange={(e) => setPrefs({ ...prefs, day: e.target.value })}
            >
              <option value="">Any day</option>
              {[
                'Sunday',
                'Monday',
                'Tuesday',
                'Wednesday',
                'Thursday',
                'Friday',
                'Saturday',
              ].map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
          <div className="subtle-box">
            <strong>Groups near you</strong>
            <p>
              Your location is used only in this browser and is not saved or
              sent to ScriptureSmart.
            </p>
            <button
              className="button secondary"
              disabled={locating}
              onClick={locate}
            >
              {locating ? 'Finding your location…' : 'Use my location'}
            </button>
            {prefs.location && (
              <>
                <p>
                  Location ready. Distances are approximate straight-line miles
                  to the group’s published neighborhood point.
                </p>
                <button
                  className="text-button"
                  onClick={() =>
                    setPrefs({ ...prefs, location: null, nearbyOnly: false })
                  }
                >
                  Clear my location
                </button>
              </>
            )}
            {locationError && <p role="status">{locationError}</p>}
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={prefs.nearbyOnly}
              disabled={!prefs.location}
              onChange={(e) =>
                setPrefs({ ...prefs, nearbyOnly: e.target.checked })
              }
            />
            Only show groups within about 5 miles
          </label>
          <small>
            Groups without a published map point show “Distance unknown.” They
            are excluded only when the five-mile filter is on.
          </small>
        </section>
        <section>
          <div className="section-heading">
            <h2>
              {showAll ? 'All listed groups' : 'Suggested places to begin'}
            </h2>
            <button
              className="text-button"
              onClick={() => setShowAll(!showAll)}
            >
              {showAll ? 'Use my preferences' : 'Show all groups'}
            </button>
          </div>
          {results.map(({ group: g, distance, reasons }) => (
            <article className="panel group-match" key={g.id}>
              <Badge>
                {g.accepting
                  ? 'Welcoming new people'
                  : 'Contact leader about availability'}
              </Badge>
              <h2>{g.name}</h2>
              <p>{g.description}</p>
              <div className="group-facts">
                <span>{g.rhythm || 'Schedule to be confirmed'}</span>
                <span>{g.neighborhood || 'Neighborhood not listed'}</span>
                <span>
                  {distance === null
                    ? 'Distance unknown'
                    : `About ${distance.toFixed(1)} miles · straight-line`}
                </span>
              </div>
              <ul className="match-reasons">
                {reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
              <div className="leader-contact">
                <strong>{g.leader_name || 'Group leader'}</strong>
                {g.preferred_contact && (
                  <p>
                    Preferred contact:{' '}
                    {g.preferred_contact === 'text'
                      ? 'Text message'
                      : g.preferred_contact === 'phone'
                        ? 'Phone call'
                        : 'Email'}
                  </p>
                )}
                <div className="editor-toolbar">
                  {g.email && (
                    <a className="button secondary" href={`mailto:${g.email}`}>
                      Email {g.leader_name || 'leader'}
                    </a>
                  )}
                  {g.phone && (
                    <a
                      className="button secondary"
                      href={`${g.preferred_contact === 'text' ? 'sms' : 'tel'}:${g.phone.replace(/[^+\d]/g, '')}`}
                    >
                      {g.preferred_contact === 'text' ? 'Text' : 'Call'}{' '}
                      {g.phone}
                    </a>
                  )}
                </div>
                {!g.email && !g.phone && (
                  <p>
                    Contact details haven’t been published. Ask your church
                    office to connect you with this leader.
                  </p>
                )}
              </div>
            </article>
          ))}
          {!results.length && (
            <div className="empty">
              <h2>No listed matches yet.</h2>
              <p>
                Try all groups or ask your church administrator to help you
                connect. A group may need to publish its neighborhood and
                contact details first.
              </p>
              <a className="button secondary" href="#church">
                Open church workspace
              </a>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
