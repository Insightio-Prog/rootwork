import { useRef, type ChangeEvent } from "react";
import {
  childrenOf,
  displayName,
  orderedParents,
  roleFor,
  siblingsOf,
  spousesOf,
  yearsLabel,
  type Person,
} from "../data/people";
import { IconChevron, IconClose, IconParents } from "../icons";
import { PersonAvatar } from "./PersonAvatar";
import { PersonFlag } from "./PersonFlag";
import { LifeSection } from "./LifeSection";
import { EmploymentSection } from "./EmploymentSection";
import { MilitarySection } from "./MilitarySection";

type PersonPanelProps = {
  people: Record<string, Person>;
  person: Person;
  homePersonId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
  onMakeHome: () => void;
  onAddParent: () => void;
  onRemoveParent: (parentId: string) => void;
  onAddSpouse: () => void;
  onRemoveSpouse: (spouseId: string) => void;
  onAddChild: () => void;
  onRemoveChild: (childId: string) => void;
  onAddSibling: () => void;
  onRemoveSibling: (siblingId: string) => void;
  onEdit: (id: string) => void;
  onAddResidence: (place: string, from: string, to: string) => void;
  onUpdateResidence: (residenceId: string, place: string, from: string, to: string) => void;
  onRemoveResidence: (residenceId: string) => void;
  onAddNotableEvent: (title: string, date: string, detail: string) => void;
  onUpdateNotableEvent: (eventId: string, title: string, date: string, detail: string) => void | Promise<void>;
  onRemoveNotableEvent: (eventId: string) => void;
  onSetMarriageDetails: (spouseId: string, date: string, place: string) => void;
  onSetPhoto: (file: File) => void;
  onSetFlag: (file: File) => void;
  onAddJob: (title: string, detail: string) => void;
  onUpdateJob: (jobId: string, title: string, detail: string) => void;
  onRemoveJob: (jobId: string) => void;
  onAddMilitaryService: (served: string, war: string) => void;
  onUpdateMilitaryService: (serviceId: string, served: string, war: string) => void;
  onRemoveMilitaryService: (serviceId: string) => void;
  onAddMedal: (serviceId: string, name: string) => void;
  onUpdateMedal: (serviceId: string, medalId: string, name: string) => void;
  onRemoveMedal: (serviceId: string, medalId: string) => void;
  readOnly?: boolean;
};

export function PersonPanel({
  people,
  person,
  homePersonId,
  onSelect,
  onClose,
  onMakeHome,
  onAddParent,
  onRemoveParent,
  onAddSpouse,
  onRemoveSpouse,
  onAddChild,
  onRemoveChild,
  onAddSibling,
  onRemoveSibling,
  onEdit,
  onAddResidence,
  onUpdateResidence,
  onRemoveResidence,
  onAddNotableEvent,
  onUpdateNotableEvent,
  onRemoveNotableEvent,
  onSetMarriageDetails,
  onSetPhoto,
  onSetFlag,
  onAddJob,
  onUpdateJob,
  onRemoveJob,
  onAddMilitaryService,
  onUpdateMilitaryService,
  onRemoveMilitaryService,
  onAddMedal,
  onUpdateMedal,
  onRemoveMedal,
  readOnly = false,
}: PersonPanelProps) {
  const parents = orderedParents(people, person);
  const spouses = spousesOf(people, person);
  const children = childrenOf(people, person.id);
  const siblings = siblingsOf(people, person);
  const isHome = person.id === homePersonId;
  const photoInputRef = useRef<HTMLInputElement>(null);
  const flagInputRef = useRef<HTMLInputElement>(null);

  function handlePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) onSetPhoto(file);
  }

  function handleFlag(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) onSetFlag(file);
  }

  return (
    <aside className={`person-panel${readOnly ? " is-readonly" : ""}`}>
      <div className="panel-head">
        <div className="panel-identity">
          <div className="panel-role">{roleFor(people, person.id, homePersonId)}</div>
          <h3 className="panel-name">{displayName(person)}</h3>
          <div className="panel-years">{yearsLabel(person)}</div>
        </div>
        <div className="panel-media">
          <button
            type="button"
            className="panel-photo"
            data-layout="panel-photo"
            onClick={() => {
              if (readOnly) return;
              photoInputRef.current?.click();
            }}
            aria-label={readOnly ? "Photo" : person.photo ? "Change photo" : "Add photo"}
          >
            <PersonAvatar person={person} className={`panel-mono is-${person.gender}`} />
            <span className="no-photo">{person.photo ? "change photo" : "add photo"}</span>
            {!readOnly && (
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={handlePhoto}
            />
            )}
          </button>
        </div>
      </div>

      <div className="panel-body">
        <div className="vital-block">
          <button
            type="button"
            className="panel-flag"
            data-layout="panel-flag"
            onClick={() => {
              if (readOnly) return;
              flagInputRef.current?.click();
            }}
            aria-label={person.flag ? "Change flag" : "Add flag"}
          >
            <PersonFlag flag={person.flag ?? null} nationality={person.nationality} className="panel-flag-frame" />
            {!readOnly && (
            <input
              ref={flagInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={handleFlag}
            />
            )}
          </button>
          <div className="vital-row">
            <span className="vital-icon is-birth">✳</span>
            <div>
              <div className="vital-date">{person.birth || "Birth unknown"}</div>
              <div className="vital-place">{person.birthPlace || "Place not recorded"}</div>
            </div>
          </div>
          <div className="vital-row">
            <span className="vital-icon is-death">✝</span>
            <div>
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
          <div className="vital-row">
            <span className="vital-icon is-nationality">⚑</span>
            <div>
              <div className="vital-date">{person.nationality || "Nationality unknown"}</div>
              {!person.nationality && !readOnly ? (
                <button type="button" className="vital-link" onClick={() => onEdit(person.id)}>
                  Add nationality
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <LifeSection
          people={people}
          person={person}
          onEditPerson={onEdit}
          onAddResidence={onAddResidence}
          onUpdateResidence={onUpdateResidence}
          onRemoveResidence={onRemoveResidence}
          onAddNotableEvent={onAddNotableEvent}
          onUpdateNotableEvent={onUpdateNotableEvent}
          onRemoveNotableEvent={onRemoveNotableEvent}
          onSetMarriageDetails={onSetMarriageDetails}
        />

        <EmploymentSection
          person={person}
          onAddJob={onAddJob}
          onUpdateJob={onUpdateJob}
          onRemoveJob={onRemoveJob}
        />

        <MilitarySection
          person={person}
          onAddService={onAddMilitaryService}
          onUpdateService={onUpdateMilitaryService}
          onRemoveService={onRemoveMilitaryService}
          onAddMedal={onAddMedal}
          onUpdateMedal={onUpdateMedal}
          onRemoveMedal={onRemoveMedal}
        />

        <div className="section-rule">
          <h5>Relationships</h5>
          <div className="rule-line" />
        </div>

        <RelationSection
          label="Parents"
          countLabel={parents.length === 1 ? "1 parent" : `${parents.length} parents`}
          people={parents}
          emptyTitle="No parents recorded"
          emptyDetail="Add a parent to grow this line"
          addLabel="Add parent"
          removeKind="parent"
          showCount
          addInHeader
          showAdd={!readOnly && parents.length < 2}
          onAdd={onAddParent}
          onSelect={onSelect}
          onRemove={onRemoveParent}
          readOnly={readOnly}
        />

        <RelationSection
          label="Spouses"
          countLabel={spouses.length === 1 ? "1 spouse" : `${spouses.length} spouses`}
          people={spouses}
          emptyTitle="No spouses recorded"
          emptyDetail="Add a spouse if they married"
          addLabel="Add spouse"
          removeKind="spouse"
          showCount={spouses.length > 0}
          showAdd={!readOnly}
          onAdd={onAddSpouse}
          onSelect={onSelect}
          onRemove={onRemoveSpouse}
          readOnly={readOnly}
        />

        <RelationSection
          label="Children"
          countLabel={children.length === 1 ? "1 child" : `${children.length} children`}
          people={children}
          emptyTitle="No children recorded"
          emptyDetail="Add a child to this person"
          addLabel="Add child"
          removeKind="child"
          showCount={children.length > 0}
          showAdd={!readOnly}
          onAdd={onAddChild}
          onSelect={onSelect}
          onRemove={onRemoveChild}
          readOnly={readOnly}
        />

        <RelationSection
          label="Siblings"
          countLabel={siblings.length === 1 ? "1 sibling" : `${siblings.length} siblings`}
          people={siblings}
          emptyTitle="No siblings recorded"
          emptyDetail={
            person.parentIds.length === 0
              ? "Add a parent first, then you can add brothers or sisters"
              : "Add a brother or sister who shares their parents"
          }
          addLabel="Add sibling"
          removeKind="sibling"
          showCount={siblings.length > 0}
          addDisabled={person.parentIds.length === 0}
          addDisabledTitle="Add a parent first"
          showAdd={!readOnly}
          onAdd={onAddSibling}
          onSelect={onSelect}
          onRemove={onRemoveSibling}
          readOnly={readOnly}
        />

        {!readOnly && (
        <div className="panel-actions">
          <button type="button" className="btn btn-primary" onClick={() => onEdit(person.id)}>
            Edit person
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onMakeHome}
            disabled={isHome}
          >
            {isHome ? "Home person" : "Make home person"}
          </button>
        </div>
        )}
      </div>

      <button
        type="button"
        onClick={onClose}
        className="btn btn-icon panel-close"
        aria-label="Close panel"
      >
        <IconClose size={16} />
      </button>
    </aside>
  );
}

type RelationSectionProps = {
  label: string;
  countLabel: string;
  people: Person[];
  emptyTitle: string;
  emptyDetail: string;
  addLabel: string;
  removeKind: string;
  showCount?: boolean;
  addInHeader?: boolean;
  showAdd?: boolean;
  addDisabled?: boolean;
  addDisabledTitle?: string;
  onAdd: () => void;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  readOnly?: boolean;
};

function RelationSection({
  label,
  countLabel,
  people,
  emptyTitle,
  emptyDetail,
  addLabel,
  removeKind,
  showCount = false,
  addInHeader = false,
  showAdd = true,
  addDisabled = false,
  addDisabledTitle,
  onAdd,
  onSelect,
  onRemove,
  readOnly = false,
}: RelationSectionProps) {
  return (
    <div className="rel-section">
      <div className="parents-label">
        <span className="parents-kicker">{label}</span>
        {showCount && people.length > 0 && (
          <span className="family-chip">
            <IconParents size={13} />
            {countLabel}
          </span>
        )}
        {addInHeader && showAdd && (
          <button
            type="button"
            className="btn btn-ghost add-rel-btn"
            onClick={onAdd}
            disabled={addDisabled}
            title={addDisabled ? addDisabledTitle : undefined}
          >
            {addLabel}
          </button>
        )}
      </div>
      <div className="parent-list">
        {people.length > 0 ? (
          people.map((relative) => (
            <div className="parent-row-wrap" key={relative.id}>
              <button type="button" className="parent-row" onClick={() => onSelect(relative.id)}>
                <PersonAvatar
                  person={relative}
                  className={`parent-mono person-mono is-${relative.gender}`}
                />
                <div className="parent-copy">
                  <div className="parent-name">{displayName(relative)}</div>
                  <div className="parent-years">{yearsLabel(relative)}</div>
                </div>
                <IconChevron size={17} />
              </button>
              {!readOnly && (
              <button
                type="button"
                className="parent-remove"
                aria-label={`Remove ${displayName(relative)} as ${removeKind}`}
                title={`Remove as ${removeKind}`}
                onClick={() => onRemove(relative.id)}
              >
                <IconClose size={14} />
              </button>
              )}
            </div>
          ))
        ) : readOnly ? (
          <div className="parent-row">
            <div className="parent-mono person-mono is-male">?</div>
            <div className="parent-copy">
              <div className="parent-name">{emptyTitle}</div>
              <div className="parent-years">{emptyDetail}</div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="parent-row"
            onClick={onAdd}
            disabled={addDisabled}
            title={addDisabled ? addDisabledTitle : undefined}
          >
            <div className="parent-mono person-mono is-male">?</div>
            <div className="parent-copy">
              <div className="parent-name">{emptyTitle}</div>
              <div className="parent-years">{emptyDetail}</div>
            </div>
            <IconChevron size={17} />
          </button>
        )}
      </div>
      {!addInHeader && showAdd && (
        <div className="chip-row rel-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onAdd}
            disabled={addDisabled}
            title={addDisabled ? addDisabledTitle : undefined}
          >
            {addLabel}
          </button>
        </div>
      )}
    </div>
  );
}
