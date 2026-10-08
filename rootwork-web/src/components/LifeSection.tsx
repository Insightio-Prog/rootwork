import { useState } from "react";
import {
  childrenOf,
  closeRelativeLabel,
  displayName,
  notableEventsOf,
  resolvedMarriage,
  spousesOf,
  type Person,
} from "../data/people";
import { AddressDialog } from "./AddressDialog";
import { MarriageDialog } from "./MarriageDialog";
import { NotableEventDialog } from "./NotableEventDialog";
import { IconPencil } from "../icons";

type LifeSectionProps = {
  people: Record<string, Person>;
  person: Person;
  onEditPerson: (id: string) => void;
  onAddResidence: (place: string, from: string, to: string) => void;
  onUpdateResidence: (residenceId: string, place: string, from: string, to: string) => void;
  onRemoveResidence: (residenceId: string) => void;
  onAddNotableEvent: (title: string, date: string, detail: string) => void | Promise<void>;
  onUpdateNotableEvent: (eventId: string, title: string, date: string, detail: string) => void | Promise<void>;
  onRemoveNotableEvent: (eventId: string) => void;
  onSetMarriageDetails: (spouseId: string, date: string, place: string) => void;
};

type LifeDialog =
  | { type: "address"; residenceId?: string }
  | { type: "notable"; eventId?: string }
  | { type: "marriage"; spouseId: string }
  | null;

function residenceYears(from: string, to: string): string {
  if (from && to) return `${from} – ${to}`;
  if (from) return `from ${from}`;
  if (to) return `until ${to}`;
  return "Years unknown";
}

export function LifeEditButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="life-edit-btn" aria-label={label} title={label} onClick={onClick}>
      <IconPencil size={14} />
    </button>
  );
}

export function LifeSection({
  people,
  person,
  onEditPerson,
  onAddResidence,
  onUpdateResidence,
  onRemoveResidence,
  onAddNotableEvent,
  onUpdateNotableEvent,
  onRemoveNotableEvent,
  onSetMarriageDetails,
}: LifeSectionProps) {
  const [dialog, setDialog] = useState<LifeDialog>(null);
  const spouses = spousesOf(people, person);
  const children = childrenOf(people, person.id);
  const notableEvents = notableEventsOf(person);
  const marriageSpouse = dialog?.type === "marriage" ? people[dialog.spouseId] : undefined;
  const marriageDetails = marriageSpouse ? resolvedMarriage(person, marriageSpouse) : null;
  const editingResidence =
    dialog?.type === "address" && dialog.residenceId
      ? person.residences.find((item) => item.id === dialog.residenceId)
      : undefined;
  const editingEvent =
    dialog?.type === "notable" && dialog.eventId
      ? person.notableEvents.find((item) => item.id === dialog.eventId)
      : undefined;

  return (
    <>
      <div className="section-rule">
        <h5>Life</h5>
        <div className="rule-line" />
      </div>

      <div className="life-list">
        <div className="life-item">
          <div className="life-copy">
            <div className="life-kicker-row">
              <div className="life-kicker">Birth & location</div>
              <LifeEditButton label="Edit birth" onClick={() => onEditPerson(person.id)} />
            </div>
            <div className="vital-date">{person.birth || "Birth unknown"}</div>
            <div className="vital-place">{person.birthPlace || "Place not recorded"}</div>
          </div>
        </div>

        <div className="life-item is-stack">
          <div className="life-copy">
            <div className="life-kicker">Marriages</div>
            {spouses.length === 0 ? (
              <div className="vital-place">No marriages recorded</div>
            ) : (
              <div className="address-list">
                {spouses.map((spouse) => {
                  const marriage = resolvedMarriage(person, spouse);
                  return (
                    <div className="life-fact" key={spouse.id}>
                      <div className="life-fact-head">
                        <div className="vital-date">
                          {displayName(spouse)}
                          <span className="life-role"> · Spouse</span>
                        </div>
                        <LifeEditButton
                          label={`Edit marriage to ${displayName(spouse)}`}
                          onClick={() => setDialog({ type: "marriage", spouseId: spouse.id })}
                        />
                      </div>
                      <div className="vital-date">{marriage.date || "Date unknown"}</div>
                      <div className="vital-place">{marriage.place || "Place not recorded"}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="life-item is-stack">
          <div className="life-copy">
            <div className="life-kicker">Birth of children</div>
            {children.length === 0 ? (
              <div className="vital-place">No children recorded</div>
            ) : (
              <div className="address-list">
                {children.map((child) => (
                  <div className="life-fact" key={child.id}>
                    <div className="life-fact-head">
                      <div className="vital-date">
                        {displayName(child)}
                        <span className="life-role"> · {closeRelativeLabel(people, person, child)}</span>
                      </div>
                      <LifeEditButton
                        label={`Edit ${displayName(child)}`}
                        onClick={() => onEditPerson(child.id)}
                      />
                    </div>
                    <div className="vital-date">{child.birth || "Birth unknown"}</div>
                    <div className="vital-place">{child.birthPlace || "Place not recorded"}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="life-item is-stack">
          <div className="life-copy">
            <div className="life-kicker">Addresses</div>
            {person.residences.length === 0 ? (
              <div className="vital-place">No addresses recorded</div>
            ) : (
              <div className="address-list">
                {person.residences.map((residence) => (
                  <div className="life-fact" key={residence.id}>
                    <div className="life-fact-head">
                      <div className="vital-date">{residence.place}</div>
                      <LifeEditButton
                        label={`Edit ${residence.place}`}
                        onClick={() => setDialog({ type: "address", residenceId: residence.id })}
                      />
                    </div>
                    <div className="vital-place">{residenceYears(residence.from, residence.to)}</div>
                  </div>
                ))}
              </div>
            )}
            <button type="button" className="btn btn-secondary add-address-btn" onClick={() => setDialog({ type: "address" })}>
              Add address
            </button>
          </div>
        </div>

        <div className="life-item is-stack">
          <div className="life-copy">
            <div className="life-kicker">Notable events</div>
            {notableEvents.length === 0 ? (
              <div className="vital-place">No notable events recorded</div>
            ) : (
              <div className="address-list">
                {notableEvents.map((event) => (
                  <div className="life-fact" key={event.id}>
                    <div className="life-fact-head">
                      <div className="vital-date">{event.title}</div>
                      <LifeEditButton
                        label={`Edit ${event.title}`}
                        onClick={() => setDialog({ type: "notable", eventId: event.id })}
                      />
                    </div>
                    {event.date ? <div className="vital-place">{event.date}</div> : null}
                    {event.detail ? <div className="vital-place">{event.detail}</div> : null}
                  </div>
                ))}
              </div>
            )}
            <button type="button" className="btn btn-secondary add-address-btn" onClick={() => setDialog({ type: "notable" })}>
              Add event
            </button>
          </div>
        </div>

        {(person.altNames?.length ?? 0) > 0 && (
          <div className="life-item">
            <div className="life-copy">
              <div className="life-kicker">Also known as</div>
              {person.altNames.map((name) => (
                <div className="vital-date" key={name}>
                  {name}
                </div>
              ))}
            </div>
          </div>
        )}

        {person.notes?.trim() ? (
          <div className="life-item">
            <div className="life-copy">
              <div className="life-kicker">Notes</div>
              <div className="vital-place note-text">{person.notes}</div>
            </div>
          </div>
        ) : null}

        {(person.sources?.length ?? 0) > 0 && (
          <div className="life-item is-stack">
            <div className="life-copy">
              <div className="life-kicker">Sources</div>
              <div className="source-list">
                {person.sources.map((source) =>
                  source.url ? (
                    <a
                      key={source.id}
                      className="source-link"
                      href={source.url.replace(/^http:\/\/(search\.findmypast)/, "https://$1")}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {source.title} ↗
                    </a>
                  ) : (
                    <div key={source.id} className="vital-place">
                      {source.title}
                    </div>
                  ),
                )}
              </div>
            </div>
          </div>
        )}

        <div className="life-item">
          <div className="life-copy">
            <div className="life-kicker-row">
              <div className="life-kicker">Death & location</div>
              <LifeEditButton label="Edit death" onClick={() => onEditPerson(person.id)} />
            </div>
            {person.living ? (
              <div className="vital-date">Living</div>
            ) : (
              <>
                <div className="vital-date">{person.death || "Death unknown"}</div>
                <div className="vital-place">{person.deathPlace || "Place not recorded"}</div>
              </>
            )}
          </div>
        </div>
      </div>

      {dialog?.type === "address" && !dialog.residenceId && (
        <AddressDialog
          onClose={() => setDialog(null)}
          onSubmit={(place, from, to) => {
            onAddResidence(place, from, to);
            setDialog(null);
          }}
        />
      )}
      {dialog?.type === "address" && editingResidence && (
        <AddressDialog
          place={editingResidence.place}
          from={editingResidence.from}
          to={editingResidence.to}
          onClose={() => setDialog(null)}
          onSubmit={(place, from, to) => {
            onUpdateResidence(editingResidence.id, place, from, to);
            setDialog(null);
          }}
          onRemove={() => {
            onRemoveResidence(editingResidence.id);
            setDialog(null);
          }}
        />
      )}
      {dialog?.type === "notable" && !dialog.eventId && (
        <NotableEventDialog
          onClose={() => setDialog(null)}
          onSubmit={async (title, date, detail) => {
            await onAddNotableEvent(title, date, detail);
            setDialog(null);
          }}
        />
      )}
      {dialog?.type === "notable" && editingEvent && (
        <NotableEventDialog
          title={editingEvent.title}
          date={editingEvent.date}
          detail={editingEvent.detail}
          onClose={() => setDialog(null)}
          onSubmit={async (title, date, detail) => {
            await onUpdateNotableEvent(editingEvent.id, title, date, detail);
            setDialog(null);
          }}
          onRemove={() => {
            onRemoveNotableEvent(editingEvent.id);
            setDialog(null);
          }}
        />
      )}
      {dialog?.type === "marriage" && marriageSpouse && marriageDetails && (
        <MarriageDialog
          spouseName={displayName(marriageSpouse)}
          date={marriageDetails.date}
          place={marriageDetails.place}
          onClose={() => setDialog(null)}
          onSubmit={(date, place) => {
            onSetMarriageDetails(marriageSpouse.id, date, place);
            setDialog(null);
          }}
        />
      )}
    </>
  );
}
