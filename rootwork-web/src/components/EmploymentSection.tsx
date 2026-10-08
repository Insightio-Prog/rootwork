import { useState } from "react";
import type { Person } from "../data/people";
import { IconPencil } from "../icons";
import { JobDialog } from "./JobDialog";

type EmploymentSectionProps = {
  person: Person;
  onAddJob: (title: string, detail: string) => void;
  onUpdateJob: (jobId: string, title: string, detail: string) => void;
  onRemoveJob: (jobId: string) => void;
};

export function EmploymentSection({
  person,
  onAddJob,
  onUpdateJob,
  onRemoveJob,
}: EmploymentSectionProps) {
  const [editingId, setEditingId] = useState<string | null | undefined>(undefined);
  const jobs = person.jobs ?? [];
  const editing = editingId ? jobs.find((job) => job.id === editingId) : undefined;
  const dialogOpen = editingId !== undefined;

  return (
    <>
      <div className="section-rule">
        <h5>Employment</h5>
        <div className="rule-line" />
      </div>

      <div className="life-list">
        <div className="life-item is-stack">
          <div className="life-copy">
            {jobs.length === 0 ? (
              <div className="vital-place">No jobs recorded</div>
            ) : (
              <div className="address-list">
                {jobs.map((job) => (
                  <div className="address-row" key={job.id}>
                    <div className="life-fact">
                      <div className="life-fact-head">
                        <div className="vital-date">{job.title}</div>
                        <button
                          type="button"
                          className="life-edit-btn"
                          aria-label={`Edit ${job.title}`}
                          title={`Edit ${job.title}`}
                          onClick={() => setEditingId(job.id)}
                        >
                          <IconPencil size={14} />
                        </button>
                      </div>
                      {job.detail ? <div className="vital-place">{job.detail}</div> : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button type="button" className="btn btn-secondary add-address-btn" onClick={() => setEditingId(null)}>
              Add job
            </button>
          </div>
        </div>
      </div>

      {dialogOpen && (
        <JobDialog
          title={editing?.title}
          detail={editing?.detail}
          onClose={() => setEditingId(undefined)}
          onSubmit={(title, detail) => {
            if (editing) onUpdateJob(editing.id, title, detail);
            else onAddJob(title, detail);
            setEditingId(undefined);
          }}
          onRemove={
            editing
              ? () => {
                  onRemoveJob(editing.id);
                  setEditingId(undefined);
                }
              : undefined
          }
        />
      )}
    </>
  );
}
