<?php
define('AJAX_SCRIPT', true);
require_once(__DIR__ . '/../../config.php');
require_login();

header('Content-Type: application/json');

$raw  = file_get_contents('php://input');
$body = json_decode($raw, true);

if (!confirm_sesskey($body['sesskey'] ?? '')) {
    echo json_encode(['success' => false, 'error' => 'Invalid session key']);
    exit;
}

$feedbackid = (int)($body['feedbackid'] ?? 0);
$markdown   = $body['markdown'] ?? '';

if (!$feedbackid || !$markdown) {
    echo json_encode(['success' => false, 'error' => 'Missing data']);
    exit;
}

set_config('report_' . $USER->id . '_' . $feedbackid, $markdown, 'local_feedbackexplorer');

echo json_encode(['success' => true]);