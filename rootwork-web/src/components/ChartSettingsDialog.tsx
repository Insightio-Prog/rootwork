import { HIGHLIGHT_SLIDER, SPACING_SLIDERS } from "../chart/familyLayout";

type SpacingValues = {
  cardGap: number;
  familyGap: number;
  columnGap: number;
};

type ChartSettingsDialogProps = {
  generations: number;
  maxGenerations?: number;
  hint?: string;
  spacing?: SpacingValues;
  highlightDim?: number;
  onChange: (generations: number) => void;
  onSpacingChange?: (spacing: SpacingValues) => void;
  onHighlightDimChange?: (value: number) => void;
  onResetSpacing?: () => void;
  connectorGapHint?: number | null;
  onClose: () => void;
};

function SpacingSlider({
  label,
  value,
  min,
  max,
  suffix = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="spacing-slider">
      <span className="spacing-slider-label">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span className="spacing-slider-value">{`${value}${suffix}`}</span>
    </label>
  );
}

export function ChartSettingsDialog({
  generations,
  maxGenerations = 20,
  hint,
  spacing,
  highlightDim,
  onChange,
  onSpacingChange,
  onHighlightDimChange,
  onResetSpacing,
  connectorGapHint,
  onClose,
}: ChartSettingsDialogProps) {
  const choices = Array.from({ length: Math.max(1, maxGenerations - 1) }, (_, index) => index + 2);
  return (
    <div className="dialog-backdrop stub-dialog" onClick={onClose} role="presentation">
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="chart-settings-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dialog-title" id="chart-settings-title">
          Chart settings
        </div>
        <p className="dialog-body">
          {hint ?? "How many generations to show, counting the home person as the first."}
        </p>
        <div className="field">
          <label>Generations</label>
          <div className="seg gen-seg" role="radiogroup" aria-label="Generations to show">
            {choices.map((count) => (
              <label key={count} className="seg-opt">
                <input
                  type="radio"
                  name="chart-generations"
                  checked={generations === count}
                  onChange={() => onChange(count)}
                />
                {count}
              </label>
            ))}
          </div>
        </div>
        {spacing && onSpacingChange ? (
          <div className="field spacing-field">
            <label>Spacing</label>
            <SpacingSlider
              label="Card gap"
              value={spacing.cardGap}
              min={SPACING_SLIDERS.CARD_GAP.min}
              max={SPACING_SLIDERS.CARD_GAP.max}
              onChange={(cardGap) => onSpacingChange({ ...spacing, cardGap })}
            />
            <SpacingSlider
              label="Family gap"
              value={spacing.familyGap}
              min={SPACING_SLIDERS.FAMILY_GAP.min}
              max={SPACING_SLIDERS.FAMILY_GAP.max}
              onChange={(familyGap) => onSpacingChange({ ...spacing, familyGap })}
            />
            <SpacingSlider
              label="Column gap"
              value={spacing.columnGap}
              min={SPACING_SLIDERS.COLUMN_GAP.min}
              max={SPACING_SLIDERS.COLUMN_GAP.max}
              onChange={(columnGap) => onSpacingChange({ ...spacing, columnGap })}
            />
            {connectorGapHint ? (
              <p className="connector-gap-hint">
                Connector lanes need a column gap of at least {connectorGapHint}px.
              </p>
            ) : null}
            {onResetSpacing ? (
              <button type="button" className="btn btn-ghost spacing-reset" onClick={onResetSpacing}>
                Reset spacing
              </button>
            ) : null}
          </div>
        ) : null}
        {highlightDim != null && onHighlightDimChange ? (
          <div className="field spacing-field">
            <label>Highlight</label>
            <SpacingSlider
              label="Highlight intensity"
              value={highlightDim}
              min={HIGHLIGHT_SLIDER.min}
              max={HIGHLIGHT_SLIDER.max}
              suffix="%"
              onChange={onHighlightDimChange}
            />
          </div>
        ) : null}
        <div className="dialog-actions">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
