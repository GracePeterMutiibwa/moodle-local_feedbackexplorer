<?php
defined('MOODLE_INTERNAL') || die();

$callbacks = [
    [
        'hook'     => \core\hook\output\before_footer_html_generation::class,
        'callback' => \local_feedbackexplorer\hook\output_callbacks::class . '::before_footer',
        'priority' => 500,
    ],
];