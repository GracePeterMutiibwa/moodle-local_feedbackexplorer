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

// Load settings
$baseurl  = get_config('local_feedbackexplorer', 'baseurl');
$apikey   = get_config('local_feedbackexplorer', 'apikey');
$model    = get_config('local_feedbackexplorer', 'default_model');
$sysprompt = get_config('local_feedbackexplorer', 'sysprompt');

if (!$baseurl || !$apikey || !$model || !$sysprompt) {
    $error = is_siteadmin()
        ? 'LLM settings are incomplete. Please go to the Settings tab to configure them.'
        : 'AI settings are not configured. Please contact your administrator.';

    echo json_encode(['success' => false, 'error' => $error]);
    exit;
}

$data = $body['data'] ?? [];
$user_message = "Here is the feedback survey data in JSON format:\n\n```json\n" .
    json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) .
    "\n```\n\nPlease analyse this and produce the structured Markdown report.";

// Build OpenAI-compatible request
$payload = json_encode([
    'model'    => $model,
    'messages' => [
        ['role' => 'system', 'content' => $sysprompt],
        ['role' => 'user',   'content' => $user_message],
    ],
]);

$ch = curl_init(rtrim($baseurl, '/') . '/chat/completions');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => $payload,
    CURLOPT_HTTPHEADER     => [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $apikey,
    ],
    CURLOPT_TIMEOUT        => 60,
]);

$response = curl_exec($ch);
$err      = curl_error($ch);
curl_close($ch);

if ($err) {
    echo json_encode(['success' => false, 'error' => 'cURL error: ' . $err]);
    exit;
}

$result = json_decode($response, true);

if (!isset($result['choices'][0]['message']['content'])) {
    echo json_encode(['success' => false, 'error' => 'Unexpected API response: ' . $response]);
    exit;
}

$markdown = $result['choices'][0]['message']['content'];
echo json_encode(['success' => true, 'markdown' => $markdown]);