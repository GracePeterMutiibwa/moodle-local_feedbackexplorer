<?php
defined('MOODLE_INTERNAL') || die();

function local_feedbackexplorer_before_footer() {
    global $PAGE, $DB;

    // Only inject on the feedback responses page
    if ($PAGE->pagetype !== 'mod-feedback-show_entries_anon' &&
        $PAGE->pagetype !== 'mod-feedback-show_entries') {
        return;
    }

    $cmid = $PAGE->cm->id ?? null;
    if (!$cmid) {
        return;
    }

    // Get the feedback instance id from the course module
    $cm = $PAGE->cm;
    $feedbackid = $cm->instance;

    $explorerurl = new moodle_url('/local/feedbackexplorer/explorer.php', [
        'feedbackid' => $feedbackid,
        'cmid'       => $cmid,
    ]);

    $button = html_writer::link(
        $explorerurl,
        '✨ Explorer',
        ['class' => 'btn btn-primary ml-2', 'target' => '_blank']
    );

    $PAGE->requires->js_amd_inline("
        require(['jquery'], function(\$) {
            \$(document).ready(function() {
                \$('.responsedownloadlink, [data-action=\"downloadresponses\"], .download-responses')
                    .first()
                    .after(" . json_encode($button) . ");
            });
        });
    ");
}