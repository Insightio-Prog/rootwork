import { useState } from "react";
import { militaryOf, type Person } from "../data/people";
import { LifeEditButton } from "./LifeSection";
import { MedalDialog } from "./MedalDialog";
import { MilitaryDialog } from "./MilitaryDialog";

type MilitarySectionProps = {
  person: Person;
  onAddService: (served: string, war: string) => void;
  onUpdateService: (serviceId: string, served: string, war: string) => void;
  onRemoveService: (serviceId: string) => void;
  onAddMedal: (serviceId: string, name: string) => void;
  onUpdateMedal: (serviceId: string, medalId: string, name: string) => void;
  onRemoveMedal: (serviceId: string, medalId: string) => void;
};

type MilitaryDialogState =
  | { type: "service"; serviceId?: string }
  | { type: "medal"; serviceId: string; medalId?: string }
  | null;

export function MilitarySection({
  person,
  onAddService,
  onUpdateService,
  onRemoveService,
  onAddMedal,
  onUpdateMedal,
  onRemoveMedal,
}: MilitarySectionProps) {
  const [dialog, setDialog] = useState<MilitaryDialogState>(null);
  const services = militaryOf(person);
  const editingService =
    dialog?.type === "service" && dialog.serviceId
      ? services.find((service) => service.id === dialog.serviceId)
      : undefined;
  const editingMedal =
    dialog?.type === "medal" && dialog.medalId
      ? services
          .find((service) => service.id === dialog.serviceId)
          ?.medals.find((medal) => medal.id === dialog.medalId)
      : undefined;

  return (
    <>
      <div className="section-rule">
        <h5>Military</h5>
        <div className="rule-line" />
      </div>

      <div className="life-list">
        <div className="life-item is-stack">
          <div className="life-copy">
            {services.length === 0 ? (
              <div className="vital-place">No military service recorded</div>
            ) : (
              <div className="address-list">
                {services.map((service) => (
                  <div className="life-fact" key={service.id}>
                    <div className="life-fact-head">
                      <div className="vital-date">{service.war || "War not recorded"}</div>
                      <LifeEditButton
                        label={`Edit ${service.war || "military service"}`}
                        onClick={() => setDialog({ type: "service", serviceId: service.id })}
                      />
                    </div>
                    <div className="life-kicker">Date served</div>
                    <div className="vital-date">{service.served || "Dates unknown"}</div>
                    <div className="life-kicker">Medals</div>
                    {service.medals.length === 0 ? (
                      <div className="vital-place">No medals recorded</div>
                    ) : (
                      <div className="address-list">
                        {service.medals.map((medal) => (
                          <div className="life-fact" key={medal.id}>
                            <div className="life-fact-head">
                              <div className="vital-date">{medal.name}</div>
                              <LifeEditButton
                                label={`Edit ${medal.name}`}
                                onClick={() =>
                                  setDialog({
                                    type: "medal",
                                    serviceId: service.id,
                                    medalId: medal.id,
                                  })
                                }
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <button
                      type="button"
                      className="btn btn-secondary add-address-btn"
                      onClick={() => setDialog({ type: "medal", serviceId: service.id })}
                    >
                      Add medal
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              className="btn btn-secondary add-address-btn"
              onClick={() => setDialog({ type: "service" })}
            >
              Add service
            </button>
          </div>
        </div>
      </div>

      {dialog?.type === "service" && !dialog.serviceId && (
        <MilitaryDialog
          onClose={() => setDialog(null)}
          onSubmit={(served, war) => {
            onAddService(served, war);
            setDialog(null);
          }}
        />
      )}
      {dialog?.type === "service" && editingService && (
        <MilitaryDialog
          served={editingService.served}
          war={editingService.war}
          onClose={() => setDialog(null)}
          onSubmit={(served, war) => {
            onUpdateService(editingService.id, served, war);
            setDialog(null);
          }}
          onRemove={() => {
            onRemoveService(editingService.id);
            setDialog(null);
          }}
        />
      )}
      {dialog?.type === "medal" && !dialog.medalId && (
        <MedalDialog
          onClose={() => setDialog(null)}
          onSubmit={(name) => {
            onAddMedal(dialog.serviceId, name);
            setDialog(null);
          }}
        />
      )}
      {dialog?.type === "medal" && editingMedal && (
        <MedalDialog
          name={editingMedal.name}
          onClose={() => setDialog(null)}
          onSubmit={(name) => {
            onUpdateMedal(dialog.serviceId, editingMedal.id, name);
            setDialog(null);
          }}
          onRemove={() => {
            onRemoveMedal(dialog.serviceId, editingMedal.id);
            setDialog(null);
          }}
        />
      )}
    </>
  );
}
