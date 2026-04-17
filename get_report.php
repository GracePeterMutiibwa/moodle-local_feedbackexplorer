<?php
define('AJAX_SCRIPT', true);
require_once(__DIR__ . '/../../config.php');
require_login();

header('Content-Type: application/json');

$feedbackid = required_param('feedbackid', PARAM_INT);

$markdown = get_config('local_feedbackexplorer', 'report_' . $USER->id . '_' . $feedbackid);

echo json_encode([
    'success'  => true,
    'markdown' => $markdown ?: null,
]);