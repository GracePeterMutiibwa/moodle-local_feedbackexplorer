<?php
namespace local_feedbackexplorer;

defined('MOODLE_INTERNAL') || die();

class feedback_data {

    private $feedbackid;
    private $context;
    private $db;

    public function __construct(int $feedbackid, \context $context) {
        global $DB;
        $this->feedbackid = $feedbackid;
        $this->context    = $context;
        $this->db         = $DB;
    }

    /**
     * Main entry point. Returns a normalized structure:
     * [
     *   'feedback_id' => int,
     *   'total_responses' => int,
     *   'questions' => [
     *     [
     *       'id'       => int,
     *       'type'     => string,   // multichoice, textarea, numeric, etc.
     *       'position' => int,
     *       'label'    => string,   // the question text
     *       'answers'  => []        // shape depends on type
     *     ],
     *     ...
     *   ]
     * ]
     */
    public function get_normalized_data(): array {
        $items     = $this->get_items();
        $completed = $this->get_completed_ids();
        $values    = $this->get_all_values();

        $questions = [];
        foreach ($items as $item) {
            $questions[] = $this->normalize_item($item, $values, count($completed));
        }

        return [
            'feedback_id'      => $this->feedbackid,
            'total_responses'  => count($completed),
            'questions'        => $questions,
        ];
    }

    // -------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------

    private function get_items(): array {
        return array_values($this->db->get_records(
            'feedback_item',
            ['feedback' => $this->feedbackid, 'hasvalue' => 1],
            'position ASC'
        ));
    }

    private function get_completed_ids(): array {
        return array_keys($this->db->get_records(
            'feedback_completed',
            ['feedback' => $this->feedbackid],
            '',
            'id'
        ));
    }

    private function get_all_values(): array {
        // Returns all response values for this feedback, keyed by item id
        $sql = "SELECT fv.*
                  FROM {feedback_value} fv
                  JOIN {feedback_completed} fc ON fc.id = fv.completed
                 WHERE fc.feedback = :feedbackid";

        $records = $this->db->get_records_sql($sql, ['feedbackid' => $this->feedbackid]);

        // Group by item id
        $grouped = [];
        foreach ($records as $r) {
            $grouped[$r->item][] = $r->value;
        }
        return $grouped;
    }

    private function normalize_item(object $item, array $values, int $total): array {
        $raw_answers = $values[$item->id] ?? [];

        $base = [
            'id'       => (int) $item->id,
            'type'     => $item->typ,
            'position' => (int) $item->position,
            'label'    => strip_tags($item->name),
            'answers'  => [],
        ];

        switch ($item->typ) {
            case 'multichoice':
            case 'multichoicerated':
                $base['answers'] = $this->normalize_multichoice($item, $raw_answers, $total);
                break;

            case 'numeric':
                $base['answers'] = $this->normalize_numeric($raw_answers, $total);
                break;

            case 'textarea':
            case 'textfield':
                $base['answers'] = $this->normalize_text($raw_answers);
                break;

            default:
                // Unknown type — pass raw so we can see it and handle it later
                $base['answers'] = $raw_answers;
                break;
        }

        return $base;
    }

    private function normalize_multichoice(object $item, array $raw, int $total): array {
        // Options are stored in $item->presentation, pipe-separated
        $options = array_filter(explode('|', $item->presentation ?? ''));
        // Strip leading 'r' used by multichoicerated
        $options = array_map(fn($o) => ltrim(trim($o), '>r '), $options);

        $counts = array_fill(0, count($options), 0);
        foreach ($raw as $val) {
            // Values are 1-based option indices
            $idx = (int)$val - 1;
            if (isset($counts[$idx])) {
                $counts[$idx]++;
            }
        }

        $result = [];
        foreach ($options as $i => $label) {
            $count = $counts[$i] ?? 0;
            $result[] = [
                'option'     => $label,
                'count'      => $count,
                'percentage' => $total > 0 ? round(($count / $total) * 100, 1) : 0,
            ];
        }
        return $result;
    }

    private function normalize_numeric(array $raw, int $total): array {
        $nums = array_filter(array_map('floatval', $raw), fn($v) => $v !== 0.0 || in_array('0', $raw));
        if (empty($nums)) {
            return ['min' => null, 'max' => null, 'avg' => null, 'responses' => 0];
        }
        return [
            'min'       => min($nums),
            'max'       => max($nums),
            'avg'       => round(array_sum($nums) / count($nums), 2),
            'responses' => count($nums),
        ];
    }

    private function normalize_text(array $raw): array {
        // Return non-empty responses as a plain list
        return array_values(array_filter(array_map('trim', $raw)));
    }
}