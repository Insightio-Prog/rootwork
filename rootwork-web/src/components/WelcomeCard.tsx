import { useState, type FormEvent } from "react";

type WelcomeCardProps = {
  treeTitle: string;
  onStart: (name: string) => void;
  onImport: () => void;
};

const DEFAULT_TITLE = "My Family";

export function WelcomeCard({ treeTitle, onStart, onImport }: WelcomeCardProps) {
  const [name, setName] = useState(treeTitle === DEFAULT_TITLE ? "" : treeTitle);

  function submit(event: FormEvent) {
    event.preventDefault();
    onStart(name.trim() || DEFAULT_TITLE);
  }

  return (
    <form className="card elev-md placeholder-card welcome-card" onSubmit={submit}>
      <div className="placeholder-kicker">Welcome</div>
      <h3>Welcome to Rootwork</h3>
      <p className="welcome-lead">
        Let&rsquo;s set up your family tree. It takes a minute: give the tree a name, then add the
        first person to start from. You can add parents, partners and children after that.
      </p>
      <ol className="welcome-steps">
        <li>
          <span className="welcome-step-num">1</span> Name your tree
        </li>
        <li>
          <span className="welcome-step-num">2</span> Add the first person
        </li>
      </ol>
      <div className="field">
        <label htmlFor="welcome-tree-name">Tree name</label>
        <input
          id="welcome-tree-name"
          className="input welcome-input"
          type="text"
          autoFocus
          autoComplete="off"
          placeholder="e.g. The Palmer Family"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      <button type="submit" className="btn btn-primary welcome-start">
        Add the first person
      </button>
      <p className="welcome-import">
        Already have a Rootwork backup file from a family member?{" "}
        <button type="button" className="welcome-link" onClick={onImport}>
          Import it instead
        </button>
      </p>
    </form>
  );
}
