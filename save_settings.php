<?php
define('AJAX_SCRIPT', true);
require_once(__DIR__ . '/../../config.php');
require_login();

if (!is_siteadmin()) {
    echo json_encode(['success' => false, 'error' => 'Access denied']);
    exit;
}

header('Content-Type: application/json');

$raw  = file_get_contents('php://input');
$body = json_decode($raw, true);

if (!confirm_sesskey($body['sesskey'] ?? '')) {
    echo json_encode(['success' => false, 'error' => 'Invalid session key']);
    exit;
}

$fields = ['baseurl', 'apikey', 'models', 'default_model', 'sysprompt'];
foreach ($fields as $field) {
    if (isset($body[$field])) {
        set_config($field, $body[$field], 'local_feedbackexplorer');
    }
}

echo json_encode(['success' => true]);