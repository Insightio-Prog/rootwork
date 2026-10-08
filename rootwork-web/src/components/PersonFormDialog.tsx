import { useMemo, useState, type FormEvent } from "react";
import { COUNTRY_NAMES } from "../data/countries";
import { displayName, emptyDraft, yearsLabel, type Gender, type Person, type PersonDraft } from "../data/people";
import { PersonAvatar } from "./PersonAvatar";

type OtherParentOptions = {
  knownParentName: string;
  spouses: Person[];
  others: Person[];
};

type PersonFormDialogProps = {
  title: string;
  initial: Partial<PersonDraft>;
  submitLabel: string;
  existingCandidates?: Person[];
  otherParent?: OtherParentOptions;
  onClose: () => void;
  onSubmit: (draft: PersonDraft, otherParentId?: string) => void;
  onSubmitExisting?: (id: string, otherParentId?: string) => void;
};

function OtherParentField({
  options,
  value,
  onChange,
}: {
  options: OtherParentOptions;
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="field field-span">
      <label htmlFor="other-parent">Other parent</label>
      <select
        id="other-parent"
        className="input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Unknown</option>
        {options.spouses.length > 0 && (
          <optgroup label={options.spouses.length === 1 ? "Spouse" : "Spouses"}>
            {options.spouses.map((person) => (
              <option key={person.id} value={person.id}>
                {displayName(person)}
              </option>
            ))}
          </optgroup>
        )}
        {options.others.length > 0 && (
          <optgroup label="Someone else on the tree">
            {options.others.map((person) => (
              <option key={person.id} value={person.id}>
                {displayName(person)}
              </option>
            ))}
          </optgroup>
        )}
      </select>
      <p className="dialog-body other-parent-hint">
        {options.knownParentName} is already a parent. Choose the other one if you know them.
      </p>
    </div>
  );
}

export function PersonFormDialog({
  title,
  initial,
  submitLabel,
  existingCandidates = [],
  otherParent,
  onClose,
  onSubmit,
  onSubmitExisting,
}: PersonFormDialogProps) {
  const canUseExisting = existingCandidates.length > 0 && Boolean(onSubmitExisting);
  const [source, setSource] = useState<"new" | "existing">("new");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<PersonDraft>(() => emptyDraft(initial));
  const [error, setError] = useState("");
  const [otherParentId, setOtherParentId] = useState(() =>
    otherParent?.spouses.length === 1 ? otherParent.spouses[0].id : "",
  );
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return existingCandidates;
    return existingCandidates.filter((person) => displayName(person).toLowerCase().includes(needle));
  }, [existingCandidates, query]);

  function update<K extends keyof PersonDraft>(key: K, value: PersonDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (source === "existing") return;
    if (!draft.givenName.trim()) {
      setError("A given name is needed to add someone to the tree.");
      return;
    }
    onSubmit(
      {
        ...draft,
        givenName: draft.givenName.trim(),
        familyName: draft.familyName.trim(),
      },
      otherParentId || undefined,
    );
  }

  return (
    <div className="dialog-backdrop stub-dialog" onClick={onClose} role="presentation">
      <form
        className="dialog person-form"
        role="dialog"
        aria-modal="true"
        aria-labelledby="person-form-title"
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="dialog-title" id="person-form-title">
          {title}
        </div>
        <p className="dialog-body">
          {canUseExisting
            ? "Add someone new, or choose a person already on the tree."
            : "Names are enough to start. Dates and places can wait."}
        </p>

        {canUseExisting && (
          <div className="field">
            <label>Who</label>
            <div className="seg">
              <label className="seg-opt">
                <input
                  type="radio"
                  name="person-source"
                  checked={source === "new"}
                  onChange={() => setSource("new")}
                />
                New person
              </label>
              <label className="seg-opt">
                <input
                  type="radio"
                  name="person-source"
                  checked={source === "existing"}
                  onChange={() => setSource("existing")}
                />
                Existing person
              </label>
            </div>
          </div>
        )}

        {otherParent && (
          <OtherParentField options={otherParent} value={otherParentId} onChange={setOtherParentId} />
        )}

        {source === "existing" && canUseExisting ? (
          <>
            <div className="field">
              <label htmlFor="existing-search">Find a person</label>
              <input
                id="existing-search"
                className="input"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Name"
                autoFocus
              />
            </div>
            <div className="person-pick-list">
              {matches.length > 0 ? (
                matches.map((person) => (
                  <button
                    key={person.id}
                    type="button"
                    className="parent-row"
                    onClick={() => onSubmitExisting?.(person.id, otherParentId || undefined)}
                  >
                    <PersonAvatar person={person} className={`parent-mono person-mono is-${person.gender}`} />
                    <div className="parent-copy">
                      <div className="parent-name">{displayName(person)}</div>
                      <div className="parent-years">{yearsLabel(person)}</div>
                    </div>
                  </button>
                ))
              ) : (
                <p className="dialog-body">No matching people.</p>
              )}
            </div>
            <div className="dialog-actions">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="given-name">Given name</label>
                <input
                  id="given-name"
                  className="input"
                  value={draft.givenName}
                  onChange={(event) => update("givenName", event.target.value)}
                  autoFocus={!otherParent}
                />
              </div>
              <div className="field">
                <label htmlFor="family-name">Family name</label>
                <input
                  id="family-name"
                  className="input"
                  value={draft.familyName}
                  onChange={(event) => update("familyName", event.target.value)}
                />
              </div>
              <div className="field field-span">
                <label>Gender</label>
                <div className="seg">
                  {(["female", "male"] as Gender[]).map((gender) => (
                    <label key={gender} className="seg-opt">
                      <input
                        type="radio"
                        name="gender"
                        checked={draft.gender === gender}
                        onChange={() => update("gender", gender)}
                      />
                      {gender === "female" ? "Female" : "Male"}
                    </label>
                  ))}
                </div>
              </div>
              <div className="field">
                <label htmlFor="birth">Birth</label>
                <input
                  id="birth"
                  className="input"
                  placeholder="Year or full date"
                  value={draft.birth}
                  onChange={(event) => update("birth", event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="birth-place">Birth place</label>
                <input
                  id="birth-place"
                  className="input"
                  value={draft.birthPlace}
                  onChange={(event) => update("birthPlace", event.target.value)}
                />
              </div>
              <div className="field field-span">
                <label htmlFor="nationality">Nationality</label>
                <input
                  id="nationality"
                  className="input"
                  list="nationality-options"
                  placeholder="e.g. Welsh, Irish, English"
                  value={draft.nationality ?? ""}
                  onChange={(event) => update("nationality", event.target.value)}
                />
                <datalist id="nationality-options">
                  {COUNTRY_NAMES.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </div>
              <div className="field field-span">
                <label>Death</label>
                <div className="seg">
                  <label className="seg-opt">
                    <input
                      type="radio"
                      name="living"
                      checked={draft.living}
                      onChange={() => update("living", true)}
                    />
                    Living
                  </label>
                  <label className="seg-opt">
                    <input
                      type="radio"
                      name="living"
                      checked={!draft.living}
                      onChange={() => update("living", false)}
                    />
                    Deceased
                  </label>
                </div>
              </div>
              {!draft.living && (
                <>
                  <div className="field">
                    <label htmlFor="death">Date</label>
                    <input
                      id="death"
                      className="input"
                      placeholder="Year or full date"
                      value={draft.death}
                      onChange={(event) => update("death", event.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="death-place">Place</label>
                    <input
                      id="death-place"
                      className="input"
                      value={draft.deathPlace}
                      onChange={(event) => update("deathPlace", event.target.value)}
                    />
                  </div>
                </>
              )}
            </div>

            {error && <p className="form-error">{error}</p>}

            <div className="dialog-actions">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                {submitLabel}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
