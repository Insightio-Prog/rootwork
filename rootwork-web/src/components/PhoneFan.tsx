import { useState } from "react";
import { displayName, yearsLabel, type Person } from "../data/people";
import { FanChart } from "./FanChart";
import { PersonAvatar } from "./PersonAvatar";

type PhoneFanProps = {
  people: Record<string, Person>;
  homePersonId: string | null;
  onOpenInFamily: (id: string) => void;
  onMakeHome?: (id: string) => void;
};

const noop = () => undefined;

/** The whole family at a glance. Tap a wedge for a small card; the card opens that person in Family. */
export function PhoneFan({ people, homePersonId, onOpenInFamily, onMakeHome }: PhoneFanProps) {
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [rootRequest, setRootRequest] = useState<{ id: string; n: number } | null>(null);
  const homeId = homePersonId && people[homePersonId] ? homePersonId : (Object.keys(people)[0] ?? null);
  const picked = pickedId ? people[pickedId] : undefined;

  if (!homeId) {
    return (
      <section className="phone-tree">
        <div className="phone-empty">
          <h3>No family tree here yet</h3>
        </div>
      </section>
    );
  }

  return (
    <section className="phone-fan">
      <div className="phone-fan-stage">
        <FanChart
          people={people}
          homeId={homeId}
          selectedId={pickedId}
          panelOpen={false}
          maxGenerations={5}
          readOnly
          compact
          rootRequest={rootRequest}
          onSelect={setPickedId}
          onAddParent={noop}
          onAddRelative={noop}
        />
      </div>
      {picked && (
        <div className="phone-fan-card" role="dialog" aria-label={displayName(picked)}>
          <PersonAvatar person={picked} className={`person-mono is-${picked.gender}`} />
          <div className="phone-fan-card-copy">
            <strong>{displayName(picked)}</strong>
            <span>
              {yearsLabel(picked)}
              {picked.birthPlace ? ` · ${picked.birthPlace}` : ""}
            </span>
          </div>
          <div className="phone-fan-card-actions">
            <button type="button" className="btn btn-primary" onClick={() => onOpenInFamily(picked.id)}>
              Open in Family
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setRootRequest({ id: picked.id, n: (rootRequest?.n ?? 0) + 1 });
                setPickedId(null);
              }}
            >
              Centre fan here
            </button>
            {onMakeHome && picked.id !== homeId && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  onMakeHome(picked.id);
                  setPickedId(null);
                  setRootRequest(null);
                }}
              >
                Make home person
              </button>
            )}
          </div>
          <button type="button" className="phone-fan-close" aria-label="Close" onClick={() => setPickedId(null)}>
            ×
          </button>
        </div>
      )}
    </section>
  );
}
