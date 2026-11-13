package model

import (
	"github.com/perses/shared/cue/common"
)

#labelName: string & =~"^[a-zA-Z_][a-zA-Z0-9_]*$"

// How big a change has to be to count. relative: 0.02 is 2 % of the baseline; absolute: in the
// column's unit.
#tolerance: close({
	mode: "relative" | "absolute"
	// A change up to this size is "same".
	same: number & >=0
	// A regression of at least this size is large (red); smaller ones are small (amber).
	large?: number & >=0
})

kind: "EvalMatrixChart"
spec: close({
	// Label names that define a row; their values are joined with " · ".
	rowLabels: [#labelName, ...#labelName]
	// Label name that defines the columns.
	columnLabel: #labelName
	// Label that tells runs apart; each row shows its newest run. Default run_id.
	runLabel?: #labelName
	// What cells are compared with. No comparison when unset.
	baseline?: close({
		mode: "row" | "previousRun"
		// The baseline row's key (row label values joined with " · "). The first row when unset.
		row?: string & !=""
	})
	// Settings per column, in display order. Other columns follow alphabetically with defaults.
	columns?: [...close({
		name:         string & !=""
		displayName?: string & !=""
		format?:      common.#format
		// Default higher.
		better?:    "higher" | "lower"
		tolerance?: #tolerance
	})]
	// Default relative, same 0.01, large 0.1.
	tolerance?: #tolerance
	// Label whose value names a row's parent: the row with that key, or a group.
	rowTree?: #labelName
	// Index of the query giving the sample size per row and run.
	sampleSizeQuery?: int & >=0
	// Link in the detail strip. Variables: ${row} ${column} ${run_id} ${baseline_row}
	// ${baseline_run_id}, plus dashboard variables.
	cellLink?: string & !=""
	// Text of the link. Default "Open failing cases".
	cellLinkLabel?: string & !=""
})
